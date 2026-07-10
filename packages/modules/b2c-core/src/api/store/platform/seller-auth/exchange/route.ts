import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";

import { exchangePlatformSellerAuth } from "../../../../../shared/platform/seller-auth-bridge";

function extractBearerToken(req: MedusaRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length ? token : null;
}

/**
 * @oas [post] /store/platform/seller-auth/exchange
 * operationId: "StoreExchangePlatformSellerAuth"
 * summary: "Exchange Supabase session for seller JWT"
 * description: "Validates a Supabase access token, links seller auth if needed, and returns a Medusa seller JWT for the vendor panel."
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

  const result = await exchangePlatformSellerAuth(req.scope, accessToken);

  res.json(result);
};
