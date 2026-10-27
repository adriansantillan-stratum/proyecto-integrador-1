import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '../hooks/useQuery';
import { useAuth } from '../context/useAuth';
import { Modal, SourceState } from '../components/Operations';
import type { Order } from '../services/orderService';
import type { Route } from '../services/routeService';
import type { Incident, IncidentOutcome } from '../services/incidentService';
import { createIncident, resolveIncident } from '../services/incidentService';
import { errorMessage, failureReasons } from '../utils/operation';

function IncidentForm({ routes, orders, done }: { routes: Route[]; orders: Order[]; done: () => void }) {
  const [form, setForm] = useState({ routeId: '', orderId: '', incidentType: 'DELIVERY', severity: 'MEDIUM', description: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await createIncident({ routeId: Number(form.routeId), orderId: form.orderId ? Number(form.orderId) : undefined, incidentType: form.incidentType, severity: form.severity, description: form.description.trim() }); done(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form className="operation-form" onSubmit={submit}>
    <label>Ruta<select aria-label="Ruta" required value={form.routeId} onChange={e => setForm({ ...form, routeId: e.target.value, orderId: '' })}><option value="">Seleccionar ruta</option>{routes.map(r => <option key={r.id} value={r.id}>#{r.id} · {r.routeDate} · {r.status}</option>)}</select></label>
    <label>Pedido afectado (opcional)<select aria-label="Pedido afectado (opcional)" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })}><option value="">Incidencia de ruta</option>{orders.filter(o => o.routeId === Number(form.routeId)).map(o => <option key={o.id} value={o.id}>{o.trackingNumber} · {o.status}</option>)}</select></label>
    <label>Tipo<select value={form.incidentType} onChange={e => setForm({ ...form, incidentType: e.target.value })}>{['DELIVERY', 'VEHICLE', 'TRAFFIC', 'SAFETY', 'OTHER'].map(t => <option key={t}>{t}</option>)}</select></label>
    <label>Severidad<select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s}>{s}</option>)}</select></label>
    <label className="full">Descripción y evidencia observada<textarea required minLength={5} maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <p className="full">La identidad del informante se obtiene de la sesión autenticada.</p>
    <button disabled={busy}>Registrar incidencia</button>{message && <p role="alert" className="source-error full">{message}</p>}
  </form>;
}

