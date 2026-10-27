import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '../hooks/useQuery';
import { useAuth } from '../context/useAuth';
import { Modal, SourceState } from '../components/Operations';
import type { Driver } from '../services/driverService';
import type { AppRole, Identity, UserRole } from '../services/userService';
import { updateIdentityEnabled, updateIdentityRoles } from '../services/userService';
import { errorMessage } from '../utils/operation';

function IdentityEditor({ identity, drivers, done }: { identity: Identity; drivers: Driver[]; done: () => void }) {
  const [roles, setRoles] = useState(identity.roles);
  const [driverId, setDriverId] = useState(identity.driverId?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!roles.length) return;
    setBusy(true); setMessage('');
    try { await updateIdentityRoles(identity.id, roles, roles.includes('DRIVER') && driverId ? Number(driverId) : undefined); done(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="operation-form"><p className="full">Cuenta: {identity.username} · subject: {identity.id}. Los roles se guardan en Keycloak. El servidor revoca las sesiones afectadas; el usuario deberá iniciar sesión de nuevo.</p>
    {(['ADMIN', 'DISPATCHER', 'DRIVER'] as AppRole[]).map(role => <label className="check" key={role}><input type="checkbox" disabled={busy || (identity.id === user?.subject && role === 'ADMIN')} checked={roles.includes(role)} onChange={e => setRoles(e.target.checked ? [...roles, role] : roles.filter(r => r !== role))} />{role}</label>)}
    {roles.includes('DRIVER') && <label>Vincular conductor activo<select required value={driverId} onChange={e => setDriverId(e.target.value)}><option value="">Seleccionar conductor</option>{drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName} · #{d.id}</option>)}</select><span>El servidor valida que no esté vinculado a otra cuenta.</span></label>}
    <button disabled={busy || !roles.length}>Guardar roles efectivos</button>{message && <p role="alert" className="source-error full">{message}</p>}
  </form>;
}

export default function Users() {
  const identities = useQuery<Identity[]>('/users/identities');
  const drivers = useQuery<Driver[]>('/drivers');
  const [tab, setTab] = useState<'KEYCLOAK' | 'LEGACY'>('KEYCLOAK');
  const legacy = useQuery<UserRole[]>(tab === 'LEGACY' ? '/users' : null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  async function enabled(identity: Identity) {
    if (!window.confirm(`¿${identity.enabled ? 'Deshabilitar' : 'Habilitar'} la cuenta ${identity.username}?`)) return;
    setBusy(true); setMessage('');
    try { await updateIdentityEnabled(identity.id, !identity.enabled); identities.reload(); }
    catch (cause) { setMessage(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <main className="main-content operation-page"><h2 className="header-title">Usuarios e identidades · P08</h2>
    <div className="operation-toolbar"><button aria-pressed={tab === 'KEYCLOAK'} onClick={() => setTab('KEYCLOAK')}>Roles efectivos Keycloak</button><button aria-pressed={tab === 'LEGACY'} onClick={() => setTab('LEGACY')}>Registro local anterior · migración</button><label>Buscar cuenta<input value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {message && <p role="alert" className="source-error">{message}</p>}
    {tab === 'KEYCLOAK' ? <><p>La autorización proviene de Keycloak y la sesión validada del backend. La vinculación del conductor utiliza su subject real.</p>
      <SourceState {...identities} retry={identities.reload} /><SourceState {...drivers} retry={drivers.reload} />
      <div className="card table-scroll"><table className="operation-table"><thead><tr><th>Cuenta / subject</th><th>Roles efectivos</th><th>Conductor</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {(identities.data ?? []).filter(i => `${i.username} ${i.id}`.toLowerCase().includes(search.toLowerCase())).map(i => <tr key={i.id}><td>{i.username}<br /><small>{i.id}</small></td><td>{i.roles.join(', ') || 'Sin roles de aplicación'}</td><td>{i.driverId ?? 'Sin vinculación'}</td><td>{i.enabled ? 'Habilitado' : 'Deshabilitado'}</td><td><div className="operation-actions"><button onClick={() => setEditing(i)} disabled={!drivers.data || busy}>Editar roles / conductor</button><button disabled={busy || i.id === user?.subject} onClick={() => void enabled(i)}>{i.enabled ? 'Deshabilitar' : 'Habilitar'}</button></div></td></tr>)}
      </tbody></table>{identities.data?.length === 0 && <p>Sin identidades.</p>}</div>
    </> : <section className="card"><h3>Gestión local anterior conservada para consulta</h3><p>Estos registros no conceden acceso efectivo. Las escrituras de la API anterior fueron retiradas (410); realice la migración y gestión de roles en la pestaña Keycloak.</p><SourceState {...legacy} retry={legacy.reload} />
      <table className="operation-table"><thead><tr><th>ID</th><th>Subject anterior</th><th>ID de rol local</th></tr></thead><tbody>{(legacy.data ?? []).map(row => <tr key={row.id}><td>{row.id}</td><td>{row.userExternalId}</td><td>{row.roleId}</td></tr>)}</tbody></table>
    </section>}
    {editing && <Modal title={`Roles de ${editing.username}`} close={() => setEditing(null)}><IdentityEditor key={editing.id} identity={editing} drivers={drivers.data ?? []} done={() => { setEditing(null); identities.reload(); setMessage('Roles guardados en Keycloak. La cuenta afectada debe volver a iniciar sesión.'); }} /></Modal>}
  </main>;
}
