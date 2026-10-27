// The gateway's observations for one assessment, newest first (MB-02). Shapes
// match ObservationDto in the web repo's observation.service.ts.
import { request } from '@/lib/api'
import type { Observation } from './format'

export const listObservations = (reference: string) =>
  request<Observation[]>(`/api/assessments/${encodeURIComponent(reference)}/observations`)
