import api from './api';
export type IncidentOutcome = 'RETRY' | 'REPLAN' | 'CLOSE_FAILED' | 'CLOSE_CASE';
export interface IncidentRequest { routeId: number; orderId?: number; incidentType: string; severity: string; description: string }
export interface Incident extends IncidentRequest {
  id: number; status?: string; outcome?: IncidentOutcome | null; resolutionReason?: string | null;
  nextRouteId?: number | null; retryOrderId?: number | null; createdAt?: string; resolvedAt?: string | null; reportedBy?: string | null; resolvedBy?: string | null;
}
export async function createIncident(request: IncidentRequest) { return (await api.post<Incident>('/incidents', request)).data; }
export async function resolveIncident(id: number, outcome: IncidentOutcome, reason: string, nextRouteId?: number) {
  return (await api.patch<Incident>(`/incidents/${id}/resolution`, { outcome, reason, nextRouteId })).data;
}
