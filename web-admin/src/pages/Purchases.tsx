import React, { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Search, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import { getAllPurchases, createPurchase, updatePurchase, deletePurchase } from '../services/purchaseService';
import type { Purchase } from '../services/purchaseService';
import Pagination from '../components/Pagination';
import { errorMessage } from '../utils/operation';
import { SourceState } from '../components/Operations';

const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    supplier: '',
    amount: '',
    status: 'PENDING',
    category: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoadError('');
    try {
      const data = await getAllPurchases();
      setPurchases(data);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setFormData({ description: '', supplier: '', amount: '', status: 'PENDING', category: '', notes: '' });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPurchase({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setIsCreateModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(errorMessage(error));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;
    try {
      await updatePurchase(selectedPurchase.id, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setIsEditModalOpen(false);
      setSelectedPurchase(null);
      resetForm();
      fetchData();
    } catch (error) {
      alert(errorMessage(error));
    }
  };

  const handleOpenEdit = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setFormData({
      description: purchase.description || '',
      supplier: purchase.supplier || '',
      amount: purchase.amount?.toString() || '',
      status: purchase.status || 'PENDING',
      category: purchase.category || '',
      notes: purchase.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar esta compra?')) {
      try {
        await deletePurchase(id);
        fetchData();
      } catch (error) {
        alert(errorMessage(error));
      }
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const term = searchTerm.toLowerCase();
    return (p.description || '').toLowerCase().includes(term) ||
           (p.supplier || '').toLowerCase().includes(term);
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPurchases = filteredPurchases.slice(indexOfFirstItem, indexOfLastItem);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return { bg: '#fef3c7', text: '#92400e', color: '#f59e0b' };
      case 'APPROVED': return { bg: '#dcfce7', text: '#166534', color: '#22c55e' };
      case 'REJECTED': return { bg: '#fee2e2', text: '#991b1b', color: '#ef4444' };
      case 'COMPLETED': return { bg: '#dbeafe', text: '#1e40af', color: '#3b82f6' };
      default: return { bg: '#f1f5f9', text: '#475569', color: '#64748b' };
    }
  };

  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toFixed(2)}`;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Loader2 className="animate-spin" size={48} color="#2563eb" /></div>;
  }

  const renderForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Descripci&oacute;n</label>
        <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Descripci&oacute;n de la compra" required />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Proveedor</label>
        <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} placeholder="Nombre del proveedor" required />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Monto (S/)</label>
        <input type="number" step="0.01" min="0.01" style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" required />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Estado</label>
        <select style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Categor&iacute;a</label>
        <input style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Ej: Combustible, Repuestos" />
      </div>
      <div style={{ gridColumn: 'span 2' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Notas</label>
        <textarea style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', minHeight: '60px' }} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Notas adicionales..." />
      </div>
      <div style={{ gridColumn: 'span 2', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button type="button" onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); resetForm(); }} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9' }}>Cancelar</button>
        <button type="submit" style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', backgroundColor: '#2563eb', color: '#fff', fontWeight: 600 }}>{submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div className="main-content">
      <SourceState error={loadError} retry={() => void fetchData()} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShoppingCart size={28} color="#2563eb" />
          <h2 className="header-title" style={{ margin: 0 }}>Gesti&oacute;n de Compras</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
            <input type="text" placeholder="Buscar compra..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', width: '250px', outline: 'none' }} />
          </div>
          <button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nueva Compra
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>DESCRIPCI&Oacute;N</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PROVEEDOR</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>MONTO</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ESTADO</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CATEGOR&Iacute;A</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {currentPurchases.map((purchase) => (
              <tr key={purchase.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{purchase.description}</td>
                <td style={{ padding: '1rem 1.5rem' }}>{purchase.supplier}</td>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{formatCurrency(purchase.amount)}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: getStatusStyle(purchase.status).bg, color: getStatusStyle(purchase.status).text }}>
                    {purchase.status}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>{purchase.category || '-'}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => handleOpenEdit(purchase)} style={{ color: '#f59e0b', background: 'none' }} title="Editar"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(purchase.id)} style={{ color: '#ef4444', background: 'none' }} title="Eliminar"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredPurchases.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
        />

        {filteredPurchases.length === 0 && (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
            <ShoppingCart size={48} style={{ opacity: 0.2, marginBottom: '1rem', marginLeft: 'auto', marginRight: 'auto' }} />
            <p>No se encontraron compras registradas.</p>
          </div>
        )}
      </div>

      {/* Modal: Nueva Compra */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
            <button onClick={() => { setIsCreateModalOpen(false); resetForm(); }} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Registrar Nueva Compra</h3>
            {renderForm(handleCreateSubmit, 'Registrar')}
          </div>
        </div>
      )}

      {/* Modal: Editar Compra */}
      {isEditModalOpen && selectedPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
            <button onClick={() => { setIsEditModalOpen(false); setSelectedPurchase(null); resetForm(); }} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Editar Compra</h3>
            {renderForm(handleEditSubmit, 'Guardar Cambios')}
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