function ResolutionForm({ incident, routes, order, done }: { incident: Incident; routes: Route[]; order?: Order; done: () => void }) {
  const { hasRole } = useAuth();
  const failed = !!order && ['FAILED', 'RETURNED'].includes(order.status);
  const sameJourney = routes.some(r => r.id === incident.routeId && r.status === 'IN_PROGRESS');
  const [outcome, setOutcome] = useState<IncidentOutcome>(failed ? sameJourney ? 'RETRY' : 'REPLAN' : 'CLOSE_CASE');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [nextRouteId, setNextRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await resolveIncident(incident.id, outcome, `${reason}: ${note.trim()}`, outcome === 'REPLAN' ? Number(nextRouteId) : undefined); done(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="operation-form"><p className="full">#{incident.id} · {incident.description}. Registre la decisión autorizada y su justificación. El servidor valida el intento y la ruta destino.</p>
    <p className="full">El pedido original nunca se reabre. RETRY crea un nuevo pedido IN_TRANSIT en la misma jornada activa. REPLAN crea un nuevo ASSIGNED en otra ruta PLANNED y exige renovar la aceptación comercial antes de aprobar. Las incidencias generales o disputas sobre entregados se cierran con CLOSE_CASE por ADMIN.</p>
    <label>Decisión<select aria-label="Decisión" value={outcome} onChange={e => setOutcome(e.target.value as IncidentOutcome)}>{failed && <><option value="RETRY" disabled={!sameJourney}>Reintentar · nueva orden, jornada activa</option><option value="REPLAN">Replanificar · nuevo pedido, renovar aceptación</option></>}{hasRole(['ADMIN']) && <>{failed && <option value="CLOSE_FAILED">Cerrar fallido (ADMIN)</option>}<option value="CLOSE_CASE">Cerrar caso sin alterar pedido (ADMIN)</option></>}</select></label>
    <label>Motivo<select aria-label="Motivo" required value={reason} onChange={e => setReason(e.target.value)}><option value="">Seleccionar motivo</option>{failureReasons.map(r => <option key={r}>{r}</option>)}</select></label>
    {outcome === 'REPLAN' && <label>Próxima ruta PLANNED<select aria-label="Próxima ruta PLANNED" required value={nextRouteId} onChange={e => setNextRouteId(e.target.value)}><option value="">Seleccionar</option>{routes.filter(r => r.status === 'PLANNED' && r.id !== incident.routeId).map(r => <option key={r.id} value={r.id}>#{r.id} · {r.routeDate}</option>)}</select></label>}
    <label className="full">Justificación de la decisión<textarea required minLength={5} maxLength={1500} value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy}>Guardar resolución</button>
    {message && <p role="alert" className="source-error full">{message}</p>}
  </form>;
}

export default function Incidents() {
  const incidents = useQuery<Incident[]>('/incidents');
  const routes = useQuery<Route[]>('/routes');
  const orders = useQuery<Order[]>('/orders');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const { hasRole } = useAuth();
  return <main className="main-content operation-page"><header className="operation-toolbar"><h2 className="header-title">Incidencias y decisiones · P04</h2><button disabled={!routes.data || !orders.data} onClick={() => setCreateOpen(true)}>Registrar incidencia</button><button onClick={incidents.reload}>Actualizar</button></header>
    <p>Registre el motivo observado y decida reintento, replanificación o cierre fallido. El actor lo determina la sesión del servidor.</p>
    <div className="operation-toolbar"><label>Buscar<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>Resolución<select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Todas</option><option value="OPEN">Pendientes</option><option value="RESOLVED">Resueltas</option></select></label></div>
    <SourceState {...incidents} retry={incidents.reload} /><SourceState {...routes} retry={routes.reload} /><SourceState {...orders} retry={orders.reload} />
    <div className="card table-scroll"><table className="operation-table"><thead><tr>{['Incidencia', 'Ruta / pedido', 'Tipo / severidad', 'Motivo observado', 'Estado / decisión', 'Actor registrado', 'Acción'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
      {(incidents.data ?? []).filter(i => (status === 'ALL' || (status === 'RESOLVED' ? !!i.outcome : !i.outcome)) && `${i.id} ${i.description} ${i.incidentType}`.toLowerCase().includes(search.toLowerCase())).map(i => <tr key={i.id}><td>#{i.id}</td><td>Ruta #{i.routeId} · Pedido {i.orderId ?? 'No indicado'}{i.retryOrderId && <p>Nuevo intento #{i.retryOrderId} · Ruta #{i.nextRouteId}</p>}</td><td>{i.incidentType} · {i.severity}</td><td>{i.description}</td><td>{i.status || (i.outcome ? 'Resuelta' : 'Pendiente')} · {i.outcome ?? 'Por decidir'}<p>{i.resolutionReason}</p></td><td>{i.reportedBy || 'No informado'}{i.resolvedBy && <p>Resolvió: {i.resolvedBy}</p>}</td><td>{!i.outcome && <div className="operation-actions"><button disabled={!routes.data || !orders.data || (!hasRole(['ADMIN']) && !orders.data.some(o => o.id === i.orderId && ['FAILED', 'RETURNED'].includes(o.status)))} onClick={() => setSelected(i)}>Resolver</button></div>}</td></tr>)}
    </tbody></table>{incidents.data?.length === 0 && <p>Sin incidencias registradas.</p>}</div>
    {createOpen && <Modal title="Registrar incidencia" close={() => setCreateOpen(false)}><IncidentForm routes={routes.data ?? []} orders={orders.data ?? []} done={() => { setCreateOpen(false); incidents.reload(); }} /></Modal>}
    {selected && <Modal title={`Resolver incidencia #${selected.id}`} close={() => setSelected(null)}><ResolutionForm incident={selected} order={orders.data?.find(o => o.id === selected.orderId)} routes={routes.data ?? []} done={() => { setSelected(null); incidents.reload(); orders.reload(); routes.reload(); }} /></Modal>}
  </main>;
}
