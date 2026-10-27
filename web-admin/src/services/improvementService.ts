import api from './api';
import type { MetricCode } from './analyticsTypes';
export type ActionStatus = 'IN_PROGRESS' | 'VERIFIED' | 'DISCARDED';
export interface ImprovementRequest { title: string; cause: string; ownerName: string; dueDate: string; metricCode: MetricCode; baselineValue?: number; targetValue?: number }
export interface ImprovementAction extends ImprovementRequest { id: number; status: string; resultValue?: number | null; note?: string | null; createdBy?: string; verifiedBy?: string | null }
export async function createImprovement(request: ImprovementRequest) { return (await api.post<ImprovementAction>('/improvement-actions', request)).data; }
export async function updateImprovement(id: number, status: ActionStatus, note: string, resultValue?: number) {
  return (await api.patch<ImprovementAction>(`/improvement-actions/${id}`, { status, note, resultValue })).data;
}
