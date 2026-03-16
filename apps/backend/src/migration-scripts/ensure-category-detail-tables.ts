import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Ensures category_detail, category_media, collection_detail and collection_media tables exist.
 * Workaround for plugin migrations not being discovered in CI (e.g. seed smoke-test).
 * These tables are created by @mercurjs/b2c-core migrations; when those don't run,
 * this script creates them so seed can proceed.
 */
export default async function ensureCategoryDetailTables({
  container,
}: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as {
    raw: (sql: string) => Promise<unknown>;
  };

  await knex.raw(`
    create table if not exists "category_detail" (
      "id" text not null,
      "thumbnail_id" text null,
      "icon_id" text null,
      "banner_id" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "category_detail_pkey" primary key ("id")
    )
  `);
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "IDX_category_detail_deleted_at" ON "category_detail" ("deleted_at") WHERE deleted_at IS NULL`
  );

  await knex.raw(`
    create table if not exists "category_media" (
      "id" text not null,
      "category_detail_id" text null,
      "url" text not null,
      "alt_text" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "category_media_pkey" primary key ("id")
    )
  `);
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "IDX_category_media_category_detail_id" ON "category_media" ("category_detail_id") WHERE deleted_at IS NULL`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "IDX_category_media_deleted_at" ON "category_media" ("deleted_at") WHERE deleted_at IS NULL`
  );
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_media_category_detail_id_foreign') THEN
        ALTER TABLE "category_media" ADD CONSTRAINT "category_media_category_detail_id_foreign"
        FOREIGN KEY ("category_detail_id") REFERENCES "category_detail" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);

  // collection_detail and collection_media (collection-details module)
  await knex.raw(`
    create table if not exists "collection_detail" (
      "id" text not null,
      "thumbnail_id" text null,
      "icon_id" text null,
      "banner_id" text null,
      "rank" integer not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "collection_detail_pkey" primary key ("id")
    )
  `);
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "IDX_collection_detail_deleted_at" ON "collection_detail" ("deleted_at") WHERE deleted_at IS NULL`
  );

  await knex.raw(`
    create table if not exists "collection_media" (
      "id" text not null,
      "collection_detail_id" text null,
      "url" text not null,
      "alt_text" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "collection_media_pkey" primary key ("id")
    )
  `);
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "IDX_collection_media_collection_detail_id" ON "collection_media" ("collection_detail_id") WHERE deleted_at IS NULL`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "IDX_collection_media_deleted_at" ON "collection_media" ("deleted_at") WHERE deleted_at IS NULL`
  );
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_media_collection_detail_id_foreign') THEN
        ALTER TABLE "collection_media" ADD CONSTRAINT "collection_media_collection_detail_id_foreign"
        FOREIGN KEY ("collection_detail_id") REFERENCES "collection_detail" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
}
