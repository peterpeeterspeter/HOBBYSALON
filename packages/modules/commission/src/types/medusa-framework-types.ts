/**
 * Load Medusa container ModuleImplementations augmentation so
 * container.resolve(ContainerRegistrationKeys.*) is typed during plugin:build.
 *
 * Note: @medusajs/framework/types does NOT include container.d.ts — use the
 * main framework entry which re-exports ./types/container.
 */
import type {} from "@medusajs/framework";
