/** Currency-major API boundary; all allocation arithmetic uses integer minor units. */
export function refundMoney(currencyCode = 'eur') {
  if (!/^[a-z]{3}$/i.test(currencyCode)) throw new Error('Invalid refund currency code')
  const digits = new Intl.NumberFormat('en', {
    style: 'currency', currency: currencyCode.toUpperCase()
  }).resolvedOptions().maximumFractionDigits
  if (digits === undefined) throw new Error('Unable to resolve refund currency precision')
  const scale = 10n ** BigInt(digits)
  return {
    toMinor(value: number): bigint {
      // Preserve the allocator's nonnegative normalization for legacy inputs.
      if (!Number.isFinite(value) || value <= 0) return 0n
      const [mantissa, exponent = '0'] = value.toString().split('e')
      const [whole, fraction = ''] = mantissa.split('.')
      const coefficient = BigInt(whole + fraction)
      const shift = Number(exponent) - fraction.length
      const numerator = coefficient * scale * (shift >= 0 ? 10n ** BigInt(shift) : 1n)
      const denominator = shift < 0 ? 10n ** BigInt(-shift) : 1n
      const minor = roundRefundRatio(numerator, denominator)
      if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Unsafe refund amount')
      return minor
    },
    fromMinor(value: bigint): number {
      if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Unsafe refund amount')
      return Number(value) / Number(scale)
    }
  }
}

/** Positive rational half-up rounding, without a floating point intermediate. */
export function roundRefundRatio(numerator: bigint, denominator: bigint): bigint {
  return (2n * numerator + denominator) / (2n * denominator)
}

/**
 * Remaining seller entitlement = original net minus cumulative rounded seller
 * refund share. Use this complement at settlement too: rounding the remaining
 * share independently would disagree by one minor unit at exact half-unit ties.
 */
export function remainingSellerEntitlement(
  captured: bigint, commission: bigint, refunded: bigint
): bigint {
  if (captured <= 0n || refunded >= captured || commission >= captured) return 0n
  const sellerNet = captured - commission
  return sellerNet - roundRefundRatio(sellerNet * refunded, captured)
}
