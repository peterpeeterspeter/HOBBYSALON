import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * EC06 — one commission line per order line item (replay-safe).
 */
export class Migration20261002140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index if not exists "IDX_commission_line_item_line_id_unique" on "commission_line" ("item_line_id") where deleted_at is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_commission_line_item_line_id_unique";`
    );
  }
}
