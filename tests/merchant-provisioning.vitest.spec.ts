import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@medusajs/framework", () => ({}));
vi.mock("@medusajs/framework/utils", () => ({
  ContainerRegistrationKeys: { PG_CONNECTION: "pg_connection" },
  toHandle: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}));
vi.mock("@mercurjs/framework", () => ({
  MemberRole: { OWNER: "owner" },
  SellerType: { MERCHANT: "merchant" },
}));
vi.mock("../packages/modules/b2c-core/src/modules/seller", () => ({
  SELLER_MODULE: "seller_service",
}));
vi.mock("../packages/modules/b2c-core/src/shared/platform/ensure-seller-default-shipping-profile", () => ({
  ensureSellerDefaultShippingProfile: vi.fn().mockResolvedValue(undefined),
}));

import { registerMerchantSeller } from "../packages/modules/b2c-core/src/shared/platform/register-merchant-seller";
import { ensureSellerDefaultShippingProfile } from "../packages/modules/b2c-core/src/shared/platform/ensure-seller-default-shipping-profile";

type Row = Record<string, any>;
const input = { name: "Craft shop", email: "  OWNER@example.com  ", contact_name: "Owner" };
let sellers: Row[];
let members: Row[];
let onboardings: Row[];
let service: ReturnType<typeof makeService>;
let scope: Parameters<typeof registerMerchantSeller>[0];

function makeService() {
  const matches = (row: Row, filter: Row) => Object.entries(filter).every(([key, value]) => row[key] === value);
  return {
    createSellers: vi.fn(async (data: Row) => {
      const seller = { ...data, id: "seller-1" };
      sellers.push(seller);
      return seller;
    }),
    listMembers: vi.fn(async (filter: Row) => members.filter((row) => matches(row, filter))),
    listSellerOnboardings: vi.fn(async (filter: Row) => onboardings.filter((row) => matches(row, filter))),
    createMembers: vi.fn(async (data: Row) => {
      const member = { ...data, id: `member-${members.length}` };
      members.push(member);
      return member;
    }),
    createSellerOnboardings: vi.fn(async (data: Row) => {
      const onboarding = { ...data, id: `onboarding-${onboardings.length}` };
      onboardings.push(onboarding);
      return onboarding;
    }),
    updateMembers: vi.fn(),
  };
}

function seedSeller() {
  sellers.push({ id: "seller-1", seller_type: "merchant", email: "owner@example.com", name: "Stored shop", handle: "stored-shop" });
}
function seedOwner(email = "owner@example.com") {
  members.push({ id: "owner-1", seller_id: "seller-1", role: "owner", email });
}

beforeEach(() => {
  vi.clearAllMocks();
  sellers = [];
  members = [];
  onboardings = [];
  service = makeService();
  const knex = vi.fn((table: string) => {
    expect(table).toBe("seller");
    const filters: Array<(row: Row) => boolean> = [];
    const query = {
      select: (..._columns: string[]) => query,
      where: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      whereNull: (key: string) => { filters.push((row) => row[key] == null); return query; },
      first: async () => sellers.find((row) => filters.every((filter) => filter(row))),
    };
    return query;
  });
  // Model a DB transaction-scoped advisory mutex, including release on error.
  const locks = new Map<string, Promise<void>>();
  Object.assign(knex, { transaction: async (run: (trx: Row) => Promise<unknown>) => {
    let release: (() => void) | undefined;
    const trx = { raw: async (sql: string, bindings: string[]) => {
      expect(sql).toContain("pg_advisory_xact_lock");
      const key = bindings[0];
      expect(key).toBe("merchant-registration:owner@example.com");
      const previous = locks.get(key) ?? Promise.resolve();
      locks.set(key, new Promise<void>((resolve) => { release = resolve; }));
      await previous;
    } };
    try { return await run(trx); } finally { release?.(); }
  } });
  scope = { resolve: (key: string) => {
    if (key === "pg_connection") return knex;
    if (key === "seller_service") return service;
    throw new Error(`Unexpected dependency: ${key}`);
  } } as unknown as typeof scope;
});

