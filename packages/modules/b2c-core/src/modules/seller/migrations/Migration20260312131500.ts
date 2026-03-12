import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260312131500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "merchant_feed_source" add column if not exists "auto_pull_enabled" boolean not null default false;`);
    this.addSql(`alter table if exists "merchant_feed_source" add column if not exists "pull_interval_minutes" integer null;`);
    this.addSql(`alter table if exists "merchant_feed_source" add column if not exists "last_sync_job_id" text null;`);
    this.addSql(`update "merchant_feed_source" set "pull_interval_minutes" = coalesce("pull_interval_minutes", 60) where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_merchant_feed_source_auto_pull" on "merchant_feed_source" ("auto_pull_enabled") where "deleted_at" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_merchant_feed_source_auto_pull";`);
    this.addSql(`alter table if exists "merchant_feed_source" drop column if exists "last_sync_job_id";`);
    this.addSql(`alter table if exists "merchant_feed_source" drop column if exists "pull_interval_minutes";`);
    this.addSql(`alter table if exists "merchant_feed_source" drop column if exists "auto_pull_enabled";`);
  }

}
