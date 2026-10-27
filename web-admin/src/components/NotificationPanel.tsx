import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, X } from 'lucide-react';
import { markAsRead } from '../services/notificationService';
import type { Notification } from '../services/notificationService';
import { useQuery } from '../hooks/useQuery';
import { SourceState } from './Operations';
import { errorMessage } from '../utils/operation';
import { notificationPosition } from './notificationPosition';

interface NotificationPanelProps {
  collapsed?: boolean;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ collapsed = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const countQuery = useQuery<{ count: number }>('/notifications/unread/count');
  const listQuery = useQuery<Notification[]>(isOpen ? '/notifications/unread' : null);
  const notifications = listQuery.data ?? [];
  const unreadCount = countQuery.data?.count ?? 0;
  const [message, setMessage] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ReturnType<typeof notificationPosition> | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      const anchor = anchorRef.current;
      if (anchor) setPosition(notificationPosition(anchor.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, collapsed));
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, collapsed]);

  const reloadCount = countQuery.reload;
  useEffect(() => {
    const interval = setInterval(reloadCount, 30000);
    return () => clearInterval(interval);
  }, [reloadCount]);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id);
      listQuery.reload(); countQuery.reload();
    } catch (cause) {
      setMessage(errorMessage(cause));
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Ahora';
      if (diffMin < 60) return `Hace ${diffMin}m`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `Hace ${diffHrs}h`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div ref={anchorRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="notification-panel"
        style={{
          position: 'relative',
          background: 'none',
          color: '#94a3b8',
          padding: '0.4rem',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        title="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#ef4444',
            color: '#fff',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '0.6rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && position && createPortal(
        <div ref={panelRef} id="notification-panel" role="region" aria-label="Notificaciones" style={{
          position: 'fixed',
          ...position,
          overflowY: 'auto',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 2000,
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.875rem' }}>Notificaciones</span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar notificaciones"
              style={{ background: 'none', color: '#94a3b8', padding: '2px' }}
            >
              <X size={16} />
            </button>
          </div>

          <SourceState {...listQuery} retry={listQuery.reload} /><SourceState error={countQuery.error || message} retry={countQuery.reload} />
          {!listQuery.loading && !listQuery.error && notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
              No hay notificaciones pendientes
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {notification.title}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', lineHeight: 1.4, marginBottom: '0.25rem' }}>
                    {notification.message}
                  </p>
                  <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {formatTime(notification.createdAt)}
                  </span>
                </div>
                <button
                  onClick={() => handleMarkAsRead(notification.id)}
                  title="Marcar como leida"
                  style={{
                    background: 'none',
                    color: '#22c55e',
                    padding: '0.25rem',
                    flexShrink: 0,
                  }}
                >
                  <Check size={16} />
                </button>
              </div>
            ))
          )}
        </div>, document.body
      )}
    </div>
  );
};

export default NotificationPanel;
