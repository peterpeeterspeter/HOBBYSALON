export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'draft'

export type CreateRequestDTO = {
  type: string
  data: unknown
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
  data: unknown
}

export type AcceptRequestDTO = {
  id: string
  reviewer_id: string
  reviewer_note: string
  data: unknown
  status: RequestStatus
}
