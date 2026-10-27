import api from './api';
import { filterQuery } from '../utils/operation';
import type { ReportFilters } from '../utils/operation';
import type { BiReport, Goal, MetricCode, NameCount, OrdersSummary, RouteEfficiency } from './analyticsTypes';
export type { OrdersSummary, RouteEfficiency } from './analyticsTypes';
export type DriverPerformance = NameCount;
export const emptyFilters: ReportFilters = { driverId: '', startDate: '', endDate: '' };
export async function getOrdersSummary(filters = emptyFilters) { return (await api.get<OrdersSummary>(`/reports/orders-summary?${filterQuery(filters)}`)).data; }
export async function getDriverPerformance(filters = emptyFilters) { return (await api.get<NameCount[]>(`/reports/driver-performance?${filterQuery(filters)}`)).data; }
export async function getRouteEfficiency(filters = emptyFilters) { return (await api.get<RouteEfficiency[]>(`/reports/route-efficiency?${filterQuery(filters)}`)).data; }
export async function getBiReport(filters = emptyFilters) { return (await api.get<BiReport>(`/reports/bi?${filterQuery(filters)}`)).data; }
export async function saveGoal(code: MetricCode, target: number | null) { return (await api.put<Goal>(`/reports/goals/${code}`, { target })).data; }
