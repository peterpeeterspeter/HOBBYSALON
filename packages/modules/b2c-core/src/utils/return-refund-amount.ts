export type ReturnRefundLine = {
  line_item_id: string
  quantity: number
}

type PaidOrderLine = {
  id: string
  quantity: number | string
  /** Actual discounted, tax-inclusive merchandise total in major currency units. */
  total?: number | string
}

type ReturnRefundAmountInput = {
  items: readonly PaidOrderLine[]
  returnLines: readonly ReturnRefundLine[]
  currencyCode: string
  /** An explicit reduction is allowed, but cannot exceed the selected merchandise. */
  requestedRefundAmount?: number
}

// Convert a finite decimal into an exact ratio before multiplying/dividing. This
// avoids binary floating-point half-cent errors and rounds only the final share.
function positiveDecimal(value: unknown): [bigint, bigint] {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value)) ||
    !Number.isFinite(Number(value)) || Number(value) <= 0
  ) {
    throw new Error('Return refund requires a positive paid line total or amount')
  }
  const decimal = typeof value === 'number' ? value.toString() : value
  // Preserve provider/native decimal strings; Number(value) can move a value
  // across a half-cent boundary before the proportional refund is rounded.
  const [mantissa, exponent = '0'] = decimal.split(/e/i)
  const [whole, fraction = ''] = mantissa.split('.')
  const shift = Number(exponent) - fraction.length
  // Bound bigint work on inputs without silently rounding accepted amounts.
  if (decimal.length > 4096 || !Number.isSafeInteger(shift) || Math.abs(shift) > 4096) {
    throw new Error('Return refund decimal precision exceeds safe bounds')
  }
  const coefficient = BigInt(whole + fraction)
  return shift >= 0
    ? [coefficient * 10n ** BigInt(shift), 1n]
    : [coefficient, 10n ** BigInt(-shift)]
}

/**
 * Refund only explicitly selected units of paid merchandise, never shipping or
 * the remaining captured balance. Round each selected line share half-up to the
 * currency's minor unit, then sum integer minor units. No cumulative return
 * ledger or cross-request rounding-residue policy is implied by this helper.
 */
export function calculateReturnRefundAmount(input: ReturnRefundAmountInput): number {
  if (!Array.isArray(input.returnLines) || input.returnLines.length === 0) {
    throw new Error('Return refund requires explicit return lines')
  }
  if (typeof input.currencyCode !== 'string' || !/^[a-z]{3}$/i.test(input.currencyCode)) {
    throw new Error('Return refund requires a currency code')
  }
  const digits = new Intl.NumberFormat('en', {
    style: 'currency', currency: input.currencyCode.toUpperCase()
  }).resolvedOptions().maximumFractionDigits
  if (digits === undefined) {
    throw new Error('Unable to resolve return refund currency precision')
  }
  const scale = 10n ** BigInt(digits)
  const ids = new Set<string>()
  let totalMinor = 0n

  for (const line of input.returnLines) {
    if (!line || typeof line.line_item_id !== 'string' || !line.line_item_id.trim()) {
      throw new Error('Return refund requires a line item ID')
    }
    if (ids.has(line.line_item_id)) {
      throw new Error('Duplicate return line item ID')
    }
    ids.add(line.line_item_id)
    const matches = input.items.filter((item) => item.id === line.line_item_id)
    if (matches.length !== 1) {
      throw new Error('Unknown or ambiguous return line item ID')
    }
    const item = matches[0]
    const purchasedQuantity = Number(item.quantity)
    if (
      !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
      !Number.isSafeInteger(purchasedQuantity) || purchasedQuantity <= 0 ||
      line.quantity > purchasedQuantity
    ) {
      throw new Error('Invalid or excessive return quantity')
    }
    const [quantityNumerator, quantityDenominator] = positiveDecimal(item.quantity)
    if (quantityNumerator !== BigInt(purchasedQuantity) * quantityDenominator) {
      throw new Error('Invalid or excessive return quantity')
    }
    const [paidNumerator, paidDenominator] = positiveDecimal(item.total)
    const numerator = paidNumerator * scale * BigInt(line.quantity)
    const denominator = paidDenominator * BigInt(purchasedQuantity)
    const lineMinor = (2n * numerator + denominator) / (2n * denominator)
    if (lineMinor <= 0n) {
      throw new Error('Selected return line has no refundable amount at currency precision')
    }
    totalMinor += lineMinor
  }

  if (totalMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Return refund amount exceeds safe currency precision')
  }
  if (input.requestedRefundAmount !== undefined) {
    if (typeof input.requestedRefundAmount !== 'number') {
      throw new Error('Explicit return refund amount must be a number')
    }
    const [numerator, denominator] = positiveDecimal(input.requestedRefundAmount)
    const scaled = numerator * scale
    if (scaled % denominator !== 0n || scaled / denominator > totalMinor) {
      throw new Error('Explicit return refund exceeds selected merchandise or currency precision')
    }
    totalMinor = scaled / denominator
  }
  return Number(totalMinor) / Number(scale)
}
