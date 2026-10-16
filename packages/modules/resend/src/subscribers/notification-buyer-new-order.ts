import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  Modules,
  OrderWorkflowEvents,
} from "@medusajs/framework/utils";

import { ResendNotificationTemplates } from "../providers/resend";

import { Hosts, buildHostAddress, fetchStoreData } from "@mercurjs/framework";

export default async function orderCreatedHandler({
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
          "*",
          "customer.*",
          "items.*",
          "shipping_address.*",
          "shipping_methods.*",
          "summary.*",
          "order_set.*",
        ],
        filters: {
          id: orderId,
        },
      });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const orderUrl = buildHostAddress(
        Hosts.STOREFRONT,
        `/account/orders/${order.order_set?.id ?? order.id}`
      ).toString();

      await notificationService.createNotifications({
        to: order.email,
        channel: "email",
        template: ResendNotificationTemplates.BUYER_NEW_ORDER,
        // Native notification idempotency skips successful sends on event retry.
        idempotency_key: `buyer-new-order:${order.id}`,
        content: {
          subject: `Order Confirmation - #${order.display_id}`,
        },
        data: {
          data: {
            user_name: order.customer?.first_name || "Customer",
            order_id: order.id,
            order_address: orderUrl,
            order: {
              ...order,
              display_id: order.display_id,
              total: order.summary?.current_order_total || 0,
            },
            store_name: storeData.store_name,
            storefront_url: storeData.storefront_url,
          },
        },
      });
    } catch (error) {
      console.error(
        `Error processing buyer notification for order ${orderId}:`,
        error
      );
      errors.push(error);
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, "Failed to process buyer order notifications");
  }
}

export const config: SubscriberConfig = {
  event: OrderWorkflowEvents.PLACED,
  context: {
    subscriberId: "order-created-handler-resend",
  },
};
