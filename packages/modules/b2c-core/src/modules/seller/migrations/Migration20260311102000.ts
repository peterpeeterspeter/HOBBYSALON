import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260311102000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "seller_type" text check ("seller_type" in ('creator', 'merchant')) not null default 'creator';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "seller_type";`);
  }

}
