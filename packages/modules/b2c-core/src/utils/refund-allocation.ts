import { refundMoney, remainingSellerEntitlement } from './refund-money'

/**
 * Pure refund / payout-reversal allocation (D5).
 * Customer refund and seller transfer reversal are separate amounts.
 */

export type RefundAllocationInput = {
  /** Currency of all amounts (major units); EUR remains the legacy default. */
  currencyCode?: string
  /** Amount captured from the buyer for this seller order in major units. */
  capturedAmount: number
  /** Already refunded to the customer. */
  alreadyRefundedAmount: number
  /** Amount already transferred to the seller (0 if no payout yet). */
  transferredAmount: number
  /** Already reversed from the seller transfer. */
  alreadyReversedAmount: number
  /** Commission retained by the platform on this order (not part of seller transfer). */
  commissionAmount: number
  /** Requested customer refund for this operation. */
  requestedCustomerRefund: number
}

export type RefundAllocationResult = {
  customerRefund: number
  sellerReversal: number
  remainingCustomerRefundable: number
  remainingSellerReversible: number
}

const min = (a: bigint, b: bigint): bigint => a < b ? a : b
const nonNegative = (value: bigint): bigint => value > 0n ? value : 0n

/**
 * Allocate a customer refund and the matching seller transfer reversal.
 * Never reverse more than the remaining seller transfer.
 * When no transfer exists yet, sellerReversal is 0 (funds still on platform).
 */
export function allocateRefundAndReversal(
  input: RefundAllocationInput
): RefundAllocationResult {
  const money = refundMoney(input.currencyCode)
  const captured = money.toMinor(input.capturedAmount)
  const alreadyRefunded = money.toMinor(input.alreadyRefundedAmount)
  const transferred = money.toMinor(input.transferredAmount)
  const alreadyReversed = money.toMinor(input.alreadyReversedAmount)
  const commission = money.toMinor(input.commissionAmount)
  const requested = money.toMinor(input.requestedCustomerRefund)
  const remainingCustomerRefundable = nonNegative(captured - alreadyRefunded)
  const customerRefund = min(requested, remainingCustomerRefundable)
  const sellerNet = nonNegative(captured - commission)
  const remainingSellerReversible = nonNegative(min(transferred, sellerNet) - alreadyReversed)

  // Difference from the cumulative entitlement, never a newly rounded fraction
  // of the remaining transfer. A transfer made after an earlier refund already
  // excludes that refund's seller share; do not reverse that share a second time.
  let sellerReversal = 0n
  if (customerRefund > 0n && remainingSellerReversible > 0n) {
    const entitlement = remainingSellerEntitlement(
      captured, commission, alreadyRefunded + customerRefund
    )
    sellerReversal = min(
      remainingSellerReversible,
      nonNegative(remainingSellerReversible - entitlement)
    )
  }

  return {
    customerRefund: money.fromMinor(customerRefund),
    sellerReversal: money.fromMinor(sellerReversal),
    remainingCustomerRefundable: money.fromMinor(remainingCustomerRefundable - customerRefund),
    remainingSellerReversible: money.fromMinor(remainingSellerReversible - sellerReversal)
  }
}
