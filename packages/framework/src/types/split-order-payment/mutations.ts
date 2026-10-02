export type CreateSplitOrderPaymentsDTO = {
  order_id: string
  status: string
  currency_code: string
  authorized_amount: number
  payment_collection_id: string
}

export type UpdateSplitOrderPaymentsDTO = {
  id: string
  status?: string
  authorized_amount?: number
  captured_amount?: number
  refunded_amount?: number
}

export type RefundSplitOrderPaymentsDTO = {
  id: string
  amount: number
  /** Stable business operation reference for order accounting/reconciliation. */
  operation_id?: string
  /** Native payment identity, which must belong to the split's collection. */
  payment_id?: string
}
