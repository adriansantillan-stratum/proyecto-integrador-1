import { useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import type { Driver } from '../services/driverService';
import type { Vehicle } from '../services/vehicleService';
import type { Route } from '../services/routeService';
import type { DeliveryPerformance, NameCount, StatusCount } from '../services/analyticsTypes';
import { emptyFilters } from '../services/reportService';
import { ReportFilterBar, SourceState } from '../components/Operations';
import { AnalyticsChart } from '../components/AnalyticsChart';
import { filterQuery, operationDate } from '../utils/operation';

export default function Dashboard() {
  const [filters, setFilters] = useState(emptyFilters);
  const valid = !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate;
  const query = valid ? filterQuery(filters) : '';
  const stats = useQuery<StatusCount[]>(valid ? `/dashboard/orders-by-status?${query}` : null);
  const timing = useQuery<DeliveryPerformance>(valid ? `/dashboard/delivery-performance?${query}` : null);
  const byDriver = useQuery<NameCount[]>(valid ? `/dashboard/deliveries-by-driver?${query}` : null);
  const district = useQuery<NameCount[]>(valid ? `/dashboard/orders-by-district?${query}` : null);
  const drivers = useQuery<Driver[]>('/drivers');
  const vehicles = useQuery<Vehicle[]>('/vehicles');
  const routes = useQuery<Route[]>('/routes');
  const todayRoutes = routes.data?.filter(r => r.routeDate === operationDate() && !['COMPLETED', 'CANCELLED'].includes(r.status));
  const fleetReady = !!drivers.data && !!vehicles.data && !!routes.data;
  const cards = stats.data ? [
    ['Total pedidos', stats.data.reduce((total, s) => total + s.count, 0)],
    ['En tránsito', stats.data.find(s => s.status === 'IN_TRANSIT')?.count ?? 0],
    ['Entregados', stats.data.find(s => s.status === 'DELIVERED')?.count ?? 0],
    ['Pendientes / asignados', stats.data.filter(s => ['PENDING', 'ASSIGNED'].includes(s.status)).reduce((sum, s) => sum + s.count, 0)],
  ] : [];
  return <main className="main-content operation-page"><h2 className="header-title">Panel de control logístico</h2>
    <p>Fecha operativa: {operationDate()} · America/Lima. Los cuatro gráficos usan la misma población filtrada.</p>
    <ReportFilterBar filters={filters} setFilters={setFilters} drivers={drivers.data} />
    <SourceState {...drivers} retry={drivers.reload} /><SourceState {...stats} retry={stats.reload} />
    <div className="operation-grid">{cards.map(([label, value]) => <div className="card" key={label}><h3>{label}</h3><strong style={{ fontSize: '2rem' }}>{value}</strong></div>)}</div>
    <div className="operation-grid"><div><SourceState {...stats} retry={stats.reload} /><AnalyticsChart title="Pedidos por estado" labels={(stats.data ?? []).map(s => s.status)} series={[{ label: 'Pedidos', values: (stats.data ?? []).map(s => s.count) }]} /></div>
      <div><SourceState {...timing} retry={timing.reload} /><AnalyticsChart title="Puntualidad de entregas evaluables" labels={timing.data ? ['A tiempo', 'Retrasadas'] : []} series={[{ label: 'Entregas con POD y ventana', values: timing.data ? [timing.data.onTime, timing.data.delayed] : [] }]} /></div>
      <div><SourceState {...byDriver} retry={byDriver.reload} /><AnalyticsChart title="Entregas por conductor" labels={(byDriver.data ?? []).map(d => d.name ?? 'Sin nombre')} series={[{ label: 'Entregas DELIVERED', values: (byDriver.data ?? []).map(d => d.count) }]} /></div>
      <div><SourceState {...district} retry={district.reload} /><AnalyticsChart title="Pedidos por distrito" labels={(district.data ?? []).map(d => d.name || 'Sin distrito')} series={[{ label: 'Pedidos', values: (district.data ?? []).map(d => d.count) }]} /></div>
    </div>
    <section className="card"><h3>Disponibilidad actual de flota · {operationDate()}</h3><p>Esta sección muestra la disponibilidad operativa de hoy en Lima. Los filtros analíticos superiores se aplican a pedidos y entregas.</p>
      <SourceState {...vehicles} retry={vehicles.reload} /><SourceState {...routes} retry={routes.reload} />
      {fleetReady && <><p>Conductores activos libres: {drivers.data?.filter(d => d.isActive && !todayRoutes?.some(r => r.driverId === d.id)).length} / {drivers.data?.filter(d => d.isActive).length}</p>
        <p>Vehículos activos libres: {vehicles.data?.filter(v => v.isActive && !todayRoutes?.some(r => r.vehicleId === v.id)).length} / {vehicles.data?.filter(v => v.isActive).length}</p><p>Vehículos inactivos: {vehicles.data?.filter(v => !v.isActive).length}. Consulte su condición en Vehículos.</p></>}
    </section>
  </main>;
}
