import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { approveRoute, createRoute, updateRouteStatus } from '../services/routeService';
import type { ReviewRequest, Route, RoutePath, RouteReview } from '../services/routeService';
import type { Driver } from '../services/driverService';
import type { Vehicle } from '../services/vehicleService';
import type { Order } from '../services/orderService';
import { connectGpsWebSocket, getVehicleHistory } from '../services/gpsService';
import type { VehicleGpsHistory } from '../services/gpsService';
import { useQuery } from '../hooks/useQuery';
import { useAuth } from '../context/useAuth';
import { Modal, SourceState } from '../components/Operations';
import TrackingMap from '../components/TrackingMap';
import Pagination from '../components/Pagination';
import { OrderAssignment } from './Orders';
import { decodePolyline, errorMessage, operationDate } from '../utils/operation';
import { watchGpsConnection } from '../utils/gpsSubscription';

function RouteTracking({ route, orders }: { route: Route; orders: Order[] }) {
  const [history, setHistory] = useState<VehicleGpsHistory[]>([]);
  const [gpsError, setGpsError] = useState('');
  const [connected, setConnected] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const stopsKey = orders.map(o => `${o.id}:${o.status}`).join(',');
  const path = useQuery<RoutePath>(gpsReady ? `/routes/${route.id}/path${origin ? `?fromLat=${origin.lat}&fromLng=${origin.lng}` : ''}` : null, stopsKey);
  useEffect(() => {
    let active = true;
    let fetching = false;
    let latestPosition: { lat: number; lng: number } | null = null;
    const position = (latitude: number, longitude: number) => ({ lat: Number(latitude.toFixed(4)), lng: Number(longitude.toFixed(4)) });
    async function poll() {
      if (fetching) return;
      fetching = true;
      try {
        const data = await getVehicleHistory(route.vehicleId);
        if (active) {
          const sorted = [...data].sort((a, b) => Date.parse(b.pingTime) - Date.parse(a.pingTime));
          setHistory(sorted); setGpsError('');
          latestPosition = sorted[0] ? position(sorted[0].latitude, sorted[0].longitude) : null;
          setOrigin(previous => previous ?? latestPosition); setGpsReady(true);
        }
      } catch (cause) { if (active) { setGpsError(errorMessage(cause)); setGpsReady(true); } }
      finally { fetching = false; }
    }
    void poll();
    let cleanup = () => {};
    if (route.status === 'IN_PROGRESS') {
      try {
        const ws = connectGpsWebSocket(route.vehicleId, data => {
          if (!active || data.vehicleId !== route.vehicleId) return;
          latestPosition = position(data.latitude, data.longitude);
          setHistory(previous => [{ id: data.timestamp, vehicleId: data.vehicleId, driverId: route.driverId, latitude: data.latitude, longitude: data.longitude, speedKmh: data.speedKmh, headingDegrees: 0, pingTime: new Date(data.timestamp).toISOString() }, ...previous].slice(0, 5000));
          setGpsError('');
        });
        cleanup = watchGpsConnection(ws, () => void poll(), value => { if (active) setConnected(value); });
      } catch {
        const timer = setInterval(() => void poll(), 5000);
        cleanup = () => clearInterval(timer);
      }
    }
    const pathTimer = setInterval(() => { if (active) setOrigin(previous => previous?.lat === latestPosition?.lat && previous?.lng === latestPosition?.lng ? previous : latestPosition); }, 15000);
    return () => { active = false; clearInterval(pathTimer); cleanup(); };
  }, [route.id, route.vehicleId, route.driverId, route.status]);
  const ordered = (path.data?.orderedOrderIds ?? []).flatMap(id => orders.find(o => o.id === id) ?? []);
  let planned: [number, number][] = [];
  let geometryError = '';
  try {
    planned = path.data?.polyline ? decodePolyline(path.data.polyline) : [...(origin ? [[origin.lat, origin.lng] as [number, number]] : []), ...ordered.map(o => [o.latitude, o.longitude] as [number, number])];
  } catch (cause) { geometryError = errorMessage(cause); }
  const latest = history[0];
  const source = path.data?.source ?? 'Sin fuente';
  return <section>
    <h3>Recorrido y seguimiento</h3>
    <SourceState {...path} retry={path.reload} /><SourceState error={geometryError || gpsError} />
    <p>Geometría: {source}{!path.data?.polyline && ' · Alternativa: segmentos rectos entre paradas en el orden del servidor'}. Estimación sin tráfico en tiempo real.</p>
    <p>GPS: {route.status !== 'IN_PROGRESS' ? 'Histórico del vehículo' : connected ? 'Canal conectado' : 'Consulta periódica de respaldo (5 s)'}{latest && ` · Último dato: ${new Date(latest.pingTime).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Lima)`}</p>
    <p>Plan: {path.data?.distanceKm ?? '—'} km · {path.data?.durationMin ?? '—'} min. Azul: plan del servidor; verde: GPS observado del vehículo.</p>
    <div style={{ height: 410 }}><TrackingMap center={latest ? [latest.latitude, latest.longitude] : planned[0]} plannedPath={planned} path={[...history].reverse().map(p => [p.latitude, p.longitude])} markers={[
      ...(latest ? [{ id: 'vehicle', title: `Vehículo #${route.vehicleId}`, position: [latest.latitude, latest.longitude] as [number, number], subtitle: `${latest.speedKmh} km/h` }] : []),
      ...ordered.map((o, index) => ({ id: `order-${o.id}`, title: `Parada ${index + 1}: ${o.trackingNumber}`, position: [o.latitude, o.longitude] as [number, number], subtitle: o.deliveryAddress })),
    ]} /></div>
    <ol>{ordered.map(o => <li key={o.id}>{o.trackingNumber} · {o.recipientName} · {o.status}</li>)}</ol>
  </section>;
}

