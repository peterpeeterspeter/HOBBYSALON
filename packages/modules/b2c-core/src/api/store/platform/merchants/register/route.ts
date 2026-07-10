import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "zod";

import { registerMerchantSeller } from "../../../../../shared/platform/register-merchant-seller";
import { verifySupabaseAccessToken } from "../../../../../shared/platform/supabase-auth";

const RegisterMerchantPayload = z.object({
  name: z.string().trim().min(1),
  contact_name: z.string().trim().optional().nullable(),
  email: z.string().trim().email(),
  description: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address_line: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  postal_code: z.string().trim().optional().nullable(),
  country_code: z.string().trim().optional().nullable(),
  tax_id: z.string().trim().optional().nullable(),
});

function extractBearerToken(req: MedusaRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length ? token : null;
}

/**
 * @oas [post] /store/platform/merchants/register
 * operationId: "StoreRegisterMerchantSeller"
 * summary: "Register merchant seller for authenticated Supabase user"
 * description: "Validates a Supabase access token and creates or returns a merchant seller for the account email."
 * x-authenticated: false
 * tags:
 *   - Store Platform
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Missing Supabase bearer token."
    );
  }

  const supabaseUser = await verifySupabaseAccessToken(accessToken);
  if (!supabaseUser?.email) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Invalid or expired Supabase session."
    );
  }

  const parsed = RegisterMerchantPayload.safeParse(req.body || {});
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }

  const payload = parsed.data;
  if (payload.email.trim().toLowerCase() !== supabaseUser.email.toLowerCase()) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Merchant email must match the authenticated account."
    );
  }

  const merchant = await registerMerchantSeller(req.scope, payload);
  const statusCode = merchant.status === "created" ? 201 : 200;

  res.status(statusCode).json({ merchant });
};
