import api from './api';
import { filterQuery } from '../utils/operation';
import { emptyFilters } from './reportService';
import type { DeliveryPerformance, NameCount, StatusCount } from './analyticsTypes';
export async function getDashboardStats(filters = emptyFilters) { return (await api.get<StatusCount[]>(`/dashboard/orders-by-status?${filterQuery(filters)}`)).data; }
export async function getDeliveryPerformance(filters = emptyFilters) { return (await api.get<DeliveryPerformance>(`/dashboard/delivery-performance?${filterQuery(filters)}`)).data; }
export async function getDeliveriesByDriver(filters = emptyFilters) { return (await api.get<NameCount[]>(`/dashboard/deliveries-by-driver?${filterQuery(filters)}`)).data; }
export async function getOrdersByDistrict(filters = emptyFilters) { return (await api.get<NameCount[]>(`/dashboard/orders-by-district?${filterQuery(filters)}`)).data; }
