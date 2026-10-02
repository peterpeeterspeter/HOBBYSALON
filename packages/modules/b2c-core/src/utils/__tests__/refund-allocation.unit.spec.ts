import { allocateRefundAndReversal } from '../refund-allocation'

describe('allocateRefundAndReversal', () => {
  it('does not reverse more than the remaining seller transfer', () => {
    const result = allocateRefundAndReversal({
      capturedAmount: 100,
      alreadyRefundedAmount: 0,
      transferredAmount: 90,
      alreadyReversedAmount: 0,
      commissionAmount: 10,
      requestedCustomerRefund: 100
    })

    expect(result.customerRefund).toBe(100)
    expect(result.sellerReversal).toBe(90)
  })

  it('reverses nothing when no transfer has been made', () => {
    const result = allocateRefundAndReversal({
      capturedAmount: 100,
      alreadyRefundedAmount: 0,
      transferredAmount: 0,
      alreadyReversedAmount: 0,
      commissionAmount: 10,
      requestedCustomerRefund: 50
    })

    expect(result.customerRefund).toBe(50)
    expect(result.sellerReversal).toBe(0)
  })

  it('caps customer refund at remaining refundable balance', () => {
    const result = allocateRefundAndReversal({
      capturedAmount: 100,
      alreadyRefundedAmount: 40,
      transferredAmount: 90,
      alreadyReversedAmount: 36,
      commissionAmount: 10,
      requestedCustomerRefund: 100
    })

    expect(result.customerRefund).toBe(60)
    expect(result.sellerReversal).toBe(54)
  })

  it('handles partial refund after transfer', () => {
    const result = allocateRefundAndReversal({
      capturedAmount: 100,
      alreadyRefundedAmount: 0,
      transferredAmount: 90,
      alreadyReversedAmount: 0,
      commissionAmount: 10,
      requestedCustomerRefund: 50
    })

    expect(result.customerRefund).toBe(50)
    expect(result.sellerReversal).toBeLessThanOrEqual(90)
    expect(result.sellerReversal).toBe(45)
  })
})
