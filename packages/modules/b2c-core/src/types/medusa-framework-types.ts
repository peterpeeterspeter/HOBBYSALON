/**
 * Medusa ModuleImplementations augmentation for plugin compilation on CI.
 */
import type { Link } from "@medusajs/modules-sdk";
import type {
  ConfigModule,
  IAnalyticsModuleService,
  IApiKeyModuleService,
  IAuthModuleService,
  ICacheService,
  ICachingModuleService,
  ICartModuleService,
  ICurrencyModuleService,
  ICustomerModuleService,
  IEventBusModuleService,
  IFileModuleService,
  IFulfillmentModuleService,
  IIndexService,
  IInventoryService,
  ILockingModule,
  INotificationModuleService,
  IOrderModuleService,
  IPaymentModuleService,
  IPricingModuleService,
  IProductModuleService,
  IPromotionModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  ISettingsModuleService,
  IStockLocationService,
  IStoreModuleService,
  ITaxModuleService,
  IUserModuleService,
  IWorkflowEngineService,
  Logger,
  RemoteQueryFunction,
} from "@medusajs/types";
import type { Knex } from "knex";
import { ContainerRegistrationKeys, Modules } from "@medusajs/utils";

declare module "@medusajs/types" {
  interface ModuleImplementations {
    [ContainerRegistrationKeys.REMOTE_LINK]: Link;
    [ContainerRegistrationKeys.LINK]: Link;
    [ContainerRegistrationKeys.CONFIG_MODULE]: ConfigModule;
    [ContainerRegistrationKeys.PG_CONNECTION]: Knex;
    [ContainerRegistrationKeys.REMOTE_QUERY]: RemoteQueryFunction;
    [ContainerRegistrationKeys.QUERY]: Omit<RemoteQueryFunction, symbol>;
    [ContainerRegistrationKeys.LOGGER]: Logger;
    [Modules.ANALYTICS]: IAnalyticsModuleService;
    [Modules.AUTH]: IAuthModuleService;
    [Modules.CACHE]: ICacheService;
    [Modules.CART]: ICartModuleService;
    [Modules.CUSTOMER]: ICustomerModuleService;
    [Modules.EVENT_BUS]: IEventBusModuleService;
    [Modules.INVENTORY]: IInventoryService;
    [Modules.PAYMENT]: IPaymentModuleService;
    [Modules.PRICING]: IPricingModuleService;
    [Modules.PRODUCT]: IProductModuleService;
    [Modules.PROMOTION]: IPromotionModuleService;
    [Modules.SALES_CHANNEL]: ISalesChannelModuleService;
    [Modules.TAX]: ITaxModuleService;
    [Modules.FULFILLMENT]: IFulfillmentModuleService;
    [Modules.STOCK_LOCATION]: IStockLocationService;
    [Modules.USER]: IUserModuleService;
    [Modules.WORKFLOW_ENGINE]: IWorkflowEngineService;
    [Modules.REGION]: IRegionModuleService;
    [Modules.ORDER]: IOrderModuleService;
    [Modules.API_KEY]: IApiKeyModuleService;
    [Modules.STORE]: IStoreModuleService;
    [Modules.CURRENCY]: ICurrencyModuleService;
    [Modules.FILE]: IFileModuleService;
    [Modules.NOTIFICATION]: INotificationModuleService;
    [Modules.LOCKING]: ILockingModule;
    [Modules.SETTINGS]: ISettingsModuleService;
    [Modules.CACHING]: ICachingModuleService;
    [Modules.INDEX]: IIndexService;
  }
}

export {};
