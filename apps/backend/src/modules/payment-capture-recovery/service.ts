import NativePaymentModule from '@medusajs/payment'
import { Collection } from '@medusajs/framework/mikro-orm/core'
import type { CreateCaptureDTO, CreateRefundDTO, Context, PaymentDTO, InferEntityType } from '@medusajs/framework/types'
import { Payment, Refund } from '@medusajs/payment/dist/models'
import { assertCommerceSessionLock } from '@mercurjs/b2c-core/utils/commerce-financial-lock'
import { BigNumber, EmitEvents, InjectManager, MathBN, MedusaContext, MedusaError } from '@medusajs/framework/utils'
import { getAmountFromSmallestUnit, getSmallestUnit } from '@mercurjs/framework'
import { assertCommerceFinancialLock as assertCommerceCartFinancialLock, assertCommercePaymentLock, revokeCommerceFinancialWork, withCommerceRefundSequence } from '@mercurjs/b2c-core/utils/commerce-cart-lock'
import { assertRefundEffectFenceIfPresent } from '@mercurjs/b2c-core/utils/refund-effect-fence'
import { withFinancialOperation } from './financial-operation'
import { commerceNativeFence } from '@mercurjs/b2c-core/utils/commerce-native-fence'
import { assertCommerceRefundQuarantineClear, prepareCommerceRefundDispatch,
  withCommerceRefundDispatchContext, finishCurrentCommerceRefundDispatch } from '@mercurjs/b2c-core/utils/commerce-refund-quarantine'

// Every entry/read/native repository boundary keeps the current ALS authority.
// Outside settlement the existing cart-only native/admin contract is unchanged.
function assertCommerceFinancialLock(): void {
  assertCommerceCartFinancialLock()
  assertRefundEffectFenceIfPresent()
}

/** Full Stripe capture only. A live private commerce lock capability is mandatory,
 * including native/admin entry points; the database enforces one row per payment.
 * The native capture row commits before dispatch and is never removed on an
 * uncertain provider outcome or failed local write. No outer transaction may
 * encompass dispatch: rolling it back would erase the stable operation identity.
 * Refund accounting/protocol, repositories and native models remain native;
 * refund/cancel/session deletion are additionally fenced at every async boundary.
 */
export default class PaymentCaptureRecoveryService extends NativePaymentModule.service {
  constructor(...args: ConstructorParameters<typeof NativePaymentModule.service>) {
    super(...args)
    // Native TS-private refundPayment_ is an ordinary decorated JS method.
    // Wrap the real runtime entry (including direct callers), without redeclaring
    // a TS-private member or mutating the shared native prototype/services.
    const runtime = this as unknown as Record<string, (...args: any[]) => Promise<any>>
    const reserve = runtime.refundPayment_
    Object.defineProperty(this, 'refundPayment_', {
      configurable: false, writable: false,
      value: async function (this: PaymentCaptureRecoveryService, payment: InferEntityType<typeof Payment>, data: CreateRefundDTO, context: Context = {}) {
        try {
          assertCommerceFinancialLock()
          this.rejectOuterFinancialTransaction(context)
          const expectedId = data.payment_id
          const supplied = this.financialPaymentSnapshot(payment)
          if (supplied.id !== expectedId) this.financialIdentityMismatch()
          const fresh = await this.freshFinancialPayment(expectedId, context)
          this.matchFinancialPayment(supplied, fresh)
          assertCommerceFinancialLock()
          const scoped = this.financialInvocation(fresh, expectedId)
          const refund = await reserve.call(scoped, fresh, { ...data, payment_id: expectedId }, context)
          assertCommerceFinancialLock()
          return refund
        } catch (error) { revokeCommerceFinancialWork(); throw error }
      }
    })
    // Guard before InjectManager/EmitEvents do even their native manager work.
    // Native public refund catches protected dispatch errors before returning;
    // direct protected callers must also revoke authority before native cleanup.
    for (const name of ['refundPayment', 'cancelPayment', 'deletePaymentSession', 'refundPaymentFromProvider_', 'capturePayment']) {
      const entry = runtime[name]
      // Medusa's workflow Proxy must wrap module methods to add context. A frozen
      // data property forbids returning that wrapper. A nonconfigurable getter
      // with no setter keeps the guard immutable while permitting contextualization.
      const guarded = async function (this: PaymentCaptureRecoveryService, ...args: any[]) {
        try {
          assertCommerceFinancialLock()
          this.rejectOuterFinancialTransaction(args[name === 'refundPaymentFromProvider_' ? 2 : 1] ?? {})
          const result = await entry.apply(this, args)
          assertCommerceFinancialLock()
          return result
        } catch (error) { revokeCommerceFinancialWork(); throw error }
      }
      Object.defineProperty(this, name, {
        configurable: false,
        get: () => guarded
      })
    }
  }

