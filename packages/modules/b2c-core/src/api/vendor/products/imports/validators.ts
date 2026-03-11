import { z } from 'zod'

import { createFindParams } from '@medusajs/medusa/api/utils/validators'

export type VendorGetProductImportJobsParamsType = z.infer<
  typeof VendorGetProductImportJobsParams
>
export const VendorGetProductImportJobsParams = createFindParams({
  offset: 0,
  limit: 20,
}).extend({
  status: z
    .enum(['queued', 'processing', 'submitted', 'failed'])
    .optional(),
})
