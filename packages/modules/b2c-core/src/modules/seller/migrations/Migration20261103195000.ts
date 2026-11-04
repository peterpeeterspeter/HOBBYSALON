import { Migration } from '@mikro-orm/migrations';

export class Migration20261103195000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`create table if not exists "seller_shipping_policy" (
      "id" text not null, "seller_id" text not null references "seller"("id"),
      "country_code" text not null check (country_code in ('be','nl')),
      "currency_code" text not null default 'eur' check (currency_code = 'eur'),
      "free_shipping_threshold" numeric null check (free_shipping_threshold >= 0),
      "raw_free_shipping_threshold" jsonb null,
      "shipping_option_ids" text[] not null default '{}',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "seller_shipping_policy_pkey" primary key ("id")
    );`);
    this.addSql(
      `create unique index if not exists "IDX_seller_shipping_policy_country" on "seller_shipping_policy" ("seller_id", "country_code") where "deleted_at" is null;`
    );
  }
  async down(): Promise<void> {
    this.addSql('drop table if exists "seller_shipping_policy" cascade;');
  }
}
