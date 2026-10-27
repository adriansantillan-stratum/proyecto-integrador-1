import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '../hooks/useQuery';
import { useAuth } from '../context/useAuth';
import { ReportFilterBar, SourceState } from '../components/Operations';
import { AnalyticsChart } from '../components/AnalyticsChart';
import { EfficiencyTable } from '../components/EfficiencyTable';
import { ImprovementActions } from '../components/ImprovementActions';
import type { Driver } from '../services/driverService';
import type { BiReport, Goal, MetricCode } from '../services/analyticsTypes';
import { emptyFilters, saveGoal } from '../services/reportService';
import { biCsv, formulas, metricCodes, routeGpsMetrics } from '../utils/analytics';
import { downloadBlob, errorMessage, filterQuery, operationDate } from '../utils/operation';

const views = ['Tendencias', 'Causas', 'Cumplimiento', 'Calidad de datos', 'Eficiencia', 'Metas', 'Acciones P05'] as const;
type View = typeof views[number];
const statusLabels = { NO_DATA: 'Sin datos evaluables', NO_TARGET: 'Sin meta configurada', MET: 'Cumple meta', BELOW_TARGET: 'Por debajo de meta' };
function GoalEditor({ code, done }: { code: MetricCode; done: () => void }) {
  const goal = useQuery<Goal>(`/reports/goals/${code}`);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const value = draft ?? goal.data?.target?.toString() ?? '';
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await saveGoal(code, value === '' ? null : Number(value)); goal.reload(); setDraft(null); done(); setMessage('Meta persistida.'); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="card"><h3>{code}</h3><p>{formulas[code]}</p><SourceState {...goal} retry={goal.reload} />
    {goal.data && <form onSubmit={submit} className="operation-form"><label>Meta % (vacío elimina la meta)<input type="number" min={0} max={100} step="any" value={value} onChange={e => setDraft(e.target.value)} /></label><button disabled={busy}>Guardar meta</button></form>}
    <p>Actor registrado: {goal.data?.updatedBy ?? 'Sin registro'} · {goal.data?.updatedAt ?? 'Sin fecha'}</p>{message && <p role="status">{message}</p>}
  </section>;
}

