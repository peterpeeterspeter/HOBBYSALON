export const PRODUCT_IMPORT_JOB_STARTED_EVENT = 'vendor.products.import.started'

export const PRODUCT_IMPORT_JOB_STATUSES = [
  'queued',
  'processing',
  'submitted',
  'failed',
] as const

export type ProductImportJobStatus = (typeof PRODUCT_IMPORT_JOB_STATUSES)[number]
