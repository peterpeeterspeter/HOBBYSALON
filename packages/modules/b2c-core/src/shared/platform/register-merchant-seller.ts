import { randomUUID } from "node:crypto";

import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  toHandle,
} from "@medusajs/framework/utils";

import { MemberRole, SellerType } from "@mercurjs/framework";

import { SELLER_MODULE, SellerModuleService } from "../../modules/seller";
import { ensureSellerDefaultShippingProfile } from "./ensure-seller-default-shipping-profile";

export type RegisterMerchantSellerInput = {
  name: string;
  contact_name?: string | null;
  email: string;
  description?: string | null;
  phone?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  tax_id?: string | null;
};

export type RegisterMerchantSellerResult = {
  seller_id: string;
  seller_type: string;
  status: "created" | "existing";
};

const normalizeNullable = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildUniqueHandle = async (knex: any, name: string): Promise<string> => {
  const base = toHandle(name) || `merchant-${randomUUID().slice(0, 8)}`;
  const safeBase = base.slice(0, 64);

  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? "" : `-${i + 1}`;
    const candidate = `${safeBase}${suffix}`.slice(0, 80);

    const exists = await knex("seller")
      .select("id")
      .where("handle", candidate)
      .whereNull("deleted_at")
      .first();

    if (!exists) {
      return candidate;
    }
  }

  return `${safeBase}-${Date.now()}`.slice(0, 80);
};

async function ensureMerchantRequiredRecords(
  sellerService: SellerModuleService,
  seller: { id: string; email?: string | null; name: string },
  contactName?: string | null
) {
  // Persisted seller identity is authoritative, including on partial retries.
  const email = seller.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Merchant seller email is required to provision its owner");
  }

  const owners = await sellerService.listMembers({
    seller_id: seller.id,
    role: MemberRole.OWNER,
  });
  if (owners.some((owner) => owner.email?.trim().toLowerCase() !== email)) {
    throw new Error("Merchant owner identity conflict");
  }
  if (!owners.length) {
    await sellerService.createMembers({
      seller_id: seller.id,
      role: MemberRole.OWNER,
      email,
      name: normalizeNullable(contactName) ?? seller.name,
    });
  }

  const onboardings = await sellerService.listSellerOnboardings({
    seller_id: seller.id,
  });
  if (!onboardings.length) {
    await sellerService.createSellerOnboardings({ seller_id: seller.id });
  }
}

async function finalizeMerchantSeller(
  scope: MedusaContainer,
  sellerId: string,
  sellerType: string,
  status: "created" | "existing"
): Promise<RegisterMerchantSellerResult> {
  await ensureSellerDefaultShippingProfile(scope, sellerId);

  return {
    seller_id: sellerId,
    seller_type: sellerType,
    status,
  };
}

export async function registerMerchantSeller(
  scope: MedusaContainer,
  input: RegisterMerchantSellerInput
): Promise<RegisterMerchantSellerResult> {
  const email = input.email.trim().toLowerCase();
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  // Cross-process mutex around lookup AND repair. Service writes use their own
  // transactions; this transaction only owns the lock, released even on errors.
  // A failed service write remains repairable on the next serialized attempt.
  return knex.transaction(async (trx: { raw: (sql: string, values: string[]) => Promise<unknown> }) => {
    await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `merchant-registration:${email}`,
    ]);
    return registerMerchantSellerLocked(scope, { ...input, email });
  });
}

async function registerMerchantSellerLocked(
  scope: MedusaContainer,
  input: RegisterMerchantSellerInput
): Promise<RegisterMerchantSellerResult> {
  const email = input.email;
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Allow the same person to own a creator seller and a merchant seller.
  // Email is not unique at DB level; only block duplicate merchant sellers.
  const existingMerchant = await knex("seller")
    .select("id", "seller_type", "name", "email", "handle")
    .where("email", email)
    .where("seller_type", SellerType.MERCHANT)
    .whereNull("deleted_at")
    .first();

  if (existingMerchant) {
    await ensureMerchantRequiredRecords(
      scope.resolve<SellerModuleService>(SELLER_MODULE),
      existingMerchant,
      input.contact_name
    );
    return finalizeMerchantSeller(
      scope,
      existingMerchant.id,
      existingMerchant.seller_type,
      "existing"
    );
  }

  const sellerService = scope.resolve<SellerModuleService>(SELLER_MODULE);
  const handle = await buildUniqueHandle(knex, input.name);

  const seller = await sellerService.createSellers({
    name: input.name,
    handle,
    seller_type: SellerType.MERCHANT,
    description: normalizeNullable(input.description),
    email,
    phone: normalizeNullable(input.phone),
    address_line: normalizeNullable(input.address_line),
    city: normalizeNullable(input.city),
    state: normalizeNullable(input.state),
    postal_code: normalizeNullable(input.postal_code),
    country_code: normalizeNullable(input.country_code) ?? "BE",
    tax_id: normalizeNullable(input.tax_id),
  });

  await ensureMerchantRequiredRecords(sellerService, seller, input.contact_name);

  return finalizeMerchantSeller(
    scope,
    seller.id,
    seller.seller_type,
    "created"
  );
}