function BiCharts({ report, view }: { report: BiReport; view: View }) {
  const q = report.quality;
  const labels = report.kpis.map(k => k.code);
  const efficiencyLabels = report.efficiency.map(r => r.label || `Ruta #${r.routeId}`);
  const gpsEfficiency = report.efficiency.map(routeGpsMetrics);
  if (view === 'Tendencias') return <div className="operation-grid">{metricCodes.map(code => <AnalyticsChart key={code} kind="line" title={`Evolución diaria · ${code}`} unit="%" labels={report.trends.map(t => t.date)} series={[
    { label: 'Resultado operativo', values: report.trends.map(t => t.kpis.find(k => k.code === code)?.percentage ?? null) },
    { label: 'Meta vigente', values: report.trends.map(t => t.kpis.find(k => k.code === code)?.target ?? null) },
  ]} note={formulas[code]} />)}</div>;
  if (view === 'Causas') {
    const history = report.causes.filter(c => c.source === 'STATUS_HISTORY');
    const incidents = report.causes.filter(c => c.source === 'INCIDENT');
    return <><p>Las causas cuentan eventos y pueden repetirse para un mismo pedido. No expresan causalidad estadística ni pedidos distintos.</p><div className="operation-grid">
      <AnalyticsChart kind="horizontal" title="Motivos registrados · todas las fuentes" labels={report.causes.map(c => `${c.source}: ${c.reason}`)} series={[{ label: 'Eventos', values: report.causes.map(c => c.count) }]} unit="eventos" />
      <AnalyticsChart kind="horizontal" title="Motivos en historial de estados" labels={history.map(c => c.reason)} series={[{ label: 'Eventos de estado', values: history.map(c => c.count) }]} unit="eventos" />
      <AnalyticsChart kind="horizontal" title="Motivos de incidencias" labels={incidents.map(c => c.reason)} series={[{ label: 'Eventos de incidencia', values: incidents.map(c => c.count) }]} unit="eventos" />
      <AnalyticsChart title="Eventos por fuente" kind="doughnut" labels={report.causes.length ? ['Historial de estado', 'Incidencias'] : []} series={[{ label: 'Eventos', values: [history.reduce((n, c) => n + c.count, 0), incidents.reduce((n, c) => n + c.count, 0)] }]} unit="eventos" />
    </div></>;
  }
  if (view === 'Cumplimiento') return <div className="operation-grid">
    <AnalyticsChart title="Resultado frente a meta vigente" unit="%" labels={labels} series={[{ label: 'Resultado', values: report.kpis.map(k => k.percentage) }, { label: 'Meta', values: report.kpis.map(k => k.target) }]} />
    <AnalyticsChart title="Brecha respecto de la meta" unit="puntos porcentuales" labels={labels} series={[{ label: 'Resultado menos meta', values: report.kpis.map(k => k.gap) }]} />
    <AnalyticsChart title="Población evaluada por indicador" labels={labels} series={[{ label: 'Numerador', values: report.kpis.map(k => k.numerator) }, { label: 'Denominador', values: report.kpis.map(k => k.denominator) }]} note="Cada indicador tiene un denominador diferente; no deben sumarse." />
    <AnalyticsChart title="Entregas y fallidos por conductor" labels={report.byDriver.map(d => d.name)} series={[{ label: 'Entregas', values: report.byDriver.map(d => d.count) }, { label: 'Fallidos', values: report.byDriver.map(d => d.failed) }, { label: 'Total pedidos', values: report.byDriver.map(d => d.total) }]} />
  </div>;
  if (view === 'Calidad de datos') return <><p>Los controles se solapan: un pedido puede tener varias observaciones. RUC es opcional para el alta; su ausencia sí afecta IID. POD completo es un control de metadatos y no acredita por sí solo la disponibilidad remota de las imágenes.</p><div className="operation-grid">
    <AnalyticsChart title="Revisión comercial pendiente · P01" labels={['Sin aceptación', 'Dirección sin verificar', 'Cobertura sin verificar']} series={[{ label: 'Pedidos observados', values: [q.unconfirmedOrders, q.unverifiedAddressOrders, q.unverifiedCoverageOrders] }]} />
    <AnalyticsChart title="Integridad de datos del pedido" labels={['Total pedidos', 'RUC ausente', 'GPS inválido', 'Ventana ausente']} series={[{ label: 'Pedidos', values: [q.totalOrders, q.missingRucOrders, q.invalidGpsOrders, q.missingWindowOrders] }]} />
    <AnalyticsChart title="Programación y evidencia completa" labels={['Pedidos con ruta', 'Pedidos con POD completo']} series={[{ label: 'Pedidos', values: [q.scheduledOrders, q.completePodOrders] }]} note="TDE usa foto O firma; este control exige todos los metadatos del POD." />
    <AnalyticsChart title="Cobertura de telemetría" labels={['Rutas sin GPS evaluable']} series={[{ label: 'Rutas', values: [q.routesWithoutGps] }]} unit="rutas" note="La distancia GPS requiere al menos dos muestras y pasar los controles de coordenadas, timestamps, velocidad e intervalo; pasar controles no acredita movimiento real. La calidad por ruta se detalla en Eficiencia." />
  </div></>;
  if (view === 'Eficiencia') return <><div className="operation-grid">
    <AnalyticsChart title="Distancia planificada y GPS evaluable por ruta" unit="km" labels={efficiencyLabels} series={[{ label: 'Plan', values: report.efficiency.map(r => r.plannedDistanceKm) }, { label: 'GPS Haversine con controles', values: gpsEfficiency.map(r => r.actualGpsDistanceKm) }]} note="GPS no evaluable queda sin valor; no se sustituye por cero ni por el plan. Pasar los controles no acredita movimiento real." />
    <AnalyticsChart title="Duración de operación por ruta" unit="minutos" labels={efficiencyLabels} series={[{ label: 'Operación', values: report.efficiency.map(r => r.operationMinutes) }]} />
    <AnalyticsChart title="Kilómetros GPS por entrega" unit="km/entrega" labels={efficiencyLabels} series={[{ label: 'GPS / entregas DELIVERED', values: gpsEfficiency.map(r => r.kmPerDelivery) }]} note="Sin distancia GPS evaluable no se publica km/entrega. Los motivos se indican en la tabla de calidad GPS." />
    <AnalyticsChart title="Minutos de operación por parada terminal" unit="min/parada" labels={efficiencyLabels} series={[{ label: 'Operación / (entregas + fallidos + devueltos)', values: report.efficiency.map(r => r.timePerStopMin) }]} note="Promedio de operación; no representa tiempo de servicio en el domicilio." />
  </div><EfficiencyTable rows={report.efficiency} /></>;
  return null;
}

