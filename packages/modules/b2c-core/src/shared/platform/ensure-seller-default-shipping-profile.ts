import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import { createShippingProfilesWorkflow } from "@medusajs/medusa/core-flows";

import { SELLER_MODULE } from "../../modules/seller";
import sellerShippingProfile from "../../links/seller-shipping-profile";

type SellerShippingProfileRelation = {
  shipping_profile?: {
    id?: string;
    type?: string | null;
  } | null;
};

export async function ensureSellerDefaultShippingProfile(
  scope: MedusaContainer,
  sellerId: string
): Promise<string | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const link = scope.resolve(ContainerRegistrationKeys.LINK);

  const { data: shippingProfiles } = await query.graph({
    entity: sellerShippingProfile.entryPoint,
    fields: ["shipping_profile.id", "shipping_profile.type"],
    filters: {
      seller_id: sellerId,
    },
  });

  const relations = (shippingProfiles ?? []) as SellerShippingProfileRelation[];
  const defaultProfile = relations.find(
    (relation) => relation.shipping_profile?.type === "default"
  )?.shipping_profile;

  if (defaultProfile?.id) {
    return defaultProfile.id;
  }

  const fallbackProfile = relations.find(
    (relation) => relation.shipping_profile?.id
  )?.shipping_profile;

  if (fallbackProfile?.id) {
    return fallbackProfile.id;
  }

  const { result } = await createShippingProfilesWorkflow.run({
    container: scope,
    input: {
      data: [
        {
          type: "default",
          name: `${sellerId}:Default shipping profile`,
        },
      ],
    },
  });

  const createdProfileId = result?.[0]?.id;
  if (!createdProfileId) {
    return null;
  }

  await link.create({
    [SELLER_MODULE]: {
      seller_id: sellerId,
    },
    [Modules.FULFILLMENT]: {
      shipping_profile_id: createdProfileId,
    },
  });

  return createdProfileId;
}
