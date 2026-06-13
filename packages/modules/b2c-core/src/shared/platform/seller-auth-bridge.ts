import { randomBytes } from "node:crypto";

import jwt from "jsonwebtoken";

import { MedusaContainer } from "@medusajs/framework";
import { ConfigModule } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows";
import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";

import { StoreStatus } from "@mercurjs/framework";

import {
  createPlatformSupabaseClient,
  escapePostgrestValue,
} from "./supabase-rest-client";
import { verifySupabaseAccessToken } from "./supabase-auth";

type UserSellerLinkRow = {
  seller_id: string;
  seller_type: string;
};

type MemberRow = {
  id: string;
  seller_id: string;
  email: string;
  name: string;
};

type SellerRow = {
  id: string;
  email: string;
  store_status: string;
};

const linkSellerAuthWorkflow = createWorkflow(
  "link-platform-seller-auth",
  function (input: { authIdentityId: string; memberId: string }) {
    setAuthAppMetadataStep({
      authIdentityId: input.authIdentityId,
      actorType: "seller",
      value: input.memberId,
    });

    return new WorkflowResponse({ linked: true });
  }
);

async function findAuthIdentityByEmail(
  container: MedusaContainer,
  email: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: identities } = await query.graph({
    entity: "auth_identity",
    fields: ["id", "app_metadata"],
    filters: {
      provider_identities: {
        entity_id: email,
        provider: "emailpass",
      },
    },
  });

  return identities[0] ?? null;
}

async function ensureAuthIdentityForEmail(
  container: MedusaContainer,
  email: string,
  memberId: string
) {
  let identity = await findAuthIdentityByEmail(container, email);

  const authService = container.resolve(Modules.AUTH);

  if (!identity) {
    const randomPassword = randomBytes(32).toString("hex");
    const { authIdentity } = await authService.register("emailpass", {
      body: {
        email,
        password: randomPassword,
      },
    });

    if (!authIdentity?.id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Failed to create seller auth identity."
      );
    }

    identity = { id: authIdentity.id, app_metadata: authIdentity.app_metadata };
  }

  const currentActorId = identity.app_metadata?.seller_id as string | undefined;
  if (currentActorId !== memberId) {
    await linkSellerAuthWorkflow(container).run({
      input: {
        authIdentityId: identity.id,
        memberId,
      },
    });
  }

  return identity.id;
}

function generateSellerJwt(
  container: MedusaContainer,
  authIdentityId: string,
  memberId: string
) {
  const {
    projectConfig: { http },
  } = container.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE);

  const payload = {
    actor_id: memberId,
    actor_type: "seller",
    auth_identity_id: authIdentityId,
    app_metadata: {
      seller_id: memberId,
    },
  };

  return jwt.sign(payload, http.jwtSecret!, {
    expiresIn: "7d",
  });
}

export type SellerAuthExchangeResult = {
  token: string;
  seller_id: string;
  member_id: string;
  seller_type: string;
};

export async function exchangePlatformSellerAuth(
  container: MedusaContainer,
  accessToken: string
): Promise<SellerAuthExchangeResult> {
  const supabaseUser = await verifySupabaseAccessToken(accessToken);
  if (!supabaseUser) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Invalid or expired Supabase session."
    );
  }

  const supabase = createPlatformSupabaseClient();
  if (!supabase) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Platform Supabase is not configured on the backend."
    );
  }

  const links = await supabase.get<UserSellerLinkRow>("user_seller_links", {
    select: "seller_id,seller_type",
    user_id: `eq.${escapePostgrestValue(supabaseUser.id)}`,
    limit: "1",
  });

  if (!links.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No seller is linked to this account."
    );
  }

  const link = links[0];
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const seller = (await knex("seller")
    .select("id", "email", "store_status")
    .where("id", link.seller_id)
    .whereNull("deleted_at")
    .first()) as SellerRow | undefined;

  if (!seller) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Seller record not found."
    );
  }

  if (seller.store_status !== StoreStatus.ACTIVE) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Seller store is not active."
    );
  }

  const member = (await knex("member")
    .select("id", "seller_id", "email", "name")
    .where("seller_id", link.seller_id)
    .whereRaw("lower(email) = ?", [supabaseUser.email])
    .whereNull("deleted_at")
    .first()) as MemberRow | undefined;

  let resolvedMember = member;

  if (!resolvedMember) {
    resolvedMember = (await knex("member")
      .select("id", "seller_id", "email", "name")
      .where("seller_id", link.seller_id)
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")
      .first()) as MemberRow | undefined;
  }

  if (!resolvedMember) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No seller member found for this account."
    );
  }

  const authIdentityId = await ensureAuthIdentityForEmail(
    container,
    supabaseUser.email,
    resolvedMember.id
  );

  const token = generateSellerJwt(
    container,
    authIdentityId,
    resolvedMember.id
  );

  return {
    token,
    seller_id: link.seller_id,
    member_id: resolvedMember.id,
    seller_type: link.seller_type,
  };
}

export async function backfillSellerAuthForLink(
  container: MedusaContainer,
  input: { userId: string; email: string; sellerId: string }
) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const member = (await knex("member")
    .select("id", "seller_id", "email", "name")
    .where("seller_id", input.sellerId)
    .whereRaw("lower(email) = ?", [input.email.trim().toLowerCase()])
    .whereNull("deleted_at")
    .first()) as MemberRow | undefined;

  if (!member) {
    return { ok: false, reason: "member_not_found" as const };
  }

  await ensureAuthIdentityForEmail(container, input.email, member.id);

  return {
    ok: true,
    member_id: member.id,
    seller_id: input.sellerId,
  };
}
