import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '../hooks/useQuery';
import { useAuth } from '../context/useAuth';
import { Modal, SourceState } from './Operations';
import type { MetricCode } from '../services/analyticsTypes';
import type { ActionStatus, ImprovementAction } from '../services/improvementService';
import { createImprovement, updateImprovement } from '../services/improvementService';
import { errorMessage, operationDate } from '../utils/operation';
import { metricCodes } from '../utils/analytics';

function ActionForm({ done }: { done: () => void }) {
  const [form, setForm] = useState({ title: '', cause: '', ownerName: '', dueDate: operationDate(), metricCode: 'IID' as MetricCode, baselineValue: '', targetValue: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await createImprovement({ ...form, baselineValue: form.baselineValue === '' ? undefined : Number(form.baselineValue), targetValue: form.targetValue === '' ? undefined : Number(form.targetValue) }); done(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form className="operation-form" onSubmit={submit}>
    <label>Título<input required minLength={5} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <label>Responsable humano<input required minLength={3} value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} /></label>
    <label className="full">Causa que se busca atender<textarea required minLength={5} value={form.cause} onChange={e => setForm({ ...form, cause: e.target.value })} /></label>
    <label>Fecha compromiso (Lima)<input required type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
    <label>Indicador<select value={form.metricCode} onChange={e => setForm({ ...form, metricCode: e.target.value as MetricCode })}>{metricCodes.map(code => <option key={code}>{code}</option>)}</select></label>
    <label>Línea base declarada (opcional)<input type="number" step="any" min={0} max={100} value={form.baselineValue} onChange={e => setForm({ ...form, baselineValue: e.target.value })} /></label>
    <label>Meta de la acción (opcional)<input type="number" step="any" min={0} max={100} value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} /></label>
    <p className="full">Los valores declarados pertenecen a esta acción. Los resultados operativos de BI se calculan con la API.</p>
    <button disabled={busy}>Crear acción</button>{message && <p role="alert" className="source-error">{message}</p>}
  </form>;
}

function ActionUpdate({ action, done }: { action: ImprovementAction; done: () => void }) {
  const { hasRole } = useAuth();
  const [status, setStatus] = useState<ActionStatus>('IN_PROGRESS');
  const [result, setResult] = useState(action.resultValue?.toString() ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === 'VERIFIED' && (!hasRole(['ADMIN']) || result === '')) return;
    setBusy(true); setMessage('');
    try { await updateImprovement(action.id, status, note.trim(), result === '' ? undefined : Number(result)); done(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form className="operation-form" onSubmit={submit}><p className="full">{action.title} · Responsable: {action.ownerName}. La verificación requiere un administrador, valor observado y justificación.</p>
    <label>Estado<select aria-label="Estado" value={status} onChange={e => setStatus(e.target.value as ActionStatus)}><option value="IN_PROGRESS">En progreso</option>{hasRole(['ADMIN']) && <>{action.status === 'IN_PROGRESS' && <option value="VERIFIED">Verificada por ADMIN</option>}<option value="DISCARDED">Descartada por ADMIN</option></>}</select></label>
    <label>Resultado observado<input type="number" step="any" min={0} max={100} required={status === 'VERIFIED'} value={result} onChange={e => setResult(e.target.value)} /></label>
    <label className="full">Nota de seguimiento / evidencia<textarea required minLength={5} value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy}>Guardar seguimiento</button>
    {message && <p role="alert" className="source-error">{message}</p>}
  </form>;
}

export function ImprovementActions() {
  const actions = useQuery<ImprovementAction[]>('/improvement-actions');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ImprovementAction | null>(null);
  return <section><div className="operation-toolbar"><h3>Acciones de mejora · P05</h3><button onClick={() => setCreateOpen(true)}>Nueva acción</button><button onClick={actions.reload}>Actualizar</button></div>
    <SourceState {...actions} retry={actions.reload} /><p>Control humano: documentar causa, responsable, fecha compromiso y resultado. Las compras P09 requieren revisión presupuestaria humana; el CRUD de compras no constituye una aprobación automática.</p>
    <div className="card table-scroll"><table className="operation-table"><thead><tr>{['Acción / causa', 'Responsable / plazo', 'Indicador', 'Base declarada / meta', 'Estado / resultado', 'Seguimiento'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
      {(actions.data ?? []).map(a => <tr key={a.id}><td>{a.title}<p>{a.cause}</p></td><td>{a.ownerName}<p>{a.dueDate}</p></td><td>{a.metricCode}</td><td>{a.baselineValue ?? '—'} / {a.targetValue ?? '—'}</td><td>{a.status}<p>{a.resultValue ?? 'Sin resultado observado'}</p><p>{a.note}</p>{a.verifiedBy && <p>Verificó: {a.verifiedBy}</p>}</td><td>{!['VERIFIED', 'DISCARDED'].includes(a.status) ? <div className="operation-actions"><button onClick={() => setSelected(a)}>Registrar seguimiento</button></div> : 'Cerrada · solo lectura'}</td></tr>)}
    </tbody></table>{actions.data?.length === 0 && <p>Sin acciones registradas.</p>}</div>
    {createOpen && <Modal title="Nueva acción de mejora" close={() => setCreateOpen(false)}><ActionForm done={() => { setCreateOpen(false); actions.reload(); }} /></Modal>}
    {selected && <Modal title={`Seguimiento de acción #${selected.id}`} close={() => setSelected(null)}><ActionUpdate action={selected} done={() => { setSelected(null); actions.reload(); }} /></Modal>}
  </section>;
}