function ReviewPanel({ route, vehicle, done }: { route: Route; vehicle?: Vehicle; done: () => void }) {
  const { hasRole } = useAuth();
  const review = useQuery<RouteReview>(`/routes/${route.id}/review`);
  const [form, setForm] = useState<ReviewRequest>({ capacityVerified: false, windowsVerified: false, vehicleChecked: false, loadWeightKg: 0, note: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reload = review.reload;
  useEffect(() => { const interval = setInterval(reload, 15000); return () => clearInterval(interval); }, [reload]);
  async function approve(event: FormEvent) {
    event.preventDefault();
    if (!hasRole(['ADMIN']) || !form.capacityVerified || !form.windowsVerified || !form.vehicleChecked || form.loadWeightKg <= 0 || form.note.trim().length < 5) return;
    setBusy(true); setMessage('');
    try { await approveRoute(route.id, form); review.reload(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function dispatch() {
    if (!review.data?.approved || !review.data.accepted) return;
    setBusy(true); setMessage('');
    try { await updateRouteStatus(route.id, 'IN_PROGRESS'); done(); }
    catch (cause) { setMessage(errorMessage(cause)); review.reload(); }
    finally { setBusy(false); }
  }
  return <section className="card"><h3>Revisión y aceptación · P02</h3><SourceState {...review} retry={review.reload} />
    <p>Aprobación administrativa: {review.data ? review.data.approved ? 'Aprobada' : 'Pendiente' : 'Sin información'} · Aceptación del conductor: {review.data ? review.data.accepted ? 'Aceptada' : 'Pendiente en móvil' : 'Sin información'}</p>
    <p>La aceptación la registra el conductor desde su aplicación. Toda nueva asignación de pedidos invalida ambas confirmaciones.</p>
    {review.data && <><p>Carga aprobada: {review.data.loadWeightKg ?? '—'} kg · Nota: {review.data.note || 'Sin nota'}</p><p>Aprobó: {review.data.approvedBy || 'Sin aprobación'} · {review.data.approvedAt || 'Sin fecha'}<br />Aceptó: {review.data.acceptedBy || 'Sin aceptación'} · {review.data.acceptedAt || 'Sin fecha'}</p></>}
    {route.status === 'PLANNED' && hasRole(['ADMIN']) && <form onSubmit={approve} className="operation-form">
      <label className="check"><input type="checkbox" required checked={form.capacityVerified} onChange={e => setForm({ ...form, capacityVerified: e.target.checked })} />Capacidad de carga verificada</label>
      <label className="check"><input type="checkbox" required checked={form.windowsVerified} onChange={e => setForm({ ...form, windowsVerified: e.target.checked })} />Ventanas de atención verificadas</label>
      <label className="check"><input type="checkbox" required checked={form.vehicleChecked} onChange={e => setForm({ ...form, vehicleChecked: e.target.checked })} />Vehículo inspeccionado</label>
      <label>Peso de carga (kg){vehicle && <span>Capacidad: {vehicle.capacityKg} kg</span>}<input type="number" required min={0.01} step="0.01" max={vehicle?.capacityKg} value={form.loadWeightKg || ''} onChange={e => setForm({ ...form, loadWeightKg: Number(e.target.value) })} /></label>
      <label>Nota de revisión<textarea required minLength={5} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
      <button disabled={busy || review.loading}>Guardar aprobación ADMIN</button>
    </form>}
    {route.status === 'PLANNED' && <div className="operation-actions"><button onClick={() => void dispatch()} disabled={busy || !review.data?.approved || !review.data.accepted}>Iniciar despacho</button></div>}
    {message && <p role="alert" className="source-error">{message}</p>}
  </section>;
}

function CreateRouteForm({ routes, drivers, vehicles, done }: { routes: Route[]; drivers: Driver[]; vehicles: Vehicle[]; done: () => void }) {
  const [form, setForm] = useState({ driverId: '', vehicleId: '', routeDate: operationDate(), startTime: '08:00' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRoutes = routes.filter(r => r.routeDate === form.routeDate && r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const availableDrivers = drivers.filter(d => d.isActive && !busyRoutes.some(r => r.driverId === d.id));
  const availableVehicles = vehicles.filter(v => v.isActive && !busyRoutes.some(r => r.vehicleId === v.id));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!availableDrivers.some(d => d.id === Number(form.driverId)) || !availableVehicles.some(v => v.id === Number(form.vehicleId))) { setError('Seleccione un conductor y vehículo disponibles para esa fecha.'); return; }
    setBusy(true); setError('');
    try { await createRoute({ driverId: Number(form.driverId), vehicleId: Number(form.vehicleId), routeDate: form.routeDate, estimatedStartTime: `${form.routeDate}T${form.startTime}:00-05:00` }); done(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form className="operation-form" onSubmit={submit}>
    <label>Fecha operativa (Lima)<input type="date" required min={operationDate()} value={form.routeDate} onChange={e => setForm({ ...form, routeDate: e.target.value, driverId: '', vehicleId: '' })} /></label>
    <label>Hora prevista (Lima)<input type="time" required value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></label>
    <label>Conductor disponible<select required value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value })}><option value="">Seleccionar conductor</option>{availableDrivers.map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName} · {d.licenseNumber}</option>)}</select></label>
    <label>Vehículo disponible<select required value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })}><option value="">Seleccionar vehículo</option>{availableVehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber} · {v.capacityKg} kg</option>)}</select></label>
    <p className="full">El servidor valida disponibilidad concurrente. Asigne pedidos y complete la revisión antes del despacho.</p>
    {error && <p role="alert" className="source-error full">{error}</p>}<button disabled={busy}>Crear ruta PLANNED</button>
  </form>;
}

