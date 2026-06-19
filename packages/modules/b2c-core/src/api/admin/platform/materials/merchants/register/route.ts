import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "zod";

import { registerMerchantSeller } from "../../../../../../shared/platform/register-merchant-seller";

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

/**
 * @oas [post] /admin/platform/materials/merchants/register
 * operationId: "AdminRegisterMerchantSeller"
 * summary: "Register Merchant Seller"
 * description: "Creates or returns a merchant seller with an owner member."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = RegisterMerchantPayload.safeParse(req.body || {});
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }

  const merchant = await registerMerchantSeller(req.scope, parsed.data);
  const statusCode = merchant.status === "created" ? 201 : 200;

  res.status(statusCode).json({ merchant });
};