describe("merchant provisioning retries (actual backend implementation)", () => {
  it.each([false, true])("serializes concurrent registrations and repair (%s)", async (existing) => {
    if (existing) seedSeller();
    await Promise.all([
      registerMerchantSeller(scope, input),
      registerMerchantSeller(scope, { ...input, email: "owner@example.com" }),
    ]);
    expect(sellers).toHaveLength(1);
    expect(members).toHaveLength(1);
    expect(onboardings).toHaveLength(1);
  });

  it("creates a new merchant, owner, onboarding and shipping profile", async () => {
    await expect(registerMerchantSeller(scope, input)).resolves.toEqual({ seller_id: "seller-1", seller_type: "merchant", status: "created" });
    expect(sellers).toHaveLength(1);
    expect(members).toEqual([expect.objectContaining({ seller_id: "seller-1", role: "owner", email: "owner@example.com" })]);
    expect(onboardings).toHaveLength(1);
    expect(ensureSellerDefaultShippingProfile).toHaveBeenCalledWith(scope, "seller-1");
  });

  it("leaves an already complete merchant unchanged", async () => {
    seedSeller(); seedOwner(" OWNER@example.com ");
    onboardings.push({ seller_id: "seller-1" });
    await expect(registerMerchantSeller(scope, input)).resolves.toMatchObject({ status: "existing" });
    expect(service.createSellers).not.toHaveBeenCalled();
    expect(service.createMembers).not.toHaveBeenCalled();
    expect(service.createSellerOnboardings).not.toHaveBeenCalled();
    expect(ensureSellerDefaultShippingProfile).toHaveBeenCalledOnce();
  });

  it("repairs missing owner and onboarding after member creation fails, without duplicating on another retry", async () => {
    service.createMembers.mockRejectedValueOnce(new Error("member unavailable"));
    await expect(registerMerchantSeller(scope, input)).rejects.toThrow("member unavailable");
    expect(sellers).toHaveLength(1);
    expect(ensureSellerDefaultShippingProfile).not.toHaveBeenCalled();
    await expect(registerMerchantSeller(scope, input)).resolves.toMatchObject({ status: "existing" });
    await registerMerchantSeller(scope, input);
    expect(service.createSellers).toHaveBeenCalledOnce();
    expect(service.createMembers).toHaveBeenCalledTimes(2);
    expect(members).toHaveLength(1);
    expect(onboardings).toHaveLength(1);
    expect(service.createSellerOnboardings).toHaveBeenCalledOnce();
  });

  it("repairs failed onboarding without duplicating the previously created owner", async () => {
    service.createSellerOnboardings.mockRejectedValueOnce(new Error("onboarding unavailable"));
    await expect(registerMerchantSeller(scope, input)).rejects.toThrow("onboarding unavailable");
    expect(members).toHaveLength(1);
    expect(ensureSellerDefaultShippingProfile).not.toHaveBeenCalled();
    await registerMerchantSeller(scope, input);
    await registerMerchantSeller(scope, input);
    expect(service.createSellers).toHaveBeenCalledOnce();
    expect(service.createMembers).toHaveBeenCalledOnce();
    expect(service.createSellerOnboardings).toHaveBeenCalledTimes(2);
    expect(onboardings).toHaveLength(1);
  });

  it.each([false, true])("refuses an unrelated owner even if a matching owner also exists (%s)", async (matchingOwner) => {
    seedSeller();
    if (matchingOwner) seedOwner();
    seedOwner("unrelated@example.com");
    await expect(registerMerchantSeller(scope, input)).rejects.toThrow(/owner.*conflict|conflict.*owner/i);
    expect(service.createMembers).not.toHaveBeenCalled();
    expect(service.updateMembers).not.toHaveBeenCalled();
    expect(service.createSellerOnboardings).not.toHaveBeenCalled();
    expect(ensureSellerDefaultShippingProfile).not.toHaveBeenCalled();
  });

  it("does not elevate an unrelated existing membership when repairing an owner", async () => {
    seedSeller();
    members.push({ id: "staff-1", seller_id: "seller-1", role: "member", email: "staff@example.com" });
    await registerMerchantSeller(scope, input);
    expect(members).toHaveLength(2);
    expect(members[0].role).toBe("member");
    expect(members[1]).toMatchObject({ role: "owner", email: "owner@example.com" });
    expect(service.updateMembers).not.toHaveBeenCalled();
  });

  it("uses the persisted seller email, not request email, for new owner identity", async () => {
    service.createSellers.mockImplementationOnce(async (data: Row) => {
      const seller = { ...data, id: "seller-1", email: " Stored@example.com " };
      sellers.push(seller);
      return seller;
    });
    await registerMerchantSeller(scope, input);
    expect(members[0].email).toBe("stored@example.com");
  });
});
