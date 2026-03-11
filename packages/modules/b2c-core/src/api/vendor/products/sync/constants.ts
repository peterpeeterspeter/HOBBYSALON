export const PRODUCT_SYNC_JOB_STARTED_EVENT = 'vendor.products.sync.started'

export const PRODUCT_SYNC_JOB_STATUSES = [
  'queued',
  'processing',
  'completed',
  'completed_with_errors',
  'failed',
] as const

export type ProductSyncJobStatus = (typeof PRODUCT_SYNC_JOB_STATUSES)[number]
