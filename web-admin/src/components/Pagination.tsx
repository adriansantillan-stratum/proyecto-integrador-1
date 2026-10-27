import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', backgroundColor: '#fff' }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
        Mostrando <span style={{ fontWeight: 600 }}>{(currentPage - 1) * itemsPerPage + 1}</span> a <span style={{ fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span style={{ fontWeight: 600 }}>{totalItems}</span> registros
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          style={{ padding: '0.4rem', borderRadius: '0.375rem', backgroundColor: currentPage === 1 ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : '#64748b' }}
        >
          <ChevronLeft size={18} />
        </button>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i + 1}
            onClick={() => onPageChange(i + 1)}
            style={{ 
              width: '32px', height: '32px', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600,
              backgroundColor: currentPage === i + 1 ? '#2563eb' : '#fff',
              color: currentPage === i + 1 ? '#fff' : '#64748b',
              border: '1px solid',
              borderColor: currentPage === i + 1 ? '#2563eb' : '#e2e8f0'
            }}
          >
            {i + 1}
          </button>
        ))}
        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages}
          style={{ padding: '0.4rem', borderRadius: '0.375rem', backgroundColor: currentPage === totalPages ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#cbd5e1' : '#64748b' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
