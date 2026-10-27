import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import RoutesPage from './pages/Routes';
import Drivers from './pages/Drivers';
import Vehicles from './pages/Vehicles';
import Users from './pages/Users';
import Home from './pages/Home';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Purchases from './pages/Purchases';
import BusinessIntelligence from './pages/BusinessIntelligence';
import Incidents from './pages/Incidents';
import { ImprovementActions } from './components/ImprovementActions';
import './styles/global.css';

const AuthenticatedLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    mobileToggle.current?.focus();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 60 : 260);

  return (
    <div className="dashboard-layout">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobile={isMobile} mobileOpen={mobileOpen} onMobileClose={closeMobileMenu} />
      <div
        className="main-container"
        style={{ marginLeft: `${sidebarWidth}px`, transition: 'margin-left 0.2s ease' }}
      >
        {isMobile && <header className="mobile-navigation-bar" aria-label="Navegación móvil">
          <button ref={mobileToggle} type="button" onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación" aria-controls="app-sidebar" aria-expanded={mobileOpen}>
            <Menu size={22} aria-hidden="true" /><span>Menú</span>
          </button>
          <span className="mobile-navigation-brand">EcoRoute</span>
        </header>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<ProtectedRoute roles={['ADMIN', 'DISPATCHER']} />}>
            <Route path="/orders" element={<Orders />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/improvement-actions" element={<main className="main-content operation-page"><h2 className="header-title">Mejora continua</h2><ImprovementActions /></main>} />
          </Route>

          {/* Admin Only Routes */}
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/users" element={<Users />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/bi" element={<BusinessIntelligence />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AuthenticatedLayout />} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
