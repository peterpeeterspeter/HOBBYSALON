import { EntityManager } from "@medusajs/framework/mikro-orm/knex";

import { Context } from "@medusajs/framework/types";
import {
  InjectTransactionManager,
  MathBN,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils";

import { Onboarding, Payout, PayoutAccount, PayoutReversal } from "./models";
import { commerceNativeFence } from "../../utils/commerce-native-fence";
import { captureRefundEffectFence, checkRefundEffectFence } from "../../utils/refund-effect-fence";
import {
  CreateOnboardingDTO,
  CreatePayoutAccountDTO,
  CreatePayoutDTO,
  CreatePayoutReversalDTO,
  getAmountFromSmallestUnit,
  getSmallestUnit,
  IPayoutProvider,
  PayoutAccountStatus,
  PayoutWebhookActionPayload,
} from "@mercurjs/framework";

type InjectedDependencies = {
  payoutProvider: IPayoutProvider;
};

class PayoutModuleService extends MedusaService({
  Payout,
  PayoutReversal,
  PayoutAccount,
  Onboarding,
}) {
  protected provider_: IPayoutProvider;

  constructor({ payoutProvider }: InjectedDependencies) {
    super(...arguments);
    this.provider_ = payoutProvider;
    // Immutable own entries check before native decorator acquisition; preserve
    // the original module/internal-service/private repository and EM receivers.
    // Only reversal paths require authority. Unrelated createPayouts is untouched.
    for (const name of ["createPayoutReversal", "createPayoutReversals"] as const) {
      const method = this[name];
      Object.defineProperty(this, name, { value: async (input: unknown, context: Context<EntityManager> = {}) => {
        const check = captureRefundEffectFence();
        const rootRepository = (this as unknown as { baseRepository_: { transaction: (work: (manager: EntityManager) => Promise<unknown>, options: unknown) => Promise<unknown> } }).baseRepository_;
        const repository = commerceNativeFence(rootRepository, check);
        const invoke = async (transactionManager: EntityManager) => {
          check();
          const result = await Reflect.apply(method, this, [input, {
            ...context, transactionManager,
            ...(context.manager ? { manager: commerceNativeFence(context.manager, check) } : {}),
          }]);
          check();
          return result;
        };
        if (context.transactionManager) {
          return invoke(commerceNativeFence(context.transactionManager, check));
        }
        return repository.transaction(invoke, {
          manager: context.manager, isolationLevel: context.isolationLevel,
          enableNestedTransactions: context.enableNestedTransactions ?? false,
        });
      } });
    }
  }

  @InjectTransactionManager()
  async createPayoutAccount(
    { context }: CreatePayoutAccountDTO,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const result = await this.createPayoutAccounts(
      { context, reference_id: "placeholder", data: {} },
      sharedContext
    );

    try {
      const { data, id: referenceId } =
        await this.provider_.createPayoutAccount({
          context,
          account_id: result.id,
        });

      await this.updatePayoutAccounts(
        {
          id: result.id,
          data,
          reference_id: referenceId,
        },
        sharedContext
      );

      const updated = await this.retrievePayoutAccount(
        result.id,
        undefined,
        sharedContext
      );
      return updated;
    } catch (error) {
      await this.deletePayoutAccounts(result.id, sharedContext);
      throw error;
    }
  }

  @InjectTransactionManager()
  async syncStripeAccount(
    account_id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const payout_account = await this.retrievePayoutAccount(account_id);
    const stripe_account = await this.provider_.getAccount(
      payout_account.reference_id
    );

    const providerWithCapability = this.provider_ as unknown as {
      isRecipientTransfersActive?: (account: unknown) => boolean;
    };
    const isActive =
      typeof providerWithCapability.isRecipientTransfersActive === "function"
        ? providerWithCapability.isRecipientTransfersActive(stripe_account)
        : Boolean(
            stripe_account.details_submitted &&
              stripe_account.payouts_enabled &&
              stripe_account.charges_enabled &&
              stripe_account.tos_acceptance?.date
          );

    const status = isActive
      ? PayoutAccountStatus.ACTIVE
      : PayoutAccountStatus.PENDING;

    await this.updatePayoutAccounts(
      {
        id: account_id,
        data: stripe_account as unknown as Record<string, unknown>,
        status,
      },
      sharedContext
    );

    const updated = await this.retrievePayoutAccount(
      account_id,
      undefined,
      sharedContext
    );
    return updated;
  }

  @InjectTransactionManager()
  async initializeOnboarding(
    { context, payout_account_id }: CreateOnboardingDTO,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const [existingOnboarding] = await this.listOnboardings({
      payout_account_id,
    });
    const account = await this.retrievePayoutAccount(payout_account_id);

    const { data: providerData } = await this.provider_.initializeOnboarding(
      account.reference_id!,
      { ...context, payout_account_id }
    );

    let onboarding = existingOnboarding;
    if (!existingOnboarding) {
      onboarding = await super.createOnboardings(
        {
          payout_account_id,
        },
        sharedContext
      );
    }

    await this.updateOnboardings(
      {
        id: onboarding.id,
        data: providerData,
        context,
      },
      sharedContext
    );

    return await this.retrieveOnboarding(
      onboarding.id,
      undefined,
      sharedContext
    );
  }

  @InjectTransactionManager()
  async createPayout(
    input: CreatePayoutDTO,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const {
      amount,
      currency_code,
      account_id,
      transaction_id,
      source_transaction,
    } = input;

    const payoutAccount = await this.retrievePayoutAccount(account_id);

    const { data } = await this.provider_.createPayout({
      account_reference_id: payoutAccount.reference_id,
      amount,
      currency: currency_code,
      transaction_id,
      source_transaction,
    });

    // @ts-expect-error BigNumber incompatible interface
    const payout = await this.createPayouts(
      {
        data,
        amount,
        currency_code,
        payout_account: payoutAccount.id,
      },
      sharedContext
    );

    return payout;
  }

  @InjectTransactionManager()
  async createPayoutReversal(
    input: CreatePayoutReversalDTO,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    checkRefundEffectFence(); // direct prototype entry after native acquisition too
    const check = captureRefundEffectFence();
    sharedContext = { ...sharedContext,
      ...(sharedContext?.manager ? { manager: commerceNativeFence(sharedContext.manager, check) } : {}),
      ...(sharedContext?.transactionManager ? { transactionManager: commerceNativeFence(sharedContext.transactionManager, check) } : {}),
    };
    if (typeof input.operation_id !== "string" || !input.operation_id.trim() ||
        typeof input.payout_id !== "string" || !input.payout_id.trim()) {
      throw new Error("Payout reversal requires a stable operation identity");
    }
    const currency = input.currency_code.toLowerCase();
    const providerAmount = getSmallestUnit(input.amount, currency);
    const amount = getAmountFromSmallestUnit(providerAmount, currency);
    // Keep the original decimal input for equality before using the normalized
    // round-trip amount for provider calls and storage.
    if (!Number.isSafeInteger(providerAmount) || providerAmount <= 0 ||
        !MathBN.eq(amount, input.amount)) {
      throw new Error("Payout reversal amount is not exactly representable by the provider");
    }
    // Include the payout as well as the return/cancellation identity. Never key
    // by amount: separate equal-amount returns must remain separate operations.
    const idempotencyKey = `payout-reversal:${encodeURIComponent(input.payout_id)}:${encodeURIComponent(input.operation_id)}`;
    if (idempotencyKey.length > 255) {
      throw new Error("Payout reversal operation identity is too long");
    }
    const payout = await this.retrievePayout(input.payout_id, undefined, sharedContext);
    checkRefundEffectFence();
    if (!payout || !payout.data || !payout.data.id) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payout not found");
    }
    if (payout.currency_code.toLowerCase() !== currency) {
      throw new Error("Payout reversal currency does not match payout");
    }
    const transfer_id = payout.data.id as string;
    const validateResult = (data: Record<string, unknown> | null | undefined) => {
      const transfer = data?.transfer;
      const transferId = typeof transfer === "string" ? transfer :
        (transfer as { id?: string } | null)?.id;
      if (typeof data?.id !== "string" || !data.id ||
          data.amount !== providerAmount || data.currency !== currency || transferId !== transfer_id) {
        throw new Error("Payout reversal provider result does not match operation");
      }
    };

    // Paginate rather than silently ignoring older operations past the service
    // default page. Existing rows without this marker are NOT replay evidence.
    const pageSize = 100;
    for (let skip = 0; ; skip += pageSize) {
      const reversals = await this.listPayoutReversals(
        { payout_id: payout.id },
        { take: pageSize, skip, order: { id: "ASC" } },
        sharedContext
      );
      const saved = reversals.find((row) => row.data?.idempotency_key === idempotencyKey);
      checkRefundEffectFence();
      if (saved) {
        if (!MathBN.eq(saved.amount, amount) || saved.currency_code !== currency ||
            saved.id !== saved.data?.id) {
          throw new Error("Payout reversal operation conflicts with saved amount or currency");
        }
        validateResult(saved.data);
        return saved;
      }
      if (reversals.length < pageSize) break;
    }

    checkRefundEffectFence();
    const transferReversal = await this.provider_.reversePayout({
      transfer_id,
      amount,
      currency,
      idempotency_key: idempotencyKey,
    });
    checkRefundEffectFence();
    validateResult(transferReversal as unknown as Record<string, unknown>);

    // The external ID is also the primary key: concurrent replies for the same
    // provider operation cannot create two local amount rows. A uniqueness or
    // persistence error propagates; retry finds the winner or reuses the same
    // provider key. This is NOT a durable pending-operation ledger: unknown
    // outcomes beyond provider key retention still require reconciliation.
    checkRefundEffectFence();
    const payoutReversal = await this.createPayoutReversals(
      {
        id: transferReversal.id,
        data: { ...transferReversal, idempotency_key: idempotencyKey },
        amount,
        currency_code: currency,
        payout: payout.id,
      },
      sharedContext
    );

    checkRefundEffectFence();
    return payoutReversal;
  }

  async getWebhookActionAndData(input: PayoutWebhookActionPayload) {
    return await this.provider_.getWebhookActionAndData(input);
  }
}

export default PayoutModuleService;
