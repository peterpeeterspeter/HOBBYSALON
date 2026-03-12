import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260312123000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "merchant_feed_source" ("id" text not null, "seller_id" text not null, "name" text not null, "provider" text check ("provider" in ('custom_csv', 'custom_json', 'woocommerce', 'shopify')) not null default 'custom_csv', "url" text not null, "method" text check ("method" in ('GET', 'POST')) not null default 'GET', "headers" jsonb not null default '{}'::jsonb, "mapping" jsonb not null default '{}'::jsonb, "default_currency" text null, "default_location_id" text null, "active" boolean not null default true, "last_pulled_at" timestamptz null, "last_pull_status" text check ("last_pull_status" in ('success', 'failed')) null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merchant_feed_source_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "idx_merchant_feed_source_seller_id" on "merchant_feed_source" ("seller_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_merchant_feed_source_active" on "merchant_feed_source" ("active") where "deleted_at" is null;`);
    this.addSql(`alter table if exists "merchant_feed_source" add constraint "merchant_feed_source_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "merchant_feed_source" drop constraint if exists "merchant_feed_source_seller_id_foreign";`);
    this.addSql(`drop table if exists "merchant_feed_source" cascade;`);
  }

}
