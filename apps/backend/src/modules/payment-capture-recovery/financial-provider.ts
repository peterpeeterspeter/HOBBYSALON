import { PaymentProviderService as NativePaymentProviderService } from '@medusajs/payment/dist/services'
import { assertCommerceFinancialLock as assertCommerceCartFinancialLock, revokeCommerceFinancialWork } from '@mercurjs/b2c-core/utils/commerce-cart-lock'
import { assertRefundEffectFenceIfPresent } from '@mercurjs/b2c-core/utils/refund-effect-fence'
import { assertFinancialOperation } from './financial-operation'

function assertCommerceFinancialLock(): void {
  assertCommerceCartFinancialLock()
  assertRefundEffectFenceIfPresent()
}

/** Native dispatcher and provider inputs remain unchanged. No caller context can
 * grant a capability. This also fences inherited create/authorize compensation
 * paths, which bypass the module's public refund/cancel/session entry points.
 * Keep the runtime class name: native DI registers by lower-casing that name.
 */
export default class PaymentProviderService extends NativePaymentProviderService {
  async deleteSession(...args: Parameters<NativePaymentProviderService['deleteSession']>) {
    try {
      assertFinancialOperation('deleteSession', args[0], args[1])
      const result = await super.deleteSession(...args)
      assertCommerceFinancialLock()
      return result
    } catch (error) { revokeCommerceFinancialWork(); throw error }
  }

  async cancelPayment(...args: Parameters<NativePaymentProviderService['cancelPayment']>) {
    try {
      assertFinancialOperation('cancelPayment', args[0], args[1])
      const result = await super.cancelPayment(...args)
      assertCommerceFinancialLock()
      return result
    } catch (error) { revokeCommerceFinancialWork(); throw error }
  }

  async refundPayment(...args: Parameters<NativePaymentProviderService['refundPayment']>) {
    try {
      assertFinancialOperation('refundPayment', args[0], args[1])
      const result = await super.refundPayment(...args)
      assertCommerceFinancialLock()
      return result
    } catch (error) { revokeCommerceFinancialWork(); throw error }
  }
}
