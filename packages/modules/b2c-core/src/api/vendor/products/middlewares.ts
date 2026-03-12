import multer from "multer";

import {
  unlessPath,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";

import { ConfigurationRuleType } from "@mercurjs/framework";

import sellerProductLink from "../../../links/seller-product";
import {
  checkResourceOwnershipByResourceId,
  checkConfigurationRule,
  filterBySellerId,
} from "../../../shared/infra/http/middlewares";

import { retrieveAttributeQueryConfig } from "../attributes/query-config";
import { VendorGetAttributesParams } from "../attributes/validators";
import {
  vendorProductQueryConfig,
  vendorProductVariantQueryConfig,
} from "./query-config";
import {
  CreateProductOption,
  CreateProductVariant,
  UpdateProductOption,
  UpdateProductVariant,
  VendorBatchVariantImages,
  VendorBatchUpdateProducts,
  VendorCreateProduct,
  VendorGetProductParams,
  VendorGetProductVariantsParams,
  VendorUpdateProduct,
  VendorUpdateProductStatus,
} from "./validators";
import { VendorGetProductImportJobsParams } from "./imports/validators";
import { vendorProductImportJobsQueryConfig } from "./imports/query-config";
import {
  VendorGetProductSyncJobsParams,
  VendorStartProductSync,
} from "./sync/validators";
import { vendorProductSyncJobsQueryConfig } from "./sync/query-config";
import {
  VendorCreateFeedSource,
  VendorGetFeedSourcesParams,
  VendorPreviewFeedSource,
  VendorPullFeedSource,
  VendorUpdateFeedSource,
} from "./feed-sources/validators";
import { vendorFeedSourcesQueryConfig } from "./feed-sources/query-config";

const canVendorCreateProduct = [
  checkConfigurationRule(ConfigurationRuleType.GLOBAL_PRODUCT_CATALOG, false),
  checkConfigurationRule(ConfigurationRuleType.PRODUCT_REQUEST_ENABLED, true),
];

const upload = multer({ storage: multer.memoryStorage() });

export const vendorProductsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/vendor/products",
    middlewares: [
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.list
      ),
      filterBySellerId(),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products",
    middlewares: [
      ...canVendorCreateProduct,
      validateAndTransformBody(VendorCreateProduct),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/batch",
    middlewares: [
      validateAndTransformBody(VendorBatchUpdateProducts),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/export",
    middlewares: [],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/imports",
    middlewares: [
      checkConfigurationRule(
        ConfigurationRuleType.PRODUCT_IMPORT_ENABLED,
        true
      ),
      validateAndTransformQuery(
        VendorGetProductImportJobsParams,
        vendorProductImportJobsQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/imports",
    middlewares: [
      checkConfigurationRule(
        ConfigurationRuleType.PRODUCT_IMPORT_ENABLED,
        true
      ),
      upload.single("file"),
    ],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/imports/:job_id",
    middlewares: [
      checkConfigurationRule(
        ConfigurationRuleType.PRODUCT_IMPORT_ENABLED,
        true
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/imports/dry-run",
    middlewares: [
      checkConfigurationRule(
        ConfigurationRuleType.PRODUCT_IMPORT_ENABLED,
        true
      ),
      upload.single("file"),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/import",
    middlewares: [
      checkConfigurationRule(
        ConfigurationRuleType.PRODUCT_IMPORT_ENABLED,
        true
      ),
      upload.single("file"),
    ],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/sync",
    middlewares: [
      validateAndTransformQuery(
        VendorGetProductSyncJobsParams,
        vendorProductSyncJobsQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/sync",
    middlewares: [validateAndTransformBody(VendorStartProductSync)],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/sync/:job_id",
    middlewares: [],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/feed-sources",
    middlewares: [
      validateAndTransformQuery(
        VendorGetFeedSourcesParams,
        vendorFeedSourcesQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/feed-sources",
    middlewares: [validateAndTransformBody(VendorCreateFeedSource)],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/feed-sources/:id",
    middlewares: [],
  },
  {
    method: ["PUT"],
    matcher: "/vendor/products/feed-sources/:id",
    middlewares: [validateAndTransformBody(VendorUpdateFeedSource)],
  },
  {
    method: ["DELETE"],
    matcher: "/vendor/products/feed-sources/:id",
    middlewares: [],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/feed-sources/:id/pull",
    middlewares: [validateAndTransformBody(VendorPullFeedSource)],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/feed-sources/:id/preview",
    middlewares: [validateAndTransformBody(VendorPreviewFeedSource)],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/feed-sources/:id/runs",
    middlewares: [],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/feed-sources/:id/runs/:run_id",
    middlewares: [],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/feed-sources/:id/metrics",
    middlewares: [],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/:id",
    middlewares: [
      unlessPath(
        /.*\/products\/(export|import|imports|sync|feed-sources)/,
        checkResourceOwnershipByResourceId({
          entryPoint: sellerProductLink.entryPoint,
          filterField: "product_id",
        })
      ),
      unlessPath(
        /.*\/products\/(export|import|imports|sync|feed-sources)/,
        validateAndTransformQuery(
          VendorGetProductParams,
          vendorProductQueryConfig.retrieve
        )
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id",
    middlewares: [
      unlessPath(
        /.*\/products\/(export|import|imports|sync|feed-sources)/,
        checkResourceOwnershipByResourceId({
          entryPoint: sellerProductLink.entryPoint,
          filterField: "product_id",
        })
      ),
      unlessPath(
        /.*\/products\/(export|import|imports|sync|feed-sources)/,
        validateAndTransformBody(VendorUpdateProduct)
      ),
      unlessPath(
        /.*\/products\/(export|import|imports|sync|feed-sources)/,
        validateAndTransformQuery(
          VendorGetProductParams,
          vendorProductQueryConfig.retrieve
        )
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/:id/variants",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
      validateAndTransformQuery(
        VendorGetProductVariantsParams,
        vendorProductVariantQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id/variants",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
      validateAndTransformBody(CreateProductVariant),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id/variants/:variant_id",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
      validateAndTransformBody(UpdateProductVariant),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["DELETE"],
    matcher: "/vendor/products/:id/variants/:variant_id",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id/options",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
      validateAndTransformBody(CreateProductOption),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id/options/:option_id",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
      validateAndTransformBody(UpdateProductOption),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["DELETE"],
    matcher: "/vendor/products/:id/options/:option_id",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
    ],
  },
  {
    method: ["DELETE"],
    matcher: "/vendor/products/:id",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id/status",
    middlewares: [
      checkResourceOwnershipByResourceId({
        entryPoint: sellerProductLink.entryPoint,
        filterField: "product_id",
      }),
      validateAndTransformBody(VendorUpdateProductStatus),
      validateAndTransformQuery(
        VendorGetProductParams,
        vendorProductQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/vendor/products/:id/applicable-attributes",
    middlewares: [
      validateAndTransformQuery(
        VendorGetAttributesParams,
        retrieveAttributeQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/vendor/products/:id/variants/:variant_id/media",
    middlewares: [
      validateAndTransformBody(VendorBatchVariantImages),
    ],
  },
];
