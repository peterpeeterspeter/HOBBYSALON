import Stripe from "stripe";

import { ConfigModule, Logger } from "@medusajs/framework/types";
import { MedusaError, isPresent } from "@medusajs/framework/utils";

import { PAYOUT_MODULE } from "..";

import {
  CreatePayoutAccountInput,
  CreatePayoutAccountResponse,
  IPayoutProvider,
  InitializeOnboardingResponse,
  PayoutWebhookAction,
  PayoutWebhookActionPayload,
  ProcessPayoutInput,
  ProcessPayoutResponse,
  ReversePayoutInput,
  getSmallestUnit,
} from "@mercurjs/framework";

type InjectedDependencies = {
  logger: Logger;
  configModule: ConfigModule;
};

type StripeConnectConfig = {
  apiKey: string;
  webhookSecret: string;
};

type AccountsV2CreateResponse = {
  id: string;
  [key: string]: unknown;
};

type AccountLinkV2Response = {
  url?: string;
  [key: string]: unknown;
};

/**
 * Marketplace connected-account provider (Accounts v2).
 *
 * Creates Express dashboard recipient accounts and Account Links for KYC,
 * then pays sellers via Transfers (multi-seller carts use separate charges
 * + transfers in Mercur; single-destination Checkout is supported separately).
 */
export class PayoutProvider implements IPayoutProvider {
  protected readonly config_: StripeConnectConfig;
  protected readonly logger_: Logger;
  protected readonly client_: Stripe;

  /** Dummy Stripe key for CI/seed when STRIPE_SECRET_API_KEY is not set. Allows module to load but API calls will fail. */
  private static readonly DUMMY_STRIPE_KEY = "sk_test_CI_DUMMY_NO_REAL_CALLS";

  constructor({ logger, configModule }: InjectedDependencies) {
    this.logger_ = logger;

    const moduleDef = configModule.modules?.[PAYOUT_MODULE];
    if (typeof moduleDef !== "boolean" && moduleDef?.options) {
      this.config_ = {
        apiKey:
          (process.env.STRIPE_SECRET_API_KEY as string) ||
          PayoutProvider.DUMMY_STRIPE_KEY,
        webhookSecret:
          (process.env
            .STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET as string) || "",
      };
    } else {
      this.config_ = {
        apiKey: PayoutProvider.DUMMY_STRIPE_KEY,
        webhookSecret: "",
      };
    }

    // Default client for Transfers / v1 retrieve / webhooks.
    // Accounts v2 calls pass Stripe-Version: 2026-07-29.preview explicitly.
    this.client_ = new Stripe(this.config_.apiKey);
  }

  /** Preview API version required for Accounts v2 create/link (see Stripe marketplace docs). */
  private static readonly ACCOUNTS_V2_VERSION = "2026-07-29.preview";

