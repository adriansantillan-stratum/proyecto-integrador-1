import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Map, 
  Users, 
  Truck, 
  ShoppingBag, 
  ChevronRight 
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const hasRole = (roles: string[]) => {
    return user?.roles.some(role => roles.includes(role));
  };

  const modules = [
    { title: 'Incidencias', description: 'Motivos, reintentos y decisiones de replanificación P04.', icon: <Map size={32} />, path: '/incidents', color: '#dc2626', visible: hasRole(['ADMIN', 'DISPATCHER']) },
    { title: 'BI y mejora continua', description: 'Cinco vistas analíticas, metas y acciones de mejora P05.', icon: <LayoutDashboard size={32} />, path: '/bi', color: '#0f766e', visible: hasRole(['ADMIN']) },
    {
      title: 'Dashboard',
      description: 'Indicadores clave y métricas de rendimiento en tiempo real.',
      icon: <LayoutDashboard size={32} />,
      path: '/dashboard',
      color: '#3b82f6',
      visible: hasRole(['ADMIN'])
    },
    {
      title: 'Pedidos',
      description: 'Gestión integral de órdenes, estados y clientes.',
      icon: <ShoppingCart size={32} />,
      path: '/orders',
      color: '#10b981',
      visible: hasRole(['ADMIN', 'DISPATCHER'])
    },
    {
      title: 'Rutas',
      description: 'Planificación de despacho y seguimiento GPS.',
      icon: <Map size={32} />,
      path: '/routes',
      color: '#f59e0b',
      visible: hasRole(['ADMIN', 'DISPATCHER'])
    },
    {
      title: 'Conductores',
      description: 'Administración de personal operativo y licencias.',
      icon: <Users size={32} />,
      path: '/drivers',
      color: '#8b5cf6',
      visible: hasRole(['ADMIN'])
    },
    {
      title: 'Vehículos',
      description: 'Control de flota, mantenimiento y capacidades.',
      icon: <Truck size={32} />,
      path: '/vehicles',
      color: '#ec4899',
      visible: hasRole(['ADMIN'])
    },
    {
      title: 'Compras',
      description: 'Gestión de insumos, combustible y repuestos.',
      icon: <ShoppingBag size={32} />,
      path: '/purchases',
      color: '#64748b',
      visible: hasRole(['ADMIN'])
    }
  ];

  return (
    <div style={{ 
      minHeight: 0,
      flex: 1,
      padding: '4rem 3rem',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      width: '100%'
    }}>
      {/* Background Logo Decoration */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.03,
        zIndex: 0,
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}>
        <h1 style={{ fontSize: '20vw', fontWeight: 900, margin: 0 }}>EcoRoute</h1>
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', margin: '0' }}>
        <header style={{ marginBottom: '4rem', textAlign: 'left' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
            Bienvenido a <span style={{ color: '#3b82f6' }}>EcoRoute</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#64748b', maxWidth: '800px' }}>
            Sistema de Gestión Logística Inteligente para el control total de su operación de última milla.
          </p>
        </header>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
          gap: '2.5rem',
          width: '100%'
        }}>
          {modules.filter(m => m.visible).map((module, index) => (
            <div 
              key={index}
              onClick={() => navigate(module.path)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '1.5rem',
                padding: '2.5rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                border: '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)';
                e.currentTarget.style.borderColor = module.color;
                e.currentTarget.style.boxShadow = `0 20px 25px -5px ${module.color}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
              }}
            >
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '1rem', 
                backgroundColor: `${module.color}15`, 
                color: module.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {module.icon}
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>{module.title}</h3>
                <p style={{ color: '#64748b', lineHeight: 1.6 }}>{module.description}</p>
              </div>

              <div style={{ 
                marginTop: 'auto', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                color: module.color, 
                fontWeight: 700,
                fontSize: '0.875rem'
              }}>
                Acceder al módulo <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