export default function BusinessIntelligence() {
  const [filters, setFilters] = useState(emptyFilters);
  const [view, setView] = useState<View>('Tendencias');
  const { hasRole } = useAuth();
  const valid = !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate;
  const report = useQuery<BiReport>(valid ? `/reports/bi?${filterQuery(filters)}` : null);
  const drivers = useQuery<Driver[]>('/drivers');
  return <main className="main-content operation-page"><header className="operation-toolbar"><h2 className="header-title">Inteligencia de negocio · P05 / P06</h2><button onClick={report.reload}>Actualizar indicadores</button><button disabled={!report.data} onClick={() => { if (report.data) downloadBlob(new Blob([biCsv(report.data)], { type: 'text/csv;charset=utf-8' }), `indicadores_${operationDate()}.csv`); }}>Exportar indicadores y tendencias CSV</button></header>
    <p>Resultados del período calculados por la API. Los datos históricos de referencia no se cargan como resultados operativos ni permiten atribuir mejoras causales.</p>
    <ReportFilterBar filters={filters} setFilters={setFilters} drivers={drivers.data} /><SourceState {...drivers} retry={drivers.reload} />
    <nav className="operation-toolbar" aria-label="Vistas de inteligencia de negocio">{views.map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}</nav>
    <SourceState {...report} retry={report.reload} />
    {report.data && <><p>Población: conductor {report.data.driverId ?? 'todos'} · {report.data.startDate ?? 'inicio abierto'} a {report.data.endDate ?? 'fin abierto'} · {report.data.timezone}. Fechas inclusivas.</p>
      <div className="operation-grid">{report.data.kpis.map(k => <section key={k.code} className="card"><h3>{k.code} · {k.name}</h3><strong style={{ fontSize: '1.7rem' }}>{k.percentage == null ? 'Sin datos evaluables' : `${k.percentage}%`}</strong><p>{k.numerator} / {k.denominator} · {statusLabels[k.status]}</p><p>Meta: {k.target == null ? 'Sin configurar' : `${k.target}%`} · Brecha: {k.gap == null ? 'No evaluable' : `${k.gap} pp`}</p><p>{formulas[k.code]}</p></section>)}</div>
      <BiCharts report={report.data} view={view} />
    </>}
    {view === 'Metas' && hasRole(['ADMIN']) && <><p>Metas administrativas vigentes de 0 a 100%. El historial lo conserva el servidor con el actor autenticado. Las tendencias se comparan con la meta vigente.</p><div className="operation-grid">{metricCodes.map(code => <GoalEditor code={code} key={code} done={report.reload} />)}</div></>}
    {view === 'Acciones P05' && <ImprovementActions />}
  </main>;
}
