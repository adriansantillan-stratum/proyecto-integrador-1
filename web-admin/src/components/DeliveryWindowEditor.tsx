import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Order } from '../services/orderService';
import { updateDeliveryWindow } from '../services/orderService';
import { buildDeliveryWindowRequest, canEditDeliveryWindow, limaDateTime } from '../utils/deliveryWindow';
import type { DeliveryWindowRequest } from '../utils/deliveryWindow';
import { errorMessage } from '../utils/operation';

export function DeliveryWindowEditor({ order, routeStatus, busy, setBusy, onDirtyChange, onSaved }: {
  order: Order; routeStatus?: string; busy: boolean; setBusy: (value: boolean) => void;
  onDirtyChange: (dirty: boolean) => void; onSaved: (order: Order) => void;
}) {
  const initialStart = limaDateTime(order.estimatedDeliveryWindowStart);
  const initialEnd = limaDateTime(order.estimatedDeliveryWindowEnd);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const editable = canEditDeliveryWindow(order.status, order.routeId, routeStatus);
  const dirty = start !== initialStart || end !== initialEnd;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editable || busy) return;
    setError('');
    let request: DeliveryWindowRequest;
    try { request = buildDeliveryWindowRequest(start, end, reason); }
    catch (cause) { setError(errorMessage(cause)); return; }
    setBusy(true);
    try { const saved = await updateDeliveryWindow(order.id, request); onDirtyChange(false); onSaved(saved); setReason(''); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  if (!editable) return <p>Ventana de solo lectura: se edita únicamente en PENDING/ASSIGNED y, si tiene ruta, con esa ruta PLANNED.{order.routeId !== null && !routeStatus && ' No se pudo verificar el estado de la ruta; recargue las rutas antes de editar.'}</p>;
  return <form className="operation-form" aria-label="Editar ventana de entrega" onSubmit={submit}>
    <h3 className="full">Editar ventana del pedido existente / replanificación</h3>
    <p className="full">Guarde primero la nueva ventana y vuelva a confirmar el acuerdo comercial debajo. Guardar retira la aceptación del cliente e invalida la revisión y aceptación de la ruta; conserva RUC, dirección y cobertura revisadas.</p>
    <fieldset disabled={busy} className="operation-form full"><legend>Ventana acordada · America/Lima</legend>
      <label>Nuevo inicio (Lima)<input required type="datetime-local" step={1} value={start} onChange={e => { setStart(e.target.value); onDirtyChange(e.target.value !== initialStart || end !== initialEnd); }} /></label>
      <label>Nuevo fin (Lima)<input required type="datetime-local" step={1} min={start || undefined} value={end} onChange={e => { setEnd(e.target.value); onDirtyChange(start !== initialStart || e.target.value !== initialEnd); }} /></label>
      <label className="full">Motivo del cambio de ventana<textarea required minLength={5} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button type="submit" disabled={!dirty}>Guardar nueva ventana</button>
      {dirty && <button type="button" onClick={() => { setStart(initialStart); setEnd(initialEnd); setReason(''); setError(''); onDirtyChange(false); }}>Descartar edición de ventana</button>}
    </fieldset>
    {error && <p role="alert" className="source-error full">{error}</p>}
  </form>;
}
