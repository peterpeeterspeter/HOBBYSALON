export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'draft'
export type RequestDataPayload = Record<string, any>

export type CreateRequestDTO = {
  type: string
  data: RequestDataPayload
  submitter_id: string
  reviewer_id?: string
  reviewer_note?: string
  status?: RequestStatus
}

export type UpdateRequestDTO = {
  id: string
  reviewer_id?: string
  reviewer_note?: string
  status: RequestStatus
}

export type UpdateRequestDataDTO = {
  id: string
  type: string
  data: RequestDataPayload
}

export type AcceptRequestDTO = {
  id: string
  reviewer_id: string
  reviewer_note: string
  data: RequestDataPayload
  status: RequestStatus
}
