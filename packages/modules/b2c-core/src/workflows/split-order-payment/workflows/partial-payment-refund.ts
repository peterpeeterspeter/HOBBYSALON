import {
  ContainerRegistrationKeys,
  MathBN,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk";
import {
  addOrderTransactionStep,
  refundPaymentsStep,
} from "@medusajs/medusa/core-flows";

import { RefundSplitOrderPaymentsDTO } from "@mercurjs/framework";

import orderSplitOrderPayment from "../../../links/order-split-order-payment";

export const selectAndValidatePaymentRefundStep = createStep(
  "select-and-validate-payment-refund-step",
  async function (input: RefundSplitOrderPaymentsDTO, { container }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid refund amount");
    }
    for (const key of ["operation_id", "payment_id"] as const) {
      if (input[key] !== undefined &&
          (typeof input[key] !== "string" || !input[key]!.trim())) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid ${key} identity`);
      }
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const {
      data: [splitPayment],
    } = await query.graph({
      entity: orderSplitOrderPayment.entryPoint,
      fields: ["*", "split_order_payment.payment_collection_id", "split_order_payment.currency_code"],
      filters: {
        split_order_payment_id: input.id,
      },
    });
    if (!splitPayment?.order_id || !splitPayment.split_order_payment?.payment_collection_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Split payment collection not found");
    }

    const {
      data: [payment_collection],
    } = await query.graph({
      entity: "payment_collection",
      fields: ["id", "currency_code", "payments.id"],
      filters: {
        id: splitPayment.split_order_payment.payment_collection_id,
      },
    });
    if (!payment_collection || payment_collection.id !== splitPayment.split_order_payment.payment_collection_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment collection not found");
    }

    const currency = splitPayment.split_order_payment.currency_code;
    if (typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency) ||
        payment_collection.currency_code?.toLowerCase() !== currency.toLowerCase()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid or mismatched refund currency");
    }
    const currency_code = currency.toLowerCase();
    const digits = new Intl.NumberFormat("en", {
      style: "currency", currency: currency_code.toUpperCase(),
    }).resolvedOptions().maximumFractionDigits;
    if (digits === undefined) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid refund currency precision");
    }
    const minorAmount = MathBN.mult(input.amount, 10 ** digits);
    if (!minorAmount.isInteger() || MathBN.gt(minorAmount, Number.MAX_SAFE_INTEGER)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid refund amount precision or range");
    }

    const collectionPaymentIds = (payment_collection.payments || []).map((payment) => payment.id);
    if (input.payment_id !== undefined && !collectionPaymentIds.includes(input.payment_id)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment does not belong to the split payment collection");
    }
    const paymentIds = input.payment_id !== undefined ? [input.payment_id] : collectionPaymentIds;
    if (!paymentIds.length || new Set(paymentIds).size !== paymentIds.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No unique payments in the payment collection");
    }

    // Explicit identities are looked up only after collection membership checks.
    // Legacy callers may proceed only with one remaining captured payment.
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: [
        "id",
        "currency_code",
        "canceled_at",
        "refunds.id",
        "refunds.amount",
        "captures.id",
        "captures.amount",
      ],
      filters: { id: paymentIds },
    });
    if (payments.length !== paymentIds.length || new Set(payments.map((payment) => payment.id)).size !== paymentIds.length ||
        payments.some((payment) => !paymentIds.includes(payment.id))) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment collection records are incomplete or mismatched");
    }

    const validateAmount = (value: Parameters<typeof MathBN.convert>[0]) => {
      const amount = MathBN.convert(value);
      if (value == null || !amount.isFinite() || MathBN.lt(amount, 0)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid captured or refunded payment amount");
      }
      return amount;
    };
    const eligible = payments.map((payment) => {
      if (typeof payment.currency_code !== "string" || payment.currency_code.toLowerCase() !== currency_code) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment refund currency mismatch");
      }
      const capturedAmount = (payment.captures || []).reduce(
        (acc, capture) => MathBN.sum(acc, validateAmount(capture.amount)), MathBN.convert(0)
      );
      const refundedAmount = (payment.refunds || []).reduce(
        (acc, refund) => MathBN.sum(acc, validateAmount(refund.amount)), MathBN.convert(0)
      );
      const refundableAmount = MathBN.sub(capturedAmount, refundedAmount);
      if (MathBN.lt(refundableAmount, 0)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid refundable payment amount");
      }
      return { payment, refundableAmount };
    }).filter(({ payment, refundableAmount }) => !payment.canceled_at && MathBN.gt(refundableAmount, 0));

    if (eligible.length !== 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        eligible.length ? "Ambiguous refundable payments; specify payment_id" : "No eligible captured payment to refund"
      );
    }
    const { payment, refundableAmount } = eligible[0];
    if (MathBN.gt(input.amount, refundableAmount)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Payment with id ${payment.id} is trying to refund amount greater than the refundable amount`
      );
    }

    return new StepResponse({
      payment_id: payment.id,
      currency_code,
      amount: input.amount,
      order_id: splitPayment.order_id,
    });
  }
);

export const partialPaymentRefundWorkflow = createWorkflow(
  {
    name: "partial-payment-refund",
  },
  function (input: RefundSplitOrderPaymentsDTO) {
    const paymentToRefund = selectAndValidatePaymentRefundStep(input);

    const refundedPayments = refundPaymentsStep(
      transform({ input, paymentToRefund }, ({ input, paymentToRefund }) => {
        return [
          {
            payment_id: paymentToRefund.payment_id,
            amount: paymentToRefund.amount,
            // Native refund notes aid manual reconciliation. They are not a
            // provider idempotency contract and are not assumed to be forwarded.
            ...(input.operation_id === undefined ? {} : {
              note: `Split order payment refund operation: ${input.operation_id}`,
            }),
          },
        ];
      })
    );

    const orderTransaction = transform(
      { input, paymentToRefund, refundedPayments },
      ({ input, paymentToRefund, refundedPayments }) => {
        // Medusa 2.11.3 refundPaymentsStep catches individual refund errors and
        // returns only successful PaymentDTOs. An empty result is NOT success.
        if (!Array.isArray(refundedPayments) || refundedPayments.length !== 1 ||
            refundedPayments[0]?.id !== paymentToRefund.payment_id ||
            refundedPayments[0]?.currency_code?.toLowerCase() !== paymentToRefund.currency_code) {
          throw new MedusaError(MedusaError.Types.INVALID_DATA, "Native payment refund did not return the expected successful payment");
        }
        return {
          order_id: paymentToRefund.order_id,
          amount: MathBN.mult(paymentToRefund.amount, -1),
          currency_code: paymentToRefund.currency_code,
          reference_id: input.operation_id ?? paymentToRefund.payment_id,
          reference: "refund",
        };
      }
    );

    addOrderTransactionStep(orderTransaction);

    return new WorkflowResponse(refundedPayments);
  }
);
