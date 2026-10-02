import { ContainerRegistrationKeys, MathBN, MedusaError } from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'

import { SplitOrderPaymentDTO } from '@mercurjs/framework'
import { refundMoney, remainingSellerEntitlement } from '../../../utils/refund-money'

export const calculatePayoutForOrderStep = createStep(
  'calculate-payout-for-order',
  async (
    input: {
      order_id: string
    },
    { container }
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [order]
    } = await query.graph({
      entity: 'order',
      fields: ['items.id', 'currency_code', 'split_order_payment.*'],
      filters: {
        id: input.order_id
      }
    })

    const order_line_items = (order.items ?? []).map((i) => i.id)

    const { data: commission_lines } = await query.graph({
      entity: 'commission_line',
      fields: ['*'],
      filters: {
        item_line_id: order_line_items
      }
    })

    // Commission must be calculated before transfer (including explicit zero-fee lines).
    // Missing lines mean commission is not ready — do not treat as zero and overpay the seller.
    if (
      order_line_items.length > 0 &&
      (!commission_lines || commission_lines.length === 0)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Commission not ready for order ${input.order_id}`
      )
    }

    const covered = new Set(
      (commission_lines ?? []).map((line) => line.item_line_id)
    )
    const missing = order_line_items.filter((id) => !covered.has(id))
    if (missing.length > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Commission not ready for order ${input.order_id}: missing lines`
      )
    }

    const total_commission = commission_lines.reduce((acc, current) => {
      return MathBN.add(acc, current.value)
    }, MathBN.convert(0))

    const orderPayment: SplitOrderPaymentDTO = order.split_order_payment

    const money = refundMoney(order.currency_code)
    // Reduce the original commission proportionally with refunds. Derive the
    // retained seller amount using the allocator's cumulative rounding policy,
    // so refund-before-transfer and refund-after-transfer have identical net.
    const payout_total = MathBN.convert(money.fromMinor(remainingSellerEntitlement(
      money.toMinor(Number(orderPayment.captured_amount)),
      money.toMinor(Number(total_commission)),
      money.toMinor(Number(orderPayment.refunded_amount))
    )))

    return new StepResponse(payout_total)
  }
)
