import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { backfillSellerAuthForLink } from "@mercurjs/b2c-core/shared/platform/seller-auth-bridge";
import {
  createPlatformSupabaseClient,
  escapePostgrestValue,
} from "@mercurjs/b2c-core/shared/platform/supabase-rest-client";

type UserSellerLinkRow = {
  user_id: string;
  seller_id: string;
  seller_type: string;
};

type UserAccountRow = {
  user_id: string;
  email: string | null;
};

export default async function backfillSellerAuthIdentities({ container }: ExecArgs) {
  const supabase = createPlatformSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Missing PLATFORM_SUPABASE_URL / PLATFORM_SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const links = await supabase.get<UserSellerLinkRow>("user_seller_links", {
    select: "user_id,seller_id,seller_type",
    limit: "1000",
  });

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  let linked = 0;
  let skipped = 0;

  for (const link of links) {
    const accounts = await supabase.get<UserAccountRow>("user_accounts", {
      select: "user_id,email",
      user_id: `eq.${escapePostgrestValue(link.user_id)}`,
      limit: "1",
    });

    const email = accounts[0]?.email?.trim().toLowerCase();
    if (!email) {
      skipped += 1;
      logger.warn(
        `Skipping seller ${link.seller_id}: no email for user ${link.user_id}`
      );
      continue;
    }

    const result = await backfillSellerAuthForLink(container, {
      userId: link.user_id,
      email,
      sellerId: link.seller_id,
    });

    if (result.ok) {
      linked += 1;
      logger.info(
        `Linked seller auth for user ${link.user_id} -> member ${result.member_id}`
      );
    } else {
      skipped += 1;
      logger.warn(
        `Skipped seller ${link.seller_id} for user ${link.user_id}: ${result.reason}`
      );
    }
  }

  logger.info(
    `Seller auth backfill complete. linked=${linked} skipped=${skipped} total=${links.length}`
  );
}
