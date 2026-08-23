import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the P1-5 upload path_prefix fix (commit 70e3e595).
 *
 * Before the fix the storage path prefix came from client form data
 * (guarded only against ".."), letting any authenticated user plant files in
 * other users' or convention-based namespaces. The fix forces the prefix
 * server-side to uploads/<user.id>.
 *
 * The route module imports next/server and the real storage lib; both are
 * mocked. getAuthUser is mocked to control authentication.
 */

const h = vi.hoisted(() => {
  const state = {
    authUser: null as { id: string } | null,
    uploadedWithPrefix: [] as Array<{ fileField: unknown; pathPrefix: string }>,
    uploadResult: "https://cdn.example.com/media/whatever" as string,
    uploadError: null as Error | null,
  };
  return state;
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: unknown }) => ({
      json: async () => body,
      status: init?.status ?? 200,
      headers: init?.headers,
    }),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: async () => h.authUser,
}));

vi.mock("@/lib/storage/upload-image", () => ({
  getFileFromFormData: (formData: Map<string, unknown>, field: string) =>
    formData.get(field) ?? null,
  uploadImageFile: async (file: unknown, pathPrefix: string) => {
    h.uploadedWithPrefix.push({ fileField: file, pathPrefix });
    if (h.uploadError) throw h.uploadError;
    return h.uploadResult;
  },
}));

import { POST } from "@/app/api/upload-image/route";

function makeRequest(formData: Map<string, unknown>): Request {
  const map = formData;
  return {
    formData: async () => ({
      get: (key: string) => map.get(key) ?? null,
    }),
  } as unknown as Request;
}

const FILE = { name: "photo.jpg", size: 1000 };

describe("POST /api/upload-image — P1-5 forced path prefix", () => {
  beforeEach(() => {
    h.authUser = { id: "user-123" };
    h.uploadedWithPrefix = [];
    h.uploadError = null;
    h.uploadResult = "https://cdn.example.com/media/whatever";
  });

  it("ignores a client-supplied path_prefix and uses uploads/<user.id>", async () => {
    const formData = new Map<string, unknown>([
      ["file", FILE],
      ["path_prefix", "creators/someone-else/avatar"],
    ]);

    const response = await POST(makeRequest(formData));
    expect(response.status).toBe(200);

    expect(h.uploadedWithPrefix).toHaveLength(1);
    expect(h.uploadedWithPrefix[0].pathPrefix).toBe("uploads/user-123");
  });

  it("uses the same forced namespace when no path_prefix is sent", async () => {
    const response = await POST(
      makeRequest(new Map([["file", FILE]]))
    );

    expect(response.status).toBe(200);
    expect(h.uploadedWithPrefix[0].pathPrefix).toBe("uploads/user-123");
  });

  it("still requires authentication", async () => {
    h.authUser = null;

    const response = await POST(
      makeRequest(
        new Map<string, unknown>([
          ["file", FILE],
          ["path_prefix", "x"],
        ])
      )
    );

    expect(response.status).toBe(401);
    expect(h.uploadedWithPrefix).toHaveLength(0);
  });

  it("rejects requests without a file", async () => {
    const response = await POST(makeRequest(new Map()));

    expect(response.status).toBe(400);
    expect(h.uploadedWithPrefix).toHaveLength(0);
  });
});