export default function RoutesPage() {
  const routes = useQuery<Route[]>('/routes');
  const drivers = useQuery<Driver[]>('/drivers');
  const vehicles = useQuery<Vehicle[]>('/vehicles');
  const orders = useQuery<Order[]>('/orders');
  const [date, setDate] = useState<'TODAY' | 'TOMORROW' | 'ALL'>('TODAY');
  const [status, setStatus] = useState('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [backlogPage, setBacklogPage] = useState(1);
  const visible = (routes.data ?? []).filter(r => (date === 'ALL' || r.routeDate === operationDate(new Date(), date === 'TODAY' ? 0 : 1)) && (status === 'ALL' || r.status === status));
  const selected = visible.find(r => r.id === selectedId) ?? visible[0];
  const pending = (orders.data ?? []).filter(o => o.status === 'PENDING' && !o.routeId);
  const reloadOrders = orders.reload;
  useEffect(() => { const timer = setInterval(reloadOrders, 15000); return () => clearInterval(timer); }, [reloadOrders]);
  function refresh() { routes.reload(); orders.reload(); }
  return <main className="main-content operation-page">
    <header className="operation-toolbar"><h2 className="header-title">Gestión de despacho</h2><button onClick={() => setCreateOpen(true)} disabled={!drivers.data || !vehicles.data || !routes.data}>Nueva ruta</button><button onClick={refresh}>Actualizar</button></header>
    <div className="operation-toolbar"><label>Fecha<select value={date} onChange={e => setDate(e.target.value as typeof date)}><option value="TODAY">Hoy · {operationDate()}</option><option value="TOMORROW">Mañana · {operationDate(new Date(), 1)}</option><option value="ALL">Histórico</option></select></label>
      <label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Todos</option>{['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}</select></label></div>
    <SourceState {...routes} retry={routes.reload} /><SourceState loading={drivers.loading} error={drivers.error && `Conductores: ${drivers.error}`} retry={drivers.reload} /><SourceState loading={vehicles.loading} error={vehicles.error && `Vehículos: ${vehicles.error}`} retry={vehicles.reload} />
    <div className="operation-grid"><section className="card"><h3>Rutas · {visible.length}</h3><div className="operation-actions">{visible.map(r => <button key={r.id} onClick={() => setSelectedId(r.id)} aria-pressed={selected?.id === r.id}>#{r.id} · {r.routeDate} · {r.status}</button>)}</div>{routes.data && !visible.length && <p>Sin rutas para estos filtros.</p>}</section>
      {selected && <section className="card"><h3>Ruta #{selected.id} · {selected.status}</h3><p>Conductor: {drivers.data?.find(d => d.id === selected.driverId)?.firstName ?? `#${selected.driverId}`} · Vehículo: {vehicles.data?.find(v => v.id === selected.vehicleId)?.plateNumber ?? `#${selected.vehicleId}`}</p><p>Fecha: {selected.routeDate} · {orders.data?.filter(o => o.routeId === selected.id).length ?? '—'} pedidos</p></section>}</div>
    {selected && <><ReviewPanel key={`${selected.id}:${orders.data?.filter(o => o.routeId === selected.id).map(o => o.id).join(',')}`} route={selected} vehicle={vehicles.data?.find(v => v.id === selected.vehicleId)} done={refresh} /><div className="card"><RouteTracking key={selected.id} route={selected} orders={(orders.data ?? []).filter(o => o.routeId === selected.id)} /></div></>}
    <section className="card"><h3>Backlog PENDING sin ruta · {pending.length}</h3><SourceState {...orders} retry={orders.reload} /><p>Revise datos comerciales en Pedidos. La asignación conserva el pedido e invalida aprobación y aceptación previas de la ruta destino.</p>
      <div className="table-scroll"><table className="operation-table"><thead><tr><th>Pedido</th><th>Destinatario</th><th>Confirmación y asignación</th></tr></thead><tbody>{pending.slice((backlogPage - 1) * 10, backlogPage * 10).map(o => <tr key={o.id}><td>{o.trackingNumber}</td><td>{o.recipientName}</td><td><OrderAssignment order={o} routes={routes.data ?? []} done={refresh} /></td></tr>)}</tbody></table></div><Pagination currentPage={backlogPage} totalItems={pending.length} itemsPerPage={10} onPageChange={setBacklogPage} />
    </section>
    {createOpen && <Modal title="Planificar ruta" close={() => setCreateOpen(false)}><CreateRouteForm routes={routes.data ?? []} drivers={drivers.data ?? []} vehicles={vehicles.data ?? []} done={() => { setCreateOpen(false); refresh(); }} /></Modal>}
  </main>;
}