  private rejectOuterFinancialTransaction(context: Context): void {
    if (context.transactionManager !== undefined) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Commerce refund/cancel dispatch cannot run inside an outer transaction')
    }
  }

  private async assertFinancialPayment(payment: InferEntityType<typeof Payment>, expectedId: string): Promise<void> {
    assertCommerceFinancialLock()
    if (!payment || payment.id !== expectedId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Commerce financial payment identity mismatch')
    }
    await assertCommercePaymentLock(payment.id, payment.payment_collection_id)
    assertCommerceFinancialLock()
  }

  private financialIdentityMismatch(): never {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Commerce financial operation binding identity mismatch')
  }

  private financialPaymentSnapshot(payment: InferEntityType<typeof Payment>): InferEntityType<typeof Payment> {
    if (!payment || typeof payment.id !== 'string' || !payment.id || payment.id.trim() !== payment.id ||
        typeof payment.provider_id !== 'string' || !payment.provider_id ||
        typeof payment.data?.id !== 'string' || !payment.data.id || payment.data.id.trim() !== payment.data.id) this.financialIdentityMismatch()
    // Preserve native collections/numerics, but copy primitive identity before
    // ownership awaits. Never retain caller-owned provider identity as authority.
    return Object.freeze({ ...payment, id: payment.id, provider_id: payment.provider_id,
      payment_collection_id: payment.payment_collection_id,
      data: Object.freeze(structuredClone(payment.data)) }) as InferEntityType<typeof Payment>
  }

  private financialRawAmount(raw: Record<string, unknown>): BigNumber {
    if (!raw || (typeof raw.value !== 'string' && typeof raw.value !== 'number')) return this.financialIdentityMismatch()
    const amount = new BigNumber(raw.value)
    if (!amount.bigNumber || !amount.bigNumber.isFinite()) return this.financialIdentityMismatch()
    return amount
  }

  private matchFinancialPayment(supplied: InferEntityType<typeof Payment>, fresh: InferEntityType<typeof Payment>): void {
    if (supplied.id !== fresh.id || supplied.payment_collection_id !== fresh.payment_collection_id ||
        supplied.provider_id !== fresh.provider_id || supplied.data?.id !== fresh.data?.id) this.financialIdentityMismatch()
  }

  private async freshFinancialPayment(id: string, context: Context): Promise<InferEntityType<typeof Payment>> {
    assertCommerceFinancialLock()
    const entity = await this.paymentService_.retrieve(id, {
      select: ['id', 'data', 'provider_id', 'payment_collection_id', 'amount', 'raw_amount', 'currency_code'],
      relations: ['captures.raw_amount', 'refunds.raw_amount']
    }, context)
    assertCommerceFinancialLock()
    const payment = this.financialPaymentSnapshot(entity)
    await this.assertFinancialPayment(payment, id)
    assertCommerceFinancialLock()
    await assertCommerceRefundQuarantineClear(payment.payment_collection_id, 'refund')
    assertCommerceFinancialLock()
    return payment
  }

  /** Invocation-local adapters: never temporarily replace a singleton field.
   * Keep the real service receiver (including its native private state), args,
   * native transaction decoration, BigNumber values and return values intact.
   */
  private financialInvocation(payment?: InferEntityType<typeof Payment>, expectedId?: string, expectedSessionId?: string): this {
    const scoped = Object.create(this) as this
    Object.defineProperty(scoped, 'baseRepository_', { value: commerceNativeFence(this.baseRepository_, assertCommerceFinancialLock) })
    const guard = <T extends object>(service: T): T => new Proxy(commerceNativeFence(service, assertCommerceFinancialLock), {
      get: (target, key) => {
        const method = Reflect.get(target, key, target)
        if (typeof method !== 'function') return method
        return async (...args: any[]) => {
          assertCommerceFinancialLock()
          // Explicitly retain authoritative refund rows on native catch cleanup.
          // No fresh native manager can erase an uncertain dispatch identity.
          if (service === this.refundService_ && key === 'delete') {
            throw new MedusaError(MedusaError.Types.CONFLICT, 'Refund identity retained; reconciliation required')
          }
          const result = await Reflect.apply(method, target, args)
          assertCommerceFinancialLock()
          if (payment && key === 'retrieve' && service === this.paymentService_) {
            await this.assertFinancialPayment(result, expectedId!)
            assertCommerceFinancialLock()
          }
          if (expectedSessionId && key === 'retrieve' && service === this.paymentSessionService_) {
            if (!result || result.id !== expectedSessionId) {
              throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Commerce financial session identity mismatch')
            }
            await assertCommerceSessionLock(expectedSessionId)
            assertCommerceFinancialLock()
          }
          return result
        }
      }
    })
    const services = {
      paymentService: guard(this.paymentService_),
      refundService: guard(this.refundService_),
      paymentCollectionService: guard(this.paymentCollectionService_),
      paymentSessionService: guard(this.paymentSessionService_),
      paymentProviderService: guard(this.paymentProviderService_)
    }
    for (const [name, service] of Object.entries(services)) {
      Object.defineProperty(scoped, `${name}_`, { value: service })
    }
    // Generated CRUD uses this runtime DI field; it is not public in the native
    // declaration, so narrow only that field rather than weakening the service.
    const container = (this as unknown as { __container__: Record<string | symbol, unknown> }).__container__
    Object.defineProperty(scoped, '__container__', { value: new Proxy(container, {
      get: (target, key) => key in services ? services[key as keyof typeof services] : Reflect.get(target, key)
    }) })
    return scoped
  }

  @InjectManager()
  @EmitEvents()
  async refundPayment(data: CreateRefundDTO, @MedusaContext() sharedContext: Context = {}): Promise<PaymentDTO> {
    assertCommerceFinancialLock()
    this.rejectOuterFinancialTransaction(sharedContext)
    return withCommerceRefundSequence(() => {
      assertCommerceFinancialLock()
      return withCommerceRefundDispatchContext<PaymentDTO>(async nativeAccounting => {
        const payment = await this.freshFinancialPayment(data.payment_id, sharedContext)
        // Receipt encloses full native accounting, never only provider dispatch.
        const result = await nativeAccounting<PaymentDTO>(() => super.refundPayment.call(
          this.financialInvocation(payment, data.payment_id), data, sharedContext))
        assertCommerceFinancialLock()
        await finishCurrentCommerceRefundDispatch()
        assertCommerceFinancialLock()
        return result
      })
    })
  }

  protected async refundPaymentFromProvider_(
    payment: InferEntityType<typeof Payment>, refund: InferEntityType<typeof Refund>, sharedContext: Context = {}
  ) {
    assertCommerceFinancialLock()
    this.rejectOuterFinancialTransaction(sharedContext)
    const supplied = this.financialPaymentSnapshot(payment)
    const refundId = refund?.id
    const suppliedAmount = refund?.raw_amount ? this.financialRawAmount(refund.raw_amount).numeric : undefined
    if (typeof refundId !== 'string' || !refundId || refundId.trim() !== refundId || suppliedAmount === undefined) this.financialIdentityMismatch()
    const fresh = await this.freshFinancialPayment(supplied.id, sharedContext)
    this.matchFinancialPayment(supplied, fresh)
    const entity = await this.refundService_.retrieve(refundId, { relations: ['payment'] }, sharedContext)
    assertCommerceFinancialLock()
    const persisted = entity as InferEntityType<typeof Refund> & { payment_id?: string; payment?: { id: string } }
    if (!persisted || persisted.id !== refundId ||
        (persisted.payment_id ?? persisted.payment?.id) !== fresh.id ||
        (persisted.payment_id !== undefined && persisted.payment_id !== fresh.id) ||
        (persisted.payment != null && persisted.payment.id !== fresh.id) ||
        !persisted.raw_amount || !MathBN.gt(this.financialRawAmount(persisted.raw_amount), 0) ||
        !MathBN.eq(persisted.amount, this.financialRawAmount(persisted.raw_amount)) ||
        !MathBN.eq(this.financialRawAmount(persisted.raw_amount), suppliedAmount)) this.financialIdentityMismatch()
    const freshRefund = Object.freeze({ ...persisted, id: refundId, raw_amount: structuredClone(persisted.raw_amount) }) as InferEntityType<typeof Refund>
    const providerPaymentId = fresh.data?.id
    if (typeof providerPaymentId !== 'string' || !providerPaymentId ||
        typeof fresh.currency_code !== 'string' || !/^[a-z]{3}$/.test(fresh.currency_code)) this.financialIdentityMismatch()
    await prepareCommerceRefundDispatch({ refund_id: refundId, payment_id: fresh.id,
      scope_id: fresh.payment_collection_id, provider_id: fresh.provider_id,
      provider_payment_id: providerPaymentId, amount: this.financialRawAmount(freshRefund.raw_amount).numeric,
      currency_code: fresh.currency_code })
    assertCommerceFinancialLock()
    const result = await withFinancialOperation<InferEntityType<typeof Payment>>({
      kind: 'refundPayment', nativeId: refundId, providerId: fresh.provider_id,
      data: fresh.data, idempotencyKey: refundId, amount: freshRefund.raw_amount
    }, () => super.refundPaymentFromProvider_.call(this.financialInvocation(fresh, fresh.id), fresh, freshRefund, sharedContext))
    assertCommerceFinancialLock()
    return result
  }

  @InjectManager()
  @EmitEvents()
  async cancelPayment(paymentId: string, @MedusaContext() sharedContext: Context = {}): Promise<PaymentDTO> {
    assertCommerceFinancialLock()
    this.rejectOuterFinancialTransaction(sharedContext)
    const entity = await this.paymentService_.retrieve(paymentId, {
      select: ['id', 'data', 'provider_id', 'payment_collection_id', 'captured_at', 'canceled_at'],
      relations: ['captures']
    }, sharedContext)
    assertCommerceFinancialLock()
    const payment = this.financialPaymentSnapshot(entity)
    await this.assertFinancialPayment(payment, paymentId)
    assertCommerceFinancialLock()
    await assertCommerceRefundQuarantineClear(payment.payment_collection_id, 'cancel')
    assertCommerceFinancialLock()
    const scoped = this.financialInvocation(payment, paymentId)
    if (payment.canceled_at) {
      const fresh = await scoped.retrievePayment(payment.id, {}, sharedContext)
      assertCommerceFinancialLock()
      return fresh
    }
    const captures: unknown = payment.captures
    const rows = Array.isArray(captures) ? captures
      : captures instanceof Collection && captures.isInitialized(true) ? captures.getItems() : undefined
    if (payment.captured_at || !rows || rows.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Captured payment cannot be canceled; use refund settlement')
    }
    // Same native cancel protocol, using the authoritative snapshot above.
    // Native cancel's second retrieve omits collection/captured state, so do not
    // hand that incomplete projection to either identity or capture validation.
    await withFinancialOperation({
      kind: 'cancelPayment', nativeId: payment.id, providerId: payment.provider_id,
      data: payment.data, idempotencyKey: payment.id
    }, () => scoped.paymentProviderService_.cancelPayment(payment.provider_id, {
      data: payment.data ?? undefined,
      context: { idempotency_key: payment.id }
    }))
    assertCommerceFinancialLock()
    await scoped.paymentService_.update({ id: paymentId, canceled_at: new Date() }, sharedContext)
    assertCommerceFinancialLock()
    const fresh = await scoped.retrievePayment(payment.id, {}, sharedContext)
    assertCommerceFinancialLock()
    return fresh
  }

  @InjectManager()
  @EmitEvents()
  async deletePaymentSession(id: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    assertCommerceFinancialLock()
    this.rejectOuterFinancialTransaction(sharedContext)
    await assertCommerceSessionLock(id)
    assertCommerceFinancialLock()
    const entity = await this.paymentSessionService_.retrieve(id, { select: ['id', 'data', 'provider_id', 'payment_collection_id'] }, sharedContext)
    assertCommerceFinancialLock()
    if (!entity || entity.id !== id || typeof entity.data?.id !== 'string' || !entity.data.id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Commerce financial session identity mismatch')
    }
    const session = Object.freeze({ id: entity.id, provider_id: entity.provider_id,
      payment_collection_id: entity.payment_collection_id, data: Object.freeze(structuredClone(entity.data)) })
    await assertCommerceSessionLock(session.id)
    assertCommerceFinancialLock()
    await assertCommerceRefundQuarantineClear(session.payment_collection_id, 'cancel')
    assertCommerceFinancialLock()
    await withFinancialOperation({ kind: 'deleteSession', nativeId: session.id, providerId: session.provider_id, data: session.data },
      () => super.deletePaymentSession.call(this.financialInvocation(undefined, undefined, session.id), session.id, sharedContext))
    assertCommerceFinancialLock()
  }

  @InjectManager()
  @EmitEvents()
  async capturePayment(
    input: CreateCaptureDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PaymentDTO> {
    assertCommerceFinancialLock()
    const reject = (message: string): never => {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Full capture recovery: ${message}`)
    }
    if (sharedContext.transactionManager) {
      reject('dispatch cannot run inside an outer transaction')
    }
    const payment = await this.paymentService_.retrieve(input.payment_id, {
      select: ['id', 'data', 'provider_id', 'payment_collection_id', 'amount', 'raw_amount', 'currency_code', 'captured_at', 'canceled_at'],
      relations: ['captures.raw_amount']
    }, sharedContext)
    assertCommerceFinancialLock()
    if (payment.id !== input.payment_id) reject('retrieved payment identity mismatch')
    await assertCommercePaymentLock(payment.id, payment.payment_collection_id)
    assertCommerceFinancialLock()
    await assertCommerceRefundQuarantineClear(payment.payment_collection_id, 'capture')
    assertCommerceFinancialLock()
    if (payment.canceled_at) reject('payment is canceled')
    const currency = payment.currency_code?.toLowerCase()
    if (!currency || !/^[a-z]{3}$/.test(currency)) return reject('invalid payment currency')
    // Native entities expose JSON raw_amount, not a typed BNInput. Preserve its
    // exact value through the same native BigNumber used by capturePayment_.
    const fromRawAmount = (raw: Record<string, unknown>): BigNumber => {
      if (!raw || (typeof raw.value !== 'string' && typeof raw.value !== 'number')) {
        return reject('invalid native raw amount')
      }
      return new BigNumber(raw.value)
    }
    const amount = fromRawAmount(payment.raw_amount)
    if (!MathBN.gt(amount, 0) || !MathBN.eq(payment.amount, amount)) reject('invalid authorized amount')
    if (input.amount !== undefined && !MathBN.eq(input.amount, amount)) reject('only the entire authorized amount is supported')
    const minorAmount = getSmallestUnit(amount, currency)
    if (!Number.isSafeInteger(minorAmount) || minorAmount <= 0 ||
        !MathBN.eq(getAmountFromSmallestUnit(minorAmount, currency), amount)) {
      reject('amount is not exactly representable in provider minor units')
    }
    // Internal retrieve returns entities with MikroORM Collections; serialized
    // DTO adapters expose arrays. Normalize only the validation view: native
    // capturePayment_ must still receive the original entity/Collection (reduce).
    // Do not initialize a missing relation or serialize away native raw amounts.
    const nativeCaptures: unknown = payment.captures
    const captures = Array.isArray(nativeCaptures) ? nativeCaptures
      : nativeCaptures instanceof Collection && nativeCaptures.isInitialized(true)
        ? nativeCaptures.getItems()
        : reject('capture rows are not an initialized native collection or array')
    if (!Array.isArray(captures) || captures.length > 1) reject('ambiguous capture rows')
    let capture: (typeof captures)[number] | undefined = captures[0]
    // Length, rather than truthiness, also rejects null/undefined and sparse rows.
    if (captures.length === 1 && (!capture || typeof capture !== 'object' ||
        typeof capture.id !== 'string' || !capture.id.trim() ||
        (capture.payment_id !== undefined && capture.payment_id !== payment.id) ||
        !MathBN.eq(fromRawAmount(capture.raw_amount), amount) || !MathBN.eq(capture.amount, amount))) {
      reject('existing capture is not a single full capture with a stable identity')
    }
    // Native public capture dispatches even here. Do not call it. Repair only
    // native collection accounting and return a fresh, not pre-update, PaymentDTO.
    if (payment.captured_at) {
      if (!capture) reject('captured payment is missing full capture accounting')
      assertCommerceFinancialLock()
      await this.maybeUpdatePaymentCollection_(payment.payment_collection_id, sharedContext)
      assertCommerceFinancialLock()
      const fresh = await this.retrievePayment(payment.id, { relations: ['captures'] }, sharedContext)
      assertCommerceFinancialLock()
      return fresh
    }
    const providerId = payment.data?.id
    if (typeof providerId !== 'string' || !providerId.trim()) reject('missing provider payment identity')
    const verify = (receipt: Record<string, unknown> | undefined, allowAuthorized: boolean): Record<string, unknown> => {
      if (!receipt || receipt.id !== providerId || receipt.currency !== currency ||
          receipt.amount !== minorAmount) return reject('provider receipt identity, currency or amount mismatch')
      if (receipt.status === 'succeeded') {
        if (receipt.amount_received !== minorAmount || receipt.amount_capturable !== 0) reject('provider did not capture the exact full amount')
      } else if (allowAuthorized && receipt.status === 'requires_capture') {
        if (receipt.amount_received !== 0 || receipt.amount_capturable !== minorAmount) reject('provider authorization is partial or inconsistent')
      } else {
        reject('provider state is canceled, unknown or not safely capturable')
      }
      return receipt
    }
    // getStatus invokes Stripe GET and returns unmodified minor-unit data. The
    // provider retrievePayment API converts amount to major units; do not use it.
    assertCommerceFinancialLock()
    const status = await this.paymentProviderService_.getStatus(payment.provider_id, { data: payment.data ?? undefined })
    assertCommerceFinancialLock()
    let receipt = verify(status.data, true)
    if (!capture) {
      // Retain native transaction-decorated creation, IDs and numeric storage.
      // Do NOT delegate to native public capturePayment: its catch deletes rows.
      // A unique capture(payment_id) conflict escapes before dispatch. A fresh
      // locked retry retrieves and reuses the winner; never invent a second ID.
      assertCommerceFinancialLock()
      const prepared = await this.capturePayment_({ ...input, amount }, payment, sharedContext)
      assertCommerceFinancialLock()
      capture = prepared.capture
      if (!capture?.id) return reject('native capture creation did not return a stable identity')
    }
    if (receipt.status === 'requires_capture') {
      assertCommerceFinancialLock()
      const result = await this.paymentProviderService_.capturePayment(payment.provider_id, {
        data: receipt,
        context: { idempotency_key: capture.id }
      })
      // A lost session after dispatch leaves the stable row for reconciliation.
      // Do not finalize even an exact receipt under a revoked capability.
      assertCommerceFinancialLock()
      receipt = verify(result.data, false)
    }
    // Any exception above/below intentionally retains the committed capture row.
    assertCommerceFinancialLock()
    await this.paymentService_.update({ id: payment.id, data: receipt, captured_at: new Date() }, sharedContext)
    assertCommerceFinancialLock()
    await this.maybeUpdatePaymentCollection_(payment.payment_collection_id, sharedContext)
    assertCommerceFinancialLock()
    const fresh = await this.retrievePayment(payment.id, { relations: ['captures'] }, sharedContext)
    assertCommerceFinancialLock()
    return fresh
  }
}
