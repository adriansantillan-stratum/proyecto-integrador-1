import type { ReactNode } from 'react';
import type { Driver } from '../services/driverService';
import type { ReportFilters } from '../utils/operation';

export function SourceState({ loading, error, retry }: { loading?: boolean; error?: string; retry?: () => void }) {
  if (error) return <p role="alert" className="source-error">{error} {retry && <button onClick={retry}>Reintentar</button>}</p>;
  return loading ? <p role="status">Cargando…</p> : null;
}

export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  return <div className="operation-overlay"><section role="dialog" aria-modal="true" aria-label={title} className="card operation-modal">
    <header className="operation-toolbar"><h3>{title}</h3><button type="button" onClick={close} aria-label="Cerrar">Cerrar ×</button></header>{children}
  </section></div>;
}

export function ReportFilterBar({ filters, setFilters, drivers = [] }: { filters: ReportFilters; setFilters: (value: ReportFilters) => void; drivers?: Driver[] }) {
  return <div className="card operation-toolbar">
    <label>Conductor<select aria-label="Conductor" value={filters.driverId} onChange={e => setFilters({ ...filters, driverId: e.target.value })}>
      <option value="">Todos los conductores</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
    </select></label>
    <label>Desde (Lima)<input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={e => setFilters({ ...filters, startDate: e.target.value })} /></label>
    <label>Hasta (Lima)<input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={e => setFilters({ ...filters, endDate: e.target.value })} /></label>
    <button onClick={() => setFilters({ driverId: '', startDate: '', endDate: '' })}>Limpiar filtros</button>
    {filters.startDate && filters.endDate && filters.startDate > filters.endDate && <p role="alert">La fecha inicial debe ser anterior a la final.</p>}
  </div>;
}
