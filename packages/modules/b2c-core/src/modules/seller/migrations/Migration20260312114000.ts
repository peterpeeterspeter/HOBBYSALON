import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260312114000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_sync_job" ("id" text not null, "seller_id" text not null, "submitter_id" text not null, "status" text check ("status" in ('queued', 'processing', 'completed', 'completed_with_errors', 'failed')) not null default 'queued', "total_count" integer not null default 0, "processed_count" integer not null default 0, "accepted_count" integer not null default 0, "rejected_count" integer not null default 0, "payload" jsonb not null default '[]'::jsonb, "result_preview" jsonb null, "error_message" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_sync_job_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "idx_product_sync_job_seller_id" on "product_sync_job" ("seller_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_product_sync_job_status" on "product_sync_job" ("status") where "deleted_at" is null;`);
    this.addSql(`alter table if exists "product_sync_job" add constraint "product_sync_job_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_sync_job" drop constraint if exists "product_sync_job_seller_id_foreign";`);
    this.addSql(`drop table if exists "product_sync_job" cascade;`);
  }

}
