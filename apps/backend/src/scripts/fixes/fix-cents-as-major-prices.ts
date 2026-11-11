import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Fix prices that were written as cents into Medusa v2 (major-unit) fields.
 *
 * Symptom on the storefront: €24,99 shows as €2.499,00 because
 * calculated_amount=2499 is then ×100 again for PriceDisplay.
 *
 * Safe heuristic: whole-number EUR amounts ≥ 200 are almost certainly
 * mistaken cents (demo sneakers are 39–119; real imports use decimals like 9.99).
 *
 * Run on the VPS / against production Medusa DB:
 *   npx medusa exec ./src/scripts/fixes/fix-cents-as-major-prices.ts
 * Dry run:
 *   DRY_RUN=1 npx medusa exec ./src/scripts/fixes/fix-cents-as-major-prices.ts
 */

const CENTS_AS_MAJOR_MIN = 200

export default async function fixCentsAsMajorPrices({ container }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true"

  const rows: Array<{
    id: string
    amount: string | number
    currency_code: string
    raw_amount: unknown
  }> = await knex("price")
    .select("id", "amount", "currency_code", "raw_amount")
    .whereNull("deleted_at")
    .where("amount", ">=", CENTS_AS_MAJOR_MIN)
    .whereRaw("amount = trunc(amount)")

  logger.info(
    `Found ${rows.length} whole-number price(s) ≥ ${CENTS_AS_MAJOR_MIN} (likely cents-as-major)`
  )

  let updated = 0
  for (const row of rows) {
    const before = Number(row.amount)
    const after = Math.round(before) / 100
    logger.info(
      `${dryRun ? "[dry-run] " : ""}${row.id} ${row.currency_code}: ${before} → ${after}`
    )
    if (dryRun) continue

    // Keep raw_amount in sync when present (Medusa big-number shape).
    const raw =
      row.raw_amount && typeof row.raw_amount === "object"
        ? {
            ...(row.raw_amount as Record<string, unknown>),
            value: String(after),
          }
        : row.raw_amount

    await knex("price")
      .where({ id: row.id })
      .update({
        amount: after,
        ...(raw !== undefined ? { raw_amount: raw } : {}),
        updated_at: knex.fn.now(),
      })
    updated += 1
  }

  logger.info(
    dryRun
      ? `Dry run complete — would update ${rows.length} price(s). Re-run without DRY_RUN=1 to apply.`
      : `Updated ${updated} price(s).`
  )
}
