import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { assignOrder, createOrder, deleteOrder, proofBlob, saveBusinessData, updateOrderStatus } from '../services/orderService';
import type { BusinessData, DeliveryProof, Order } from '../services/orderService';
import type { Route } from '../services/routeService';
import api from '../services/api';
import { useQuery } from '../hooks/useQuery';
import { Modal, SourceState } from '../components/Operations';
import Pagination from '../components/Pagination';
import { DeliveryWindowEditor } from '../components/DeliveryWindowEditor';
import { businessConfirmed, canAssign, csvContent, downloadBlob, errorMessage, failureReasons, isTerminal, manualTransitions, validRuc } from '../utils/operation';

const emptyBusiness: BusinessData = { recipientRuc: '', customerAccepted: false, addressVerified: false, coverageVerified: false, agreementNote: '' };

function BusinessFields({ data, change, disabled = false }: { data: BusinessData; change: (value: BusinessData) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="operation-form full"><legend>Confirmación comercial declarada · P01</legend>
    <label>RUC del destinatario (opcional, 11 dígitos)<input inputMode="numeric" pattern="[0-9]{11}" maxLength={11} value={data.recipientRuc ?? ''} onChange={e => change({ ...data, recipientRuc: e.target.value })} /></label>
    <label className="check"><input type="checkbox" checked={data.customerAccepted} onChange={e => change({ ...data, customerAccepted: e.target.checked })} />Cliente aceptó las condiciones</label>
    <label className="check"><input type="checkbox" checked={data.addressVerified} onChange={e => change({ ...data, addressVerified: e.target.checked })} />Dirección verificada</label>
    <label className="check"><input type="checkbox" checked={data.coverageVerified} onChange={e => change({ ...data, coverageVerified: e.target.checked })} />Cobertura verificada</label>
    <label className="full">Condiciones acordadas / nota de revisión<textarea required minLength={5} value={data.agreementNote} onChange={e => change({ ...data, agreementNote: e.target.value })} /></label>
    <p className="full">La declaración del operador queda asociada a la sesión. Con alguna revisión pendiente, complete la confirmación antes de asignar el pedido o aprobar el despacho.</p>
  </fieldset>;
}

export function OrderAssignment({ order, routes, done }: { order: Order; routes: Route[]; done: () => void }) {
  const business = useQuery<BusinessData>(`/orders/${order.id}/business-data`);
  const [routeId, setRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function assign() {
    const route = routes.find(item => item.id === Number(routeId));
    if (!route || !canAssign(order.status, businessConfirmed(business.data), route.status)) return;
    setBusy(true); setError('');
    try { await assignOrder(order.id, route.id); done(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div>
    <SourceState {...business} retry={business.reload} />
    {business.data && <p>{businessConfirmed(business.data) ? 'Datos comerciales confirmados' : 'Pendiente de datos / aceptación comercial, dirección o cobertura'}</p>}
    {order.status === 'PENDING' && <div className="operation-actions">
      <select aria-label={`Ruta para ${order.trackingNumber}`} value={routeId} onChange={e => setRouteId(e.target.value)} disabled={!businessConfirmed(business.data) || busy}>
        <option value="">Elegir ruta PLANNED</option>{routes.filter(r => r.status === 'PLANNED').map(r => <option key={r.id} value={r.id}>#{r.id} · {r.routeDate}</option>)}
      </select><button disabled={busy || !routeId || !businessConfirmed(business.data)} onClick={() => void assign()}>Asignar</button>
    </div>}
    {error && <p role="alert" className="source-error">{error}</p>}
  </div>;
}

function BusinessEditor({ order, routeStatus, done }: { order: Order; routeStatus?: string; done: () => void }) {
  const query = useQuery<BusinessData>(`/orders/${order.id}/business-data`);
  const [draft, setDraft] = useState<BusinessData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [windowOrder, setWindowOrder] = useState<Order | null>(null);
  const [windowDirty, setWindowDirty] = useState(false);
  const [acceptanceInvalidated, setAcceptanceInvalidated] = useState(false);
  const currentOrder = windowOrder ?? order;
  const data = draft ?? (query.data && { ...query.data, customerAccepted: acceptanceInvalidated ? false : query.data.customerAccepted });
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || windowDirty || !data || !validRuc(data.recipientRuc ?? '') || data.agreementNote.trim().length < 5) return;
    setBusy(true); setMessage('');
    try { const saved = await saveBusinessData(order.id, data); setDraft(saved); setAcceptanceInvalidated(false); query.reload(); done(); setMessage('Confirmación guardada.'); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section>
    <DeliveryWindowEditor key={`${currentOrder.id}:${currentOrder.estimatedDeliveryWindowStart}:${currentOrder.estimatedDeliveryWindowEnd}`} order={currentOrder} routeStatus={routeStatus} busy={busy} setBusy={setBusy} onDirtyChange={setWindowDirty} onSaved={saved => {
      setWindowOrder(saved); setDraft(null); setWindowDirty(false); setAcceptanceInvalidated(true); query.reload(); done();
      setMessage('Ventana guardada. Aceptación comercial pendiente: revise las condiciones y marque nuevamente la aceptación del cliente.');
    }} />
    {windowDirty && <p role="status">Hay una ventana sin guardar. Guarde o descarte esa edición antes de confirmar el acuerdo comercial.</p>}
    <SourceState {...query} retry={query.reload} />{data && <form className="operation-form" onSubmit={save}>
    <BusinessFields data={data} change={setDraft} disabled={busy || windowDirty || !['PENDING', 'ASSIGNED'].includes(order.status)} />
    {acceptanceInvalidated && <p className="full" role="status">La nueva ventana requiere renovar la aceptación del cliente. La revisión y aceptación de la ruta también deben renovarse.</p>}
    <p className="full">Última revisión registrada por: {data.confirmedBy || 'Sin confirmación'} · {data.confirmedAt || 'Sin fecha'}</p>
    {['PENDING', 'ASSIGNED'].includes(order.status) && <button disabled={busy || windowDirty || query.loading} type="submit">Guardar revisión comercial</button>}
    {message && <p role="status">{message}</p>}
  </form>}</section>;
}

function ProofImage({ orderId, kind }: { orderId: number; kind: 'photo' | 'signature' }) {
  const [image, setImage] = useState<{ url?: string; error?: string }>({});
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    proofBlob(orderId, kind).then(blob => {
      if (active) { url = URL.createObjectURL(blob); setImage({ url }); }
    }).catch(cause => { if (active) setImage({ error: errorMessage(cause) }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [orderId, kind]);
  return <figure><figcaption>{kind === 'photo' ? 'Foto de entrega' : 'Firma del receptor'}</figcaption>
    <SourceState loading={!image.url && !image.error} error={image.error} />
    {image.url && <img src={image.url} alt={kind === 'photo' ? 'Evidencia de entrega' : 'Firma registrada del receptor'} />}
  </figure>;
}

function OrderDetail({ order, routes, done }: { order: Order; routes: Route[]; done: () => void }) {
  const proof = useQuery<DeliveryProof>(`/delivery-proofs/${order.id}`);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [commercialRevision, setCommercialRevision] = useState(0);
  const transitions = manualTransitions(order.status);
  async function changeStatus(event: FormEvent) {
    event.preventDefault();
    if (!transitions.includes(status)) return;
    setBusy(true); setMessage('');
    try { await updateOrderStatus(order.id, status, `${reason}${note ? `: ${note.trim()}` : ''}`); setStatus(''); done(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function pdf() {
    try { downloadBlob(await proofBlob(order.id, 'pdf'), `comprobante_${order.trackingNumber}.pdf`); }
    catch (cause) { setMessage(errorMessage(cause)); }
  }
  return <div>
    <p>{order.recipientName} · {order.recipientPhone} · {order.recipientEmail}</p>
    <p>{order.deliveryAddress}, {order.deliveryDistrict}, {order.deliveryCity}</p>
    <p>Estado: <strong>{order.status}</strong> · Referencia externa: {order.externalReference || 'Sin referencia'} · Ruta: {order.routeId ?? 'Sin asignar'}</p>
    <p>Ventana acordada: {order.estimatedDeliveryWindowStart ? new Date(order.estimatedDeliveryWindowStart).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Inicio no registrado'} a {order.estimatedDeliveryWindowEnd ? new Date(order.estimatedDeliveryWindowEnd).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Fin no registrado'} (Lima)</p>
    <BusinessEditor order={order} routeStatus={routes.find(route => route.id === order.routeId)?.status} done={() => { setCommercialRevision(value => value + 1); done(); }} />
    <OrderAssignment key={commercialRevision} order={order} routes={routes} done={done} />
    <p>Asignar un pedido invalida la aprobación administrativa y la aceptación del conductor de la ruta destino. Ambas deberán renovarse.</p>
    {isTerminal(order.status) ? <p>Pedido cerrado. Estado y evidencia son de solo lectura. Un nuevo intento se gestiona desde Incidencias.</p> : <>
      <p>La entrega se confirma en la aplicación del conductor con foto, firma, receptor y GPS reales.</p>
      {transitions.length > 0 && <form onSubmit={changeStatus} className="operation-form">
        <label>Siguiente estado<select required value={status} onChange={e => { setStatus(e.target.value); setReason(''); }}><option value="">Seleccionar</option>{transitions.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Motivo<select required value={reason} onChange={e => setReason(e.target.value)}><option value="">Seleccionar motivo</option>
          {(status === 'FAILED' || status === 'RETURNED' ? failureReasons : ['Recojo confirmado', 'Inicio de traslado confirmado']).map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Detalle<textarea value={note} required={reason === 'Otro motivo documentado'} minLength={5} onChange={e => setNote(e.target.value)} /></label>
        <button disabled={busy || !status} type="submit">Guardar estado</button>
      </form>}
    </>}
    {message && <p role="alert" className="source-error">{message}</p>}
    <h3>Prueba de entrega (POD)</h3><SourceState {...proof} retry={proof.reload} />
    {proof.data && <><p>Receptor: {proof.data.receiverName} · DNI: {proof.data.receiverDni}</p>
      <p>Verificado: {new Date(proof.data.verifiedAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Lima) · GPS: {proof.data.latitude}, {proof.data.longitude}</p>
      <div className="proof-images"><ProofImage orderId={order.id} kind="photo" /><ProofImage orderId={order.id} kind="signature" /></div>
      <div className="operation-actions"><button onClick={() => void pdf()}>Descargar PDF con foto y firma</button></div></>}
  </div>;
}

function CreateOrder({ done }: { done: (order: Order) => void }) {
  const [form, setForm] = useState({ trackingNumber: '', externalReference: '', recipientName: '', recipientPhone: '', recipientEmail: '', deliveryAddress: '', deliveryCity: 'Lima', deliveryDistrict: '', latitude: '', longitude: '', priority: 0 });
  const [business, setBusiness] = useState<BusinessData>(emptyBusiness);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [created, setCreated] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validRuc(business.recipientRuc ?? '') || business.agreementNote.trim().length < 5) return;
    if ((windowStart || windowEnd) && (!windowStart || !windowEnd || windowStart >= windowEnd)) { setMessage('Registre inicio y fin de ventana en Lima, con fin posterior al inicio.'); return; }
    const latitude = Number(form.latitude), longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) { setMessage('Indique coordenadas verificadas distintas de cero.'); return; }
    setBusy(true); setMessage('');
    try {
      const order = created ?? await createOrder({ ...form, latitude, longitude, routeId: null, estimatedDeliveryWindowStart: windowStart ? `${windowStart}:00-05:00` : undefined, estimatedDeliveryWindowEnd: windowEnd ? `${windowEnd}:00-05:00` : undefined });
      setCreated(order);
      try { await saveBusinessData(order.id, business); done(order); }
      catch (cause) { setMessage(`Pedido #${order.id} creado sin ruta. Falta guardar los datos comerciales: ${errorMessage(cause)}. Reintentar guarda sobre el mismo pedido.`); }
    } catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function geocode() {
    setBusy(true); setMessage('');
    try {
      const query = [form.deliveryAddress, form.deliveryDistrict, form.deliveryCity, 'Peru'].join(', ');
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`Geocodificador: HTTP ${response.status}`);
      const rows: { lat: string; lon: string; display_name: string }[] = await response.json();
      if (!rows[0]) throw new Error('Sin coincidencias. Verifique dirección y coordenadas antes de confirmar.');
      setForm({ ...form, latitude: rows[0].lat, longitude: rows[0].lon }); setMessage(`Resultado propuesto: ${rows[0].display_name}. Confirme que corresponde a la dirección.`);
    } catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="operation-form">
    <p className="full">Alta sin ruta en PENDING. Después de guardar puede revisar y asignar el mismo pedido.</p>
    <fieldset disabled={busy || !!created} className="operation-form full"><legend>Datos del pedido</legend>
      {(['trackingNumber', 'externalReference', 'recipientName', 'recipientPhone', 'recipientEmail', 'deliveryAddress', 'deliveryCity', 'deliveryDistrict'] as const).map(key => <label key={key}>
        {{ trackingNumber: 'Tracking', externalReference: 'Referencia externa (separada del RUC)', recipientName: 'Destinatario', recipientPhone: 'Teléfono', recipientEmail: 'Correo', deliveryAddress: 'Dirección', deliveryCity: 'Ciudad', deliveryDistrict: 'Distrito' }[key]}
        <input required={key !== 'externalReference' && key !== 'recipientEmail'} type={key === 'recipientEmail' ? 'email' : 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label>Latitud<input required type="number" step="any" min={-90} max={90} value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></label>
      <label>Longitud<input required type="number" step="any" min={-180} max={180} value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></label>
      <label>Prioridad<input type="number" min={0} max={10} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} /></label>
      <label>Ventana de entrega: inicio (Lima, opcional)<input type="datetime-local" value={windowStart} required={!!windowEnd} onChange={e => setWindowStart(e.target.value)} /></label>
      <label>Ventana de entrega: fin (Lima, opcional)<input type="datetime-local" value={windowEnd} required={!!windowStart} min={windowStart || undefined} onChange={e => setWindowEnd(e.target.value)} /></label>
      <button type="button" onClick={() => void geocode()} disabled={form.deliveryAddress.trim().length < 5}>Localizar dirección</button>
    </fieldset>
    <BusinessFields data={business} change={setBusiness} disabled={busy} />
    {message && <p className="full" role="status">{message}</p>}
    <button disabled={busy} type="submit">{busy ? 'Guardando…' : created ? 'Reintentar revisión del pedido creado' : 'Guardar pedido sin ruta'}</button>
    {created && <button type="button" onClick={() => done(created)}>Abrir pedido creado y completar después</button>}
  </form>;
}

export default function Orders() {
  const orders = useQuery<Order[]>('/orders');
  const routes = useQuery<Route[]>('/routes');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Order[] | null>(null);
  const [validatedCsv, setValidatedCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const filtered = (orders.data ?? []).filter(o => (status === 'ALL' || o.status === status) && `${o.trackingNumber} ${o.recipientName}`.toLowerCase().includes(search.toLowerCase()));
  const detail = orders.data?.find(o => o.id === selected);
  function refresh() { orders.reload(); routes.reload(); }
  async function remove(order: Order) {
    if (isTerminal(order.status) || !window.confirm(`¿Eliminar el pedido ${order.trackingNumber}?`)) return;
    setBusy(true);
    try { await deleteOrder(order.id); setSelected(null); refresh(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function importCsv(event: FormEvent) {
    event.preventDefault(); if (!csv) return;
    setBusy(true); setMessage('');
    try {
      if (!csvPreview) {
        const content = await csv.text();
        const response = await api.post<Order[]>('/orders/bulk-csv/preview', content, { headers: { 'Content-Type': 'text/plain' } });
        setValidatedCsv(content); setCsvPreview(response.data);
        setMessage(`Formato validado: ${response.data.length} pedidos. No se ha guardado ninguno. Confirme la importación; los conflictos con registros existentes se verifican al guardar.`);
      } else {
        await api.post('/orders/bulk-csv', validatedCsv, { headers: { 'Content-Type': 'text/plain' } });
        setCsvOpen(false); setCsvPreview(null); setValidatedCsv(''); setCsv(null); refresh();
        setMessage('CSV importado. Revise los datos comerciales de cada pedido antes de asignarlo.');
      }
    }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <main className="main-content operation-page">
    <header className="operation-toolbar"><h2 className="header-title">Gestión de pedidos · P01</h2><button onClick={() => setCreateOpen(true)}>Nuevo pedido</button><button onClick={() => setCsvOpen(true)}>Importar CSV</button><button onClick={refresh}>Actualizar</button></header>
    <div className="operation-toolbar"><label>Buscar<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tracking o destinatario" /></label>
      <label>Estado<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="ALL">Todos</option>{['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED'].map(s => <option key={s}>{s}</option>)}</select></label></div>
    <SourceState {...orders} retry={orders.reload} /><SourceState loading={routes.loading} error={routes.error && `Rutas: ${routes.error}`} retry={routes.reload} />{message && <p role="status">{message}</p>}
    <div className="card table-scroll"><table className="operation-table"><thead><tr><th>Tracking</th><th>Destinatario</th><th>Ruta</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {filtered.slice((page - 1) * 10, page * 10).map(o => <tr key={o.id}><td>{o.trackingNumber}</td><td>{o.recipientName}</td><td>{o.routeId ?? 'Sin asignar'}</td><td>{o.status}</td><td><div className="operation-actions"><button onClick={() => setSelected(o.id)}>Detalles / confirmar / asignar / POD</button><button disabled={busy || isTerminal(o.status)} onClick={() => void remove(o)}>Eliminar</button></div></td></tr>)}
    </tbody></table>{orders.data && filtered.length === 0 && <p>Sin pedidos para estos filtros.</p>}<Pagination currentPage={page} totalItems={filtered.length} itemsPerPage={10} onPageChange={setPage} /></div>
    {createOpen && <Modal title="Nuevo pedido sin ruta" close={() => setCreateOpen(false)}><CreateOrder done={order => { setCreateOpen(false); setSelected(order.id); refresh(); }} /></Modal>}
    {detail && <Modal title={`Pedido ${detail.trackingNumber}`} close={() => setSelected(null)}><OrderDetail key={`${detail.id}:${detail.status}`} order={detail} routes={routes.data ?? []} done={refresh} /></Modal>}
    {csvOpen && <Modal title="Importación CSV de pedidos" close={() => setCsvOpen(false)}><form onSubmit={importCsv} className="operation-form"><p className="full">Los pedidos importados requieren confirmación comercial, dirección y cobertura antes de asignarse. Use entre 8 y 11 columnas, incluido teléfono; routeId debe quedar vacío. El servicio valida el archivo completo: si una fila falla no importa ningún pedido y devuelve el número de fila.</p><button type="button" onClick={() => downloadBlob(new Blob([csvContent([['trackingNumber', 'recipientName', 'deliveryAddress', 'latitude', 'longitude', 'externalReference', 'routeId', 'recipientPhone', 'recipientEmail', 'deliveryCity', 'deliveryDistrict']])], { type: 'text/csv;charset=utf-8' }), 'plantilla_pedidos.csv')}>Descargar plantilla de cabecera CSV</button><label>Archivo CSV<input required disabled={busy} type="file" accept=".csv,text/csv" onChange={e => { setCsv(e.target.files?.[0] ?? null); setCsvPreview(null); setValidatedCsv(''); setMessage(''); }} /></label><button disabled={busy || !csv}>{csvPreview ? 'Confirmar importación' : 'Validar y previsualizar'}</button>{csvPreview && <section className="full table-scroll" aria-label="Vista previa CSV"><h3>Vista previa CSV</h3><p>Primeros {Math.min(10, csvPreview.length)} de {csvPreview.length} pedidos. Aún no guardados.</p><table className="operation-table"><thead><tr><th>Tracking</th><th>Destinatario</th><th>Dirección</th><th>Teléfono</th></tr></thead><tbody>{csvPreview.slice(0, 10).map(order => <tr key={order.trackingNumber}><td>{order.trackingNumber}</td><td>{order.recipientName}</td><td>{order.deliveryAddress}</td><td>{order.recipientPhone}</td></tr>)}</tbody></table></section>}{message && <p role="alert">{message}</p>}</form></Modal>}
  </main>;
}
