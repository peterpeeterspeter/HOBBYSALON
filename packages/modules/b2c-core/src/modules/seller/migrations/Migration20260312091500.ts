import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260312091500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "merchant_category_mapping" ("id" text not null, "seller_id" text not null, "source_category" text not null, "source_category_normalized" text not null, "product_category_id" text not null, "confidence" real null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merchant_category_mapping_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "idx_mcm_seller_id" on "merchant_category_mapping" ("seller_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_mcm_product_category_id" on "merchant_category_mapping" ("product_category_id") where "deleted_at" is null;`);
    this.addSql(`create unique index if not exists "uq_mcm_seller_source" on "merchant_category_mapping" ("seller_id", "source_category_normalized") where "deleted_at" is null;`);
    this.addSql(`alter table if exists "merchant_category_mapping" add constraint "merchant_category_mapping_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "merchant_category_mapping" drop constraint if exists "merchant_category_mapping_seller_id_foreign";`);
    this.addSql(`drop table if exists "merchant_category_mapping" cascade;`);
  }

}
