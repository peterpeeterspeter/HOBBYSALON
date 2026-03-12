import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260312140000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "merchant_feed_pull_run" ("id" text not null, "seller_id" text not null, "feed_source_id" text not null, "trigger_type" text check ("trigger_type" in ('manual', 'scheduled')) not null default 'manual', "status" text check ("status" in ('processing', 'success', 'partial', 'failed')) not null default 'processing', "total_count" integer not null default 0, "accepted_count" integer not null default 0, "rejected_count" integer not null default 0, "sync_job_id" text null, "error_preview" jsonb not null default '[]'::jsonb, "error_message" text null, "started_at" timestamptz not null default now(), "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merchant_feed_pull_run_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "idx_merchant_feed_pull_run_feed_source_id" on "merchant_feed_pull_run" ("feed_source_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_merchant_feed_pull_run_seller_id" on "merchant_feed_pull_run" ("seller_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_merchant_feed_pull_run_status" on "merchant_feed_pull_run" ("status") where "deleted_at" is null;`);
    this.addSql(`alter table if exists "merchant_feed_pull_run" add constraint "merchant_feed_pull_run_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "merchant_feed_pull_run" add constraint "merchant_feed_pull_run_feed_source_id_foreign" foreign key ("feed_source_id") references "merchant_feed_source" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "merchant_feed_pull_run" drop constraint if exists "merchant_feed_pull_run_feed_source_id_foreign";`);
    this.addSql(`alter table if exists "merchant_feed_pull_run" drop constraint if exists "merchant_feed_pull_run_seller_id_foreign";`);
    this.addSql(`drop table if exists "merchant_feed_pull_run" cascade;`);
  }

}
