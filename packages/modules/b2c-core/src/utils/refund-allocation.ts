/**
 * Pure refund / payout-reversal allocation (D5).
 * Customer refund and seller transfer reversal are separate amounts.
 */

export type RefundAllocationInput = {
  /** Amount captured from the buyer for this seller order (minor or major — same unit throughout). */
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

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/**
 * Allocate a customer refund and the matching seller transfer reversal.
 * Never reverse more than the remaining seller transfer.
 * When no transfer exists yet, sellerReversal is 0 (funds still on platform).
 */
export function allocateRefundAndReversal(
  input: RefundAllocationInput
): RefundAllocationResult {
  const captured = clampNonNegative(input.capturedAmount)
  const alreadyRefunded = clampNonNegative(input.alreadyRefundedAmount)
  const transferred = clampNonNegative(input.transferredAmount)
  const alreadyReversed = clampNonNegative(input.alreadyReversedAmount)
  const commission = clampNonNegative(input.commissionAmount)
  const requested = clampNonNegative(input.requestedCustomerRefund)

  const remainingCustomerRefundable = Math.max(0, captured - alreadyRefunded)
  const customerRefund = Math.min(requested, remainingCustomerRefundable)

  // Net originally owed to seller after commission (informational bound).
  const sellerNet = Math.max(0, captured - commission)
  const remainingSellerReversible = Math.max(
    0,
    Math.min(transferred - alreadyReversed, sellerNet - alreadyReversed)
  )

  // Scale reversal with the fraction of remaining refundable that this refund covers,
  // but never exceed remainingSellerReversible.
  let sellerReversal = 0
  if (transferred > 0 && remainingCustomerRefundable > 0 && customerRefund > 0) {
    const fraction = customerRefund / remainingCustomerRefundable
    const proportional = remainingSellerReversible * fraction
    sellerReversal = Math.min(remainingSellerReversible, proportional)
    // Full customer refund of remaining balance → reverse all remaining transfer.
    if (customerRefund >= remainingCustomerRefundable) {
      sellerReversal = remainingSellerReversible
    }
  }

  return {
    customerRefund,
    sellerReversal,
    remainingCustomerRefundable: remainingCustomerRefundable - customerRefund,
    remainingSellerReversible: remainingSellerReversible - sellerReversal
  }
}
