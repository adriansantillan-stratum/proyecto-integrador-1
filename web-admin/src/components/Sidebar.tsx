import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Map,
  Users,
  Truck,
  LogOut,
  User as UserIcon,
  Home,
  ShoppingBag,
  BarChart3,
  Menu,
  X,
  UserCog
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import NotificationPanel from './NotificationPanel';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, isMobile, mobileOpen, onMobileClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const sidebar = document.getElementById('app-sidebar');
    sidebar?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose();
      if (event.key !== 'Tab') return;
      const controls = sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isMobile, mobileOpen, onMobileClose]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasRole = (roles: string[]) => {
    return user?.roles.some(role => roles.includes(role));
  };

  const handleNavClick = () => {
    if (isMobile) onMobileClose();
  };

  const sidebarWidth = collapsed && !isMobile ? '60px' : '260px';
  const showLabels = !collapsed || isMobile;
  const sidebarVisible = isMobile ? mobileOpen : true;

  const linkStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: showLabels ? '0.75rem' : '0',
    padding: collapsed && !isMobile ? '0.75rem 0' : '0.75rem 1.5rem',
    justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
    color: isActive ? '#3b82f6' : '#94a3b8',
    backgroundColor: isActive ? '#1e1b4b' : 'transparent',
    borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent',
    transition: 'all 0.2s',
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isMobile && mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onMobileClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 998,
          }}
        />
      )}

      {/* Sidebar */}
      {sidebarVisible && (
        <aside id="app-sidebar" role={isMobile ? 'dialog' : undefined} aria-modal={isMobile ? true : undefined}
          aria-label="Menú principal" style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 0',
          boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
          height: '100dvh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 999,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: collapsed && !isMobile ? '0 0.5rem 1.5rem' : '0 1.5rem 1.5rem', borderBottom: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {showLabels && (
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6', letterSpacing: '-0.025em' }}>EcoRoute</h1>
              )}
              <button
                onClick={isMobile ? onMobileClose : onToggle}
                aria-label={isMobile ? 'Cerrar navegación' : collapsed ? 'Expandir navegación' : 'Colapsar navegación'}
                style={{
                  background: 'none',
                  color: '#94a3b8',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: collapsed && !isMobile ? '0 auto' : undefined,
                }}
                title={collapsed ? 'Expandir' : 'Colapsar'}
              >
                {isMobile ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            {/* User card + notifications */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '1rem',
              padding: '0.5rem',
              backgroundColor: '#33415540',
              borderRadius: '0.5rem',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
            }}>
              <div style={{ padding: '0.4rem', backgroundColor: '#3b82f6', borderRadius: '50%', color: '#fff', flexShrink: 0 }}>
                <UserIcon size={14} />
              </div>
              {showLabels && (
                <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.username || 'Usuario'}</p>
                  <p style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{user?.roles[0] || 'Sin Rol'}</p>
                </div>
              )}
              {hasRole(['ADMIN', 'DISPATCHER']) && <NotificationPanel collapsed={collapsed && !isMobile} />}
            </div>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '1.5rem 0', overflowY: 'auto' }}>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>
                <NavLink to="/" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                  <Home size={20} />
                  {showLabels && <span>Inicio</span>}
                </NavLink>
              </li>
              {hasRole(['ADMIN']) && <li>
                <NavLink to="/dashboard" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                  <LayoutDashboard size={20} />
                  {showLabels && <span>Dashboard</span>}
                </NavLink>
              </li>}

              {hasRole(['ADMIN', 'DISPATCHER']) && (
                <>
                  <li>
                    <NavLink to="/orders" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <ShoppingCart size={20} />
                      {showLabels && <span>Pedidos</span>}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/routes" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <Map size={20} />
                      {showLabels && <span>Rutas</span>}
                    </NavLink>
                  </li>
                  <li><NavLink to="/incidents" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)} title="Incidencias P04"><Map size={20} />{showLabels && <span>Incidencias</span>}</NavLink></li>
                  <li><NavLink to="/improvement-actions" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)} title="Acciones de mejora P05"><BarChart3 size={20} />{showLabels && <span>Acciones de mejora</span>}</NavLink></li>
                </>
              )}

              {hasRole(['ADMIN']) && (
                <>
                  <li>
                    <NavLink to="/drivers" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <Users size={20} />
                      {showLabels && <span>Conductores</span>}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/vehicles" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <Truck size={20} />
                      {showLabels && <span>Vehiculos</span>}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/users" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <UserCog size={20} />
                      {showLabels && <span>Usuarios</span>}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/purchases" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <ShoppingBag size={20} />
                      {showLabels && <span>Compras</span>}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/reports" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)}>
                      <BarChart3 size={20} />
                      {showLabels && <span>Reportes</span>}
                    </NavLink>
                  </li>
                  <li><NavLink to="/bi" onClick={handleNavClick} style={({ isActive }) => linkStyle(isActive)} title="Inteligencia de negocio"><BarChart3 size={20} />{showLabels && <span>BI y mejora continua</span>}</NavLink></li>
                </>
              )}
            </ul>
          </nav>

          {/* Logout */}
          <div style={{ padding: collapsed && !isMobile ? '1.5rem 0.5rem' : '1.5rem', borderTop: '1px solid #334155' }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: showLabels ? '0.75rem' : '0',
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                color: '#ef4444',
                backgroundColor: 'transparent',
                fontSize: '0.875rem',
                fontWeight: 500,
                width: '100%',
                textAlign: 'left',
              }}
            >
              <LogOut size={20} />
              {showLabels && <span>Cerrar Sesion</span>}
            </button>
          </div>
        </aside>
      )}
    </>
  );
};

export default Sidebar;
