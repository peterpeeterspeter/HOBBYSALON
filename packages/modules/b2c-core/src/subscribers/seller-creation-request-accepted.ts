import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import {
  CreateMemberDTO,
  CreateSellerDTO,
  MemberRole,
  SellerType,
  StoreStatus,
  RequestDTO,
  SellerAccountRequestUpdatedEvent,
} from "@mercurjs/framework";

import { createSellerWorkflow } from "../workflows";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";

const SellerCreationRequestPayload = z.object({
  member: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.nativeEnum(MemberRole).optional(),
    bio: z.string().optional(),
    photo: z.string().optional(),
    phone: z.string().optional(),
  }),
  seller: z.object({
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    address_line: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    country_code: z.string().nullable().optional(),
    tax_id: z.string().nullable().optional(),
    handle: z.string().optional(),
    photo: z.string().nullable().optional(),
    seller_type: z.nativeEnum(SellerType).optional(),
    store_status: z.nativeEnum(StoreStatus).optional(),
  }),
  auth_identity_id: z.string(),
});

export default async function sellerCreationRequestAcceptedHandler({
  event,
  container,
}: SubscriberArgs<RequestDTO>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const request = event.data;
  const payload = SellerCreationRequestPayload.parse(request.data);

  const { result: seller } = await createSellerWorkflow.run({
    container,
    input: {
      member: payload.member as Omit<CreateMemberDTO, "seller_id">,
      seller: payload.seller as CreateSellerDTO,
      auth_identity_id: payload.auth_identity_id,
    },
  });

  logger.info(
    `Seller creation request accepted: ${request.id}, seller: ${seller.id}`
  );
}

export const config: SubscriberConfig = {
  event: SellerAccountRequestUpdatedEvent.ACCEPTED,
  context: {
    subscriberId: "seller-creation-request-accepted-handler",
  },
};
