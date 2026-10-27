import React, { useEffect, useState } from 'react';
import { UserPlus, Search, Edit2, Trash2, Loader2, X } from 'lucide-react';
import { getAllDrivers, deleteDriver, createDriver, updateDriver } from '../services/driverService';
import type { Driver } from '../services/driverService';
import Pagination from '../components/Pagination';
import { errorMessage } from '../utils/operation';
import { SourceState } from '../components/Operations';

const Drivers: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', licenseNumber: '', phoneNumber: '', email: '', isActive: true
  });

  const fetchDrivers = async () => {
    setLoadError('');
    try {
      const data = await getAllDrivers();
      setDrivers(data);
    } catch (error) { setLoadError(errorMessage(error)); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDrivers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) await updateDriver(editingId, formData);
      else await createDriver(formData);
      setIsModalOpen(false);
      fetchDrivers();
    } catch (error) { alert(errorMessage(error)); }
  };

  const filteredDrivers = drivers.filter(d => 
    `${d.firstName} ${d.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDrivers = filteredDrivers.slice(indexOfFirstItem, indexOfLastItem);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Loader2 className="animate-spin" size={48} color="#2563eb" /></div>;

  return (
    <div className="main-content">
      <SourceState error={loadError} retry={() => void fetchDrivers()} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="header-title" style={{ margin: 0 }}>Gestión de Conductores</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', width: '300px', outline: 'none' }} />
          </div>
          <button onClick={() => { setEditingId(null); setFormData({ firstName: '', lastName: '', licenseNumber: '', phoneNumber: '', email: '', isActive: true }); setIsModalOpen(true); }} style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={18} /> Nuevo Conductor
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Nombre</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Licencia</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Contacto</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Estado</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentDrivers.map((driver) => (
              <tr key={driver.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 1.5rem' }}><div style={{ fontWeight: 600 }}>{driver.firstName} {driver.lastName}</div></td>
                <td style={{ padding: '1rem 1.5rem' }}>{driver.licenseNumber}</td>
                <td style={{ padding: '1rem 1.5rem' }}><div>{driver.phoneNumber}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{driver.email}</div></td>
                <td style={{ padding: '1rem 1.5rem' }}>{driver.isActive ? <span style={{ color: '#22c55e', fontWeight: 600 }}>ACTIVO</span> : <span style={{ color: '#ef4444', fontWeight: 600 }}>INACTIVO</span>}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <button aria-label={`Editar conductor ${driver.firstName} ${driver.lastName}`} onClick={() => { setEditingId(driver.id); setFormData({ ...driver, phoneNumber: driver.phoneNumber || '', email: driver.email || '' }); setIsModalOpen(true); }} style={{ color: '#2563eb', background: 'none', marginRight: '0.5rem' }}><Edit2 size={18} /></button>
                  <button aria-label={`Eliminar conductor ${driver.firstName} ${driver.lastName}`} onClick={async () => { if(window.confirm('¿Eliminar?')) { try { await deleteDriver(driver.id); await fetchDrivers(); } catch (error) { setLoadError(errorMessage(error)); } } }} style={{ color: '#ef4444', background: 'none' }}><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalItems={filteredDrivers.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Editar Conductor' : 'Nuevo Conductor'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="Nombre" required />
              <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Apellido" required />
              <input style={{ gridColumn: 'span 2', width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value.toUpperCase()})} placeholder="Licencia (Ej: Q12345678)" required />
              <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="Teléfono" required />
              <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email" />
              <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Activo</label>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: '#f1f5f9' }}>Cancelar</button><button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: '#2563eb', color: '#fff' }}>Guardar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
