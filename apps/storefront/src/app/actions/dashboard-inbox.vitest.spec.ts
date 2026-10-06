import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: { id: "user-owner" } as { id: string } | null,
  creator: { id: "creator-owner" } as { id: string } | null,
  calls: [] as Array<{ table: string; payload: unknown; filters: Array<[string, unknown]> }>,
  matchedRows: 1,
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw Object.assign(new Error(url), { digest: "NEXT_REDIRECT;replace;" + url });
  },
}));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: async () => h.user }));
vi.mock("@/lib/platform/queries/creators", () => ({
  getCreatorByUserId: async () => h.creator,
}));
vi.mock("@/lib/platform/client", () => ({
  createPlatformClient: () => ({
    from: (table: string) => {
      const call = { table, payload: null as unknown, filters: [] as Array<[string, unknown]> };
      h.calls.push(call);
      const builder = {
        update(payload: unknown) {
          call.payload = payload;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        select: async () => ({
          data: Array.from({ length: h.matchedRows }, () => ({ id: "x" })),
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

import { updateInboxItemStatusAction } from "./dashboard-inbox";

const ID = "11111111-1111-4111-8111-111111111111";
const WORKSHOP = "22222222-2222-4222-8222-222222222222";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function run(values: Record<string, string>): Promise<string> {
  try {
    await updateInboxItemStatusAction(form(values));
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected redirect");
}

describe("updateInboxItemStatusAction", () => {
  beforeEach(() => {
    h.user = { id: "user-owner" };
    h.creator = { id: "creator-owner" };
    h.calls = [];
    h.matchedRows = 1;
  });

  it.each([
    ["creatie", "product_inquiries", "creator_id"],
    ["workshop", "workshop_booking_requests", "creator_id"],
    ["event", "event_vendor_inquiries", "organizer_creator_id"],
  ])("scopes %s updates to the signed-in creator", async (source, table, ownerColumn) => {
    const url = await run({ source, id: ID, status: "contacted" });
    expect(url).toContain("/dashboard?success=");
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].table).toBe(table);
    expect(h.calls[0].payload).toEqual({ status: "contacted" });
    expect(h.calls[0].filters).toEqual([
      ["id", ID],
      [ownerColumn, "creator-owner"],
    ]);
  });

  it("accepts only the statuses each table allows", async () => {
    expect(await run({ source: "workshop", id: ID, status: "confirmed" })).toContain("success=");
    expect(await run({ source: "workshop", id: ID, status: "accepted" })).toContain("error=");
    expect(await run({ source: "event", id: ID, status: "accepted" })).toContain("success=");
    expect(await run({ source: "event", id: ID, status: "confirmed" })).toContain("error=");
    expect(h.calls).toHaveLength(2);
  });

  it("returns to the item page of the same source, never elsewhere", async () => {
    expect(
      await run({
        source: "workshop",
        id: ID,
        status: "confirmed",
        return_to: `/dashboard/workshops/${WORKSHOP}`,
      })
    ).toContain(`/dashboard/workshops/${WORKSHOP}?success=`);
    for (const evil of [
      "https://evil.example",
      "//evil.example",
      `/dashboard/events/${WORKSHOP}`,
      `/dashboard/workshops/${WORKSHOP}/x`,
      "/beheer/rollen",
    ]) {
      expect(
        await run({ source: "workshop", id: ID, status: "confirmed", return_to: evil })
      ).toMatch(/^\/dashboard\?success=/);
    }
  });

  it("reports an error when the row belongs to someone else", async () => {
    h.matchedRows = 0;
    const url = await run({ source: "creatie", id: ID, status: "contacted" });
    expect(url).toContain("/dashboard?error=");
  });

  it("rejects unknown sources, bad ids and bad statuses without touching the database", async () => {
    for (const values of [
      { source: "orders", id: ID, status: "contacted" },
      { source: "creatie", id: "not-a-uuid", status: "contacted" },
      { source: "creatie", id: ID, status: "deleted" },
    ]) {
      const url = await run(values);
      expect(url).toContain("/dashboard?error=");
    }
    expect(h.calls).toHaveLength(0);
  });

  it("requires login", async () => {
    h.user = null;
    const url = await run({ source: "creatie", id: ID, status: "contacted" });
    expect(url).toBe("/login?next=/dashboard");
    expect(h.calls).toHaveLength(0);
  });
});
