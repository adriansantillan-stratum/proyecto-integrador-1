import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Loader2, X } from 'lucide-react';
import { getAllVehicles, deleteVehicle, createVehicle, updateVehicle } from '../services/vehicleService';
import type { Vehicle } from '../services/vehicleService';
import Pagination from '../components/Pagination';
import { errorMessage } from '../utils/operation';
import { SourceState } from '../components/Operations';

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    plateNumber: '', model: '', brand: '', capacityKg: 0, capacityM3: 0, isActive: true
  });

  const fetchVehicles = async () => {
    setLoadError('');
    try {
      const data = await getAllVehicles();
      setVehicles(data);
    } catch (error) { setLoadError(errorMessage(error)); } finally { setLoading(false); }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) await updateVehicle(editingId, formData);
      else await createVehicle(formData);
      setIsModalOpen(false);
      fetchVehicles();
    } catch (error) { alert(errorMessage(error)); }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVehicles = filteredVehicles.slice(indexOfFirstItem, indexOfLastItem);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Loader2 className="animate-spin" size={48} color="#2563eb" /></div>;

  return (
    <div className="main-content">
      <SourceState error={loadError} retry={() => void fetchVehicles()} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="header-title" style={{ margin: 0 }}>Gestión de Vehículos</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', width: '300px', outline: 'none' }} />
          </div>
          <button onClick={() => { setEditingId(null); setFormData({ plateNumber: '', model: '', brand: '', capacityKg: 0, capacityM3: 0, isActive: true }); setIsModalOpen(true); }} style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nuevo Vehículo
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Placa</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Marca/Modelo</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Capacidad</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Estado</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentVehicles.map((vehicle) => (
              <tr key={vehicle.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: '#1e40af' }}>{vehicle.plateNumber}</td>
                <td style={{ padding: '1rem 1.5rem' }}><div>{vehicle.brand}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{vehicle.model}</div></td>
                <td style={{ padding: '1rem 1.5rem' }}><div>{vehicle.capacityKg} Kg</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{vehicle.capacityM3} m³</div></td>
                <td style={{ padding: '1rem 1.5rem' }}>{vehicle.isActive ? <span style={{ color: '#22c55e', fontWeight: 600 }}>OPERATIVO</span> : <span style={{ color: '#ef4444', fontWeight: 600 }}>TALLER</span>}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <button aria-label={`Editar vehículo ${vehicle.plateNumber}`} onClick={() => { setEditingId(vehicle.id); setFormData({ ...vehicle, model: vehicle.model || '', brand: vehicle.brand || '' }); setIsModalOpen(true); }} style={{ color: '#2563eb', background: 'none', marginRight: '0.5rem' }}><Edit2 size={18} /></button>
                  <button aria-label={`Eliminar vehículo ${vehicle.plateNumber}`} onClick={async () => { if(window.confirm('¿Eliminar?')) { try { await deleteVehicle(vehicle.id); await fetchVehicles(); } catch (error) { setLoadError(errorMessage(error)); } } }} style={{ color: '#ef4444', background: 'none' }}><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={currentPage} totalItems={filteredVehicles.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input style={{ gridColumn: 'span 2', width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.plateNumber} onChange={e => setFormData({...formData, plateNumber: e.target.value.toUpperCase()})} placeholder="Placa (Ej: ABC-123)" required />
              <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Marca" required />
              <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Modelo" required />
              <input type="number" style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.capacityKg} onChange={e => setFormData({...formData, capacityKg: parseFloat(e.target.value)})} placeholder="Capacidad (Kg)" />
              <input type="number" step="0.1" style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.capacityM3} onChange={e => setFormData({...formData, capacityM3: parseFloat(e.target.value)})} placeholder="Capacidad (m³)" />
              <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Operativo</label>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: '#f1f5f9' }}>Cancelar</button><button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: '#2563eb', color: '#fff' }}>Guardar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
