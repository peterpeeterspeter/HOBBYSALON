import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260312100500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_import_job" ("id" text not null, "seller_id" text not null, "submitter_id" text not null, "status" text check ("status" in ('queued', 'processing', 'submitted', 'failed')) not null default 'queued', "file_name" text null, "file_size" integer null, "total_count" integer not null default 0, "error_message" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_import_job_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "idx_product_import_job_seller_id" on "product_import_job" ("seller_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "idx_product_import_job_submitter_id" on "product_import_job" ("submitter_id") where "deleted_at" is null;`);
    this.addSql(`alter table if exists "product_import_job" add constraint "product_import_job_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_import_job" drop constraint if exists "product_import_job_seller_id_foreign";`);
    this.addSql(`drop table if exists "product_import_job" cascade;`);
  }

}
