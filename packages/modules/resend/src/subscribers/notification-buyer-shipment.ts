import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  FulfillmentWorkflowEvents,
  Modules,
} from "@medusajs/framework/utils";

import { Hosts, buildHostAddress, fetchStoreData } from "@mercurjs/framework";

import { ResendNotificationTemplates } from "../providers/resend";

type ShipmentCreatedPayload = {
  id?: string;
  no_notification?: boolean;
};

/**
 * EC14 — email buyer when a shipment is created (Resend template already existed;
 * this subscriber was missing).
 */
export default async function orderShipmentCreatedHandler({
  event,
  container,
}: SubscriberArgs<ShipmentCreatedPayload>) {
  const notificationService = container.resolve(Modules.NOTIFICATION);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeData = await fetchStoreData(container);

  const fulfillmentId = event.data.id;
  if (!fulfillmentId || event.data.no_notification) {
    return;
  }

  try {
    const {
      data: [fulfillment],
    } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "order.id", "labels.*"],
      filters: {
        id: fulfillmentId,
      },
    });

    const orderId = fulfillment?.order?.id;
    if (!orderId) {
      return;
    }

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
        "fulfillments.*",
        "fulfillments.labels.*",
        "order_set.*",
        "summary.*",
      ],
      filters: {
        id: orderId,
      },
    });

    if (!order?.email) {
      return;
    }

    const matchedFulfillment =
      (order.fulfillments ?? []).find(
        (f: { id?: string }) => f.id === fulfillmentId
      ) ?? fulfillment;

    const label = matchedFulfillment?.labels?.[0];
    const trackingNumber =
      label?.tracking_number ||
      label?.tracking_url ||
      String(order.display_id ?? order.id);

    const orderSetId = order.order_set?.id ?? order.id;
    const orderUrl = buildHostAddress(
      Hosts.STOREFRONT,
      `/account/orders/${orderSetId}`
    ).toString();

    await notificationService.createNotifications({
      to: order.email,
      channel: "email",
      template: ResendNotificationTemplates.BUYER_ORDER_SHIPPED,
      content: {
        subject: `Je bestelling #${order.display_id} is verzonden`,
      },
      data: {
        data: {
          user_name: order.customer?.first_name || "Klant",
          host: storeData.storefront_url,
          order_id: order.id,
          order: {
            ...order,
            display_id: order.display_id,
            trackingNumber,
            total: order.summary?.current_order_total || 0,
            email: order.email,
          },
          order_address: orderUrl,
          store_name: storeData.store_name,
          storefront_url: storeData.storefront_url,
        },
      },
    });
  } catch (error) {
    console.error(
      `Error processing buyer shipment notification for fulfillment ${fulfillmentId}:`,
      error
    );
  }
}

export const config: SubscriberConfig = {
  event: FulfillmentWorkflowEvents.SHIPMENT_CREATED,
  context: {
    subscriberId: "order-shipment-created-handler-resend",
  },
};
