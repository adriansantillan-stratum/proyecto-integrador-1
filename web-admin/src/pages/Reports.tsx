import { useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { ReportFilterBar, SourceState } from '../components/Operations';
import { AnalyticsChart } from '../components/AnalyticsChart';
import { EfficiencyTable } from '../components/EfficiencyTable';
import type { Driver } from '../services/driverService';
import type { NameCount, OrdersSummary, RouteEfficiency } from '../services/analyticsTypes';
import { emptyFilters } from '../services/reportService';
import { filterQuery } from '../utils/operation';

export default function Reports() {
  const [filters, setFilters] = useState(emptyFilters);
  const valid = !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate;
  const query = valid ? filterQuery(filters) : '';
  const summary = useQuery<OrdersSummary>(valid ? `/reports/orders-summary?${query}` : null);
  const performance = useQuery<NameCount[]>(valid ? `/reports/driver-performance?${query}` : null);
  const efficiency = useQuery<RouteEfficiency[]>(valid ? `/reports/route-efficiency?${query}` : null);
  const drivers = useQuery<Driver[]>('/drivers');
  return <main className="main-content operation-page"><h2 className="header-title">Reportes operativos</h2><p>Todos los reportes usan conductor y fechas operativas inclusivas de America/Lima.</p>
    <ReportFilterBar filters={filters} setFilters={setFilters} drivers={drivers.data} /><SourceState {...drivers} retry={drivers.reload} />
    <section className="card"><h3>Resumen de pedidos</h3><SourceState {...summary} retry={summary.reload} />{summary.data && <><p>Total: {summary.data.ordersByStatus.reduce((sum, s) => sum + s.count, 0)} · Entregas a tiempo: {summary.data.onTimeDeliveries} · Retrasadas: {summary.data.delayedDeliveries}</p><p>La puntualidad solo evalúa entregas con POD y fin de ventana registrado.</p></>}</section>
    <div className="operation-grid"><div><SourceState {...performance} retry={performance.reload} /><AnalyticsChart title="Entregas por conductor" labels={(performance.data ?? []).map(d => d.name || 'Sin nombre')} series={[{ label: 'Entregas DELIVERED', values: (performance.data ?? []).map(d => d.count) }]} /></div>
      <div><SourceState {...summary} retry={summary.reload} /><AnalyticsChart title="Pedidos por estado" labels={(summary.data?.ordersByStatus ?? []).map(s => s.status)} series={[{ label: 'Pedidos', values: (summary.data?.ordersByStatus ?? []).map(s => s.count) }]} /></div></div>
    <SourceState {...efficiency} retry={efficiency.reload} />{efficiency.data && <EfficiencyTable rows={efficiency.data} />}
  </main>;
}
