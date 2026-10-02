import { ContainerRegistrationKeys, MathBN, MedusaError } from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'

import { SplitOrderPaymentDTO } from '@mercurjs/framework'

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
      fields: ['items.id', 'split_order_payment.*'],
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

    const captured_amount = MathBN.convert(orderPayment.captured_amount)
    const refunded_amount = MathBN.convert(orderPayment.refunded_amount)

    const payout_total = captured_amount
      .minus(refunded_amount)
      .minus(total_commission)

    return new StepResponse(payout_total)
  }
)
