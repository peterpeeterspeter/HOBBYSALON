import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  Modules,
  OrderWorkflowEvents,
} from "@medusajs/framework/utils";

import { ResendNotificationTemplates } from "../providers/resend";
import { fetchStoreData } from "@mercurjs/framework";

export default async function sellerNewOrderHandler({
  event,
  container,
}: SubscriberArgs<{ order_ids: string[] }>) {
  const notificationService = container.resolve(Modules.NOTIFICATION);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeData = await fetchStoreData(container);
  const errors: unknown[] = [];

  for (const orderId of event.data.order_ids) {
    try {
      const {
        data: [order],
      } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "items.*",
          "seller.email",
          "seller.name",
          "seller.id",
          "customer.first_name",
          "customer.last_name",
        ],
        filters: {
          id: orderId,
        },
      });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const sellerEmail = order.seller?.email;
      if (!sellerEmail) {
        throw new Error(`Seller email not found for order: ${order.id}`);
      }

      const customer_name = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`;
      await notificationService.createNotifications([
        {
          to: sellerEmail,
          channel: "email",
          template: ResendNotificationTemplates.SELLER_NEW_ORDER,
          // Native notification idempotency skips successful sends on event retry.
          idempotency_key: `seller-new-order:${order.id}`,
          content: {
            subject: `New order #${order.display_id} received`,
          },
          data: {
            data: {
              order_id: order.id,
              order,
              customer_name,
              seller_name: order.seller?.name || "",
              store_name: storeData.store_name,
              storefront_url: storeData.storefront_url,
            },
          },
        },
      ]);
    } catch (error) {
      console.error(
        `Error processing seller notification for order ${orderId}:`,
        error
      );
      errors.push(error);
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, "Failed to process seller order notifications");
  }
}

export const config: SubscriberConfig = {
  event: OrderWorkflowEvents.PLACED,
  context: {
    subscriberId: "seller-new-order-handler-resend",
  },
};