  async createPayout({
    amount,
    currency,
    account_reference_id,
    transaction_id,
    source_transaction,
  }: ProcessPayoutInput): Promise<ProcessPayoutResponse> {
    try {
      this.logger_.info(
        `Processing payout for transaction with ID ${transaction_id}`
      );

      const transfer = await this.client_.transfers.create(
        {
          currency,
          destination: account_reference_id,
          amount: getSmallestUnit(amount, currency),
          source_transaction,
          metadata: {
            transaction_id,
          },
        },
        { idempotencyKey: transaction_id }
      );

      return {
        data: transfer as unknown as Record<string, unknown>,
      };
    } catch (error) {
      this.logger_.error("Error occured while creating payout", error);

      const message = error?.message ?? "Error occured while creating payout";

      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message);
    }
  }

  /**
   * Create a marketplace connected account (Accounts v2 recipient + Express).
   * Persisted id is returned as `id` for `payout_account.reference_id`.
   */
  async createPayoutAccount({
    context,
    account_id,
  }: CreatePayoutAccountInput): Promise<CreatePayoutAccountResponse> {
    try {
      const { country, contact_email, display_name } = context as {
        country?: string;
        contact_email?: string;
        display_name?: string;
      };
      this.logger_.info("Creating marketplace connected account (Accounts v2)");

      if (!isPresent(country)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `"country" is required`
        );
      }

      const account = await this.createConnectedAccount({
        country: country as string,
        contactEmail:
          typeof contact_email === "string" && contact_email.trim()
            ? contact_email.trim()
            : undefined,
        displayName:
          typeof display_name === "string" && display_name.trim()
            ? display_name.trim()
            : "Hobbysalon verkoper",
        payoutAccountId: account_id,
      });

      return {
        data: account as unknown as Record<string, unknown>,
        id: account.id,
      };
    } catch (error) {
      const message =
        error?.message ?? "Error occured while creating payout account";
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message);
    }
  }

  /**
   * Create a Stripe-hosted Account Link for KYC / Express onboarding (Accounts v2).
   */
  async initializeOnboarding(
    accountId: string,
    context: Record<string, unknown>
  ): Promise<InitializeOnboardingResponse> {
    try {
      this.logger_.info("Initializing connected account onboarding");

      if (!isPresent(context.refresh_url)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `'refresh_url' is required`
        );
      }

      if (!isPresent(context.return_url)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `'return_url' is required`
        );
      }

      const payoutAccountId = context.payout_account_id as string | undefined;
      const accountLink = await this.createAccountOnboardingLink({
        accountId,
        refreshUrl: context.refresh_url as string,
        returnUrl: context.return_url as string,
        idempotencyKey: payoutAccountId
          ? `${payoutAccountId}_onboarding`
          : undefined,
      });

      return {
        data: accountLink as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message =
        error?.message ?? "Error occured while initializing onboarding";
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message);
    }
  }

  async getAccount(accountId: string): Promise<Stripe.Account> {
    try {
      // Prefer Accounts v2 retrieve so recipient capability status is available.
      const account = (await this.client_.rawRequest(
        "GET",
        `/v2/core/accounts/${accountId}`,
        {
          include: [
            "configuration.recipient",
            "identity",
            "requirements",
          ],
        },
        {
          additionalHeaders: {
            "Stripe-Version": PayoutProvider.ACCOUNTS_V2_VERSION,
          },
        }
      )) as unknown as Stripe.Account;
      return account;
    } catch {
      try {
        const account = await this.client_.accounts.retrieve(accountId);
        return account;
      } catch (error) {
        const message = error?.message ?? "Error occured while getting account";
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message);
      }
    }
  }

  /**
   * True when the connected account can receive marketplace transfers.
   * Prefers Accounts v2 recipient capability when present on the account payload.
   */
  isRecipientTransfersActive(account: Stripe.Account | Record<string, unknown>): boolean {
    const asRecord = account as Record<string, unknown>;
    const configuration = asRecord.configuration as
      | {
          recipient?: {
            capabilities?: {
              stripe_balance?: {
                stripe_transfers?: { status?: string };
              };
            };
          };
        }
      | undefined;

    const v2Status =
      configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers
        ?.status;
    if (v2Status) {
      return v2Status === "active";
    }

    const v1 = account as Stripe.Account;
    return Boolean(
      v1.details_submitted &&
        v1.payouts_enabled &&
        v1.charges_enabled &&
        v1.tos_acceptance?.date
    );
  }

  async reversePayout(input: ReversePayoutInput) {
    try {
      const reversal = await this.client_.transfers.createReversal(
        input.transfer_id,
        {
          amount: getSmallestUnit(input.amount, input.currency),
        }
      );

      return reversal;
    } catch (error) {
      const message = error?.message ?? "Error occured while reversing payout";
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message);
    }
  }

  async getWebhookActionAndData(payload: PayoutWebhookActionPayload) {
    const signature = payload.headers["stripe-signature"] as string;

    const event = this.client_.webhooks.constructEvent(
      payload.rawData as string | Buffer,
      signature,
      this.config_.webhookSecret
    );

    const eventType = event.type as string;

    // Accounts v2 capability updates (thin / Event Destinations) + legacy account.updated
    if (
      eventType ===
        "v2.core.account[configuration.recipient].capability_status_updated" ||
      eventType === "account.updated"
    ) {
      const data = event.data.object as {
        id?: string;
        metadata?: { account_id?: string };
      };

      const payoutAccountId = data.metadata?.account_id;
      if (!payoutAccountId) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Stripe account ${data.id ?? "unknown"} missing metadata.account_id`
        );
      }

      return {
        action: PayoutWebhookAction.ACCOUNT_AUTHORIZED,
        data: {
          account_id: payoutAccountId,
        },
      };
    }

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Unsupported event type: ${event.type}`
    );
  }

  private async createConnectedAccount(input: {
    country: string;
    contactEmail?: string;
    displayName: string;
    payoutAccountId: string;
  }): Promise<AccountsV2CreateResponse> {
    try {
      // Accounts v2 — marketplace recipient + Express dashboard
      // https://docs.stripe.com/connect/marketplace
      const account = (await this.client_.rawRequest(
        "POST",
        "/v2/core/accounts",
        {
          display_name: input.displayName,
          contact_email: input.contactEmail,
          dashboard: "express",
          identity: {
            country: input.country.toUpperCase(),
          },
          defaults: {
            responsibilities: {
              losses_collector: "application",
              fees_collector: "application",
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: {
                  stripe_transfers: { requested: true },
                },
              },
            },
          },
          include: [
            "configuration.recipient",
            "identity",
            "requirements",
          ],
        },
        {
          idempotencyKey: `payout_account_${input.payoutAccountId}`,
          additionalHeaders: {
            "Stripe-Version": PayoutProvider.ACCOUNTS_V2_VERSION,
          },
        }
      )) as unknown as AccountsV2CreateResponse;

      // Persist payout_account id on the Stripe account for webhook resolution.
      await this.client_.accounts.update(account.id, {
        metadata: {
          account_id: input.payoutAccountId,
        },
      });

      return {
        ...account,
        metadata: { account_id: input.payoutAccountId },
      };
    } catch (error) {
      // BE platforms historically failed recipient-only ToS for domestic accounts.
      // Fall back to controller-style Express (v1) with transfers + card_payments.
      const message = String(error?.message ?? error ?? "");
      const isRecipientUnsupported =
        message.toLowerCase().includes("recipient") ||
        message.toLowerCase().includes("tos");

      if (!isRecipientUnsupported) {
        throw error;
      }

      this.logger_.warn(
        `Accounts v2 recipient create failed (${message}); falling back to Express v1 create`
      );

      const legacy = await this.client_.accounts.create(
        {
          country: input.country,
          controller: {
            stripe_dashboard: { type: "express" },
            fees: { payer: "application" },
            losses: { payments: "application" },
            requirement_collection: "stripe",
          },
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
          },
          business_type: "individual",
          email: input.contactEmail,
          metadata: {
            account_id: input.payoutAccountId,
          },
        },
        { idempotencyKey: `payout_account_v1_${input.payoutAccountId}` }
      );

      return legacy as unknown as AccountsV2CreateResponse;
    }
  }

  private async createAccountOnboardingLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
    idempotencyKey?: string;
  }): Promise<AccountLinkV2Response> {
    try {
      const link = (await this.client_.rawRequest(
        "POST",
        "/v2/core/account_links",
        {
          account: input.accountId,
          use_case: {
            type: "account_onboarding",
            account_onboarding: {
              configurations: ["recipient"],
              refresh_url: input.refreshUrl,
              return_url: input.returnUrl,
            },
          },
        },
        {
          ...(input.idempotencyKey
            ? { idempotencyKey: input.idempotencyKey }
            : {}),
          additionalHeaders: {
            "Stripe-Version": PayoutProvider.ACCOUNTS_V2_VERSION,
          },
        }
      )) as unknown as AccountLinkV2Response;

      return link;
    } catch (error) {
      this.logger_.warn(
        `Accounts v2 account link failed (${String(error?.message ?? error)}); falling back to v1 Account Links`
      );

      const legacy = await this.client_.accountLinks.create(
        {
          account: input.accountId,
          refresh_url: input.refreshUrl,
          return_url: input.returnUrl,
          type: "account_onboarding",
        },
        input.idempotencyKey
          ? { idempotencyKey: `${input.idempotencyKey}_v1` }
          : undefined
      );

      return legacy as unknown as AccountLinkV2Response;
    }
  }
}
