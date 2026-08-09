import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows";

import { SELLER_MODULE } from "@mercurjs/b2c-core/modules/seller";
import { createLocationFulfillmentSetAndAssociateWithSellerWorkflow } from "@mercurjs/b2c-core/workflows";
import { SELLER_SHIPPING_PROFILE_LINK } from "@mercurjs/framework";

/**
 * Ensure a merchant seller can offer storefront shipping options.
 *
 * HobbyPop (and some other sellers) only had a pickup fulfillment set
 * without service zones / shipping options, so checkout returned
 * "Geen verzendopties beschikbaar".
 *
 * Run:
 *   npx medusa exec ./src/scripts/fixes/fix-seller-shipping.ts
 */

const EUROPE_COUNTRIES = [
  "be",
  "nl",
  "de",
  "dk",
  "se",
  "fr",
  "es",
  "it",
  "pl",
  "cz",
];

const SELLER_IDS = [
  "sel_01KY1XY4J7K8PKPAYQCPN2ZE8C", // HobbyPop
  "sel_01KYMQZ77T91EF3ATG4E8KQPMC", // 11380
  "sel_01KVQBR0EDRR2EYZQQMBC8ZRRC", // Peter Peeters
];

const SELLER_STOCK_LOCATION_LINK = "seller_stock_location";
const SELLER_FULFILLMENT_SET_LINK = "seller_fulfillment_set";

export default async function fixSellerShipping({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const {
    data: [region],
  } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
    filters: { name: "Europe" },
  });

  if (!region?.id) {
    throw new Error("Europe region not found");
  }

  for (const sellerId of SELLER_IDS) {
    const {
      data: [seller],
    } = await query.graph({
      entity: "seller",
      fields: ["id", "name"],
      filters: { id: sellerId },
    });

    if (!seller) {
      console.log(`skip missing seller ${sellerId}`);
      continue;
    }

    const { data: locationLinks } = await query.graph({
      entity: SELLER_STOCK_LOCATION_LINK,
      fields: ["stock_location_id", "stock_location.id", "stock_location.name"],
      filters: { seller_id: sellerId },
    });

    const locationId = locationLinks?.[0]?.stock_location_id as
      | string
      | undefined;

    if (!locationId) {
      console.log(`skip ${seller.name}: no stock location`);
      continue;
    }

    // Link manual fulfillment provider to location if missing
    const providerRows = await knex("location_fulfillment_provider")
      .where({ stock_location_id: locationId })
      .whereNull("deleted_at");

    if (!providerRows?.length) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      });
      console.log(`${seller.name}: linked manual_manual provider`);
    }

    // Find or create a shipping-type fulfillment set
    const { data: setLinks } = await query.graph({
      entity: SELLER_FULFILLMENT_SET_LINK,
      fields: [
        "fulfillment_set_id",
        "fulfillment_set.id",
        "fulfillment_set.name",
        "fulfillment_set.type",
        "fulfillment_set.service_zones.id",
      ],
      filters: { seller_id: sellerId },
    });

    let shippingSetId = (setLinks ?? []).find(
      (row: { fulfillment_set?: { type?: string } }) =>
        row.fulfillment_set?.type === "shipping"
    )?.fulfillment_set_id as string | undefined;

    if (!shippingSetId) {
      await createLocationFulfillmentSetAndAssociateWithSellerWorkflow.run({
        container,
        input: {
          location_id: locationId,
          seller_id: sellerId,
          fulfillment_set_data: {
            name: `${seller.name} shipping`,
            type: "shipping",
          },
        },
      });

      const { data: refreshed } = await query.graph({
        entity: SELLER_FULFILLMENT_SET_LINK,
        fields: ["fulfillment_set_id", "fulfillment_set.type"],
        filters: { seller_id: sellerId },
      });

      shippingSetId = (refreshed ?? []).find(
        (row: { fulfillment_set?: { type?: string } }) =>
          row.fulfillment_set?.type === "shipping"
      )?.fulfillment_set_id as string | undefined;

      if (!shippingSetId) {
        console.log(`skip ${seller.name}: could not create shipping set`);
        continue;
      }
      console.log(`${seller.name}: created shipping fulfillment set`);
    }

    // Service zone
    const fulfillmentService = container.resolve(Modules.FULFILLMENT);
    let [zone] = await fulfillmentService.listServiceZones({
      fulfillment_set: { id: shippingSetId },
    });

    if (!zone) {
      await createServiceZonesWorkflow.run({
        container,
        input: {
          data: [
            {
              fulfillment_set_id: shippingSetId,
              name: `${seller.name} Europe`,
              geo_zones: EUROPE_COUNTRIES.map((country_code) => ({
                type: "country" as const,
                country_code,
              })),
            },
          ],
        },
      });

      ;[zone] = await fulfillmentService.listServiceZones({
        fulfillment_set: { id: shippingSetId },
      });

      if (!zone) {
        console.log(`skip ${seller.name}: could not create service zone`);
        continue;
      }

      await link.create({
        [SELLER_MODULE]: { seller_id: sellerId },
        [Modules.FULFILLMENT]: { service_zone_id: zone.id },
      });
      console.log(`${seller.name}: created Europe service zone`);
    } else {
      // Ensure seller ↔ service zone link exists
      const zoneLink = await knex("seller_seller_fulfillment_service_zone")
        .where({ seller_id: sellerId, service_zone_id: zone.id })
        .whereNull("deleted_at")
        .first();
      if (!zoneLink) {
        await link.create({
          [SELLER_MODULE]: { seller_id: sellerId },
          [Modules.FULFILLMENT]: { service_zone_id: zone.id },
        });
      }
    }

    // Shipping option
    const existingOptions = await knex(
      "seller_seller_fulfillment_shipping_option as link"
    )
      .join("shipping_option as so", "so.id", "link.shipping_option_id")
      .where("link.seller_id", sellerId)
      .whereNull("link.deleted_at")
      .whereNull("so.deleted_at")
      .select("so.id", "so.name");

    if (existingOptions?.length) {
      console.log(
        `${seller.name}: already has shipping option ${existingOptions[0].id}`
      );
      continue;
    }

    const {
      data: [shippingProfile],
    } = await query.graph({
      entity: SELLER_SHIPPING_PROFILE_LINK,
      fields: ["shipping_profile_id"],
      filters: { seller_id: sellerId },
    });

    if (!shippingProfile?.shipping_profile_id) {
      console.log(`skip ${seller.name}: no shipping profile`);
      continue;
    }

    const {
      result: [shippingOption],
    } = await createShippingOptionsWorkflow.run({
      container,
      input: [
        {
          name: `${seller.name} verzending`,
          shipping_profile_id: shippingProfile.shipping_profile_id,
          service_zone_id: zone.id,
          provider_id: "manual_manual",
          type: {
            label: "Standaard verzending",
            code: "standard",
            description: "Verzending binnen Europa",
          },
          rules: [
            { value: "true", attribute: "enabled_in_store", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
          prices: [
            { currency_code: "eur", amount: 4.95 },
            { amount: 4.95, region_id: region.id },
          ],
          price_type: "flat",
          data: { id: "manual-fulfillment" },
        },
      ],
    });

    await link.create({
      [SELLER_MODULE]: { seller_id: sellerId },
      [Modules.FULFILLMENT]: { shipping_option_id: shippingOption.id },
    });

    console.log(
      `${seller.name}: created shipping option ${shippingOption.id} (€4.95)`
    );
  }
}
