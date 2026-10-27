// The gateway's assessment list (MB-01, MB-02). Used by Home and by the
// workspace, which finds its own assessment in it: the gateway has no route
// for a single assessment.
import { request } from '@/lib/api'
import type { Assessment } from './format'

export const listAssessments = () => request<Assessment[]>('/api/assessments')
