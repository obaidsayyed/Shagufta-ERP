import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SoundProvider } from './context/SoundContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { ProfileModal } from './components/common/ProfileModal';
import { LoginForm } from './components/auth/LoginForm';
import { WaiterView } from './components/waiter/WaiterView';
import { KitchenView } from './components/kitchen/KitchenView';
import { CounterView } from './components/counter/CounterView';

const MainApp: React.FC = () => {
  const { currentStaff, role, isAuthenticated } = useAuth();
  const [counterTab, setCounterTab] = useState<'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff'>('sessions');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return false;
    }
    const saved = localStorage.getItem('hotel_erp_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('hotel_erp_sidebar_open', String(next));
      return next;
    });
  };

  if (!isAuthenticated || !currentStaff) {
    return <LoginForm />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: 'var(--bg-page)' }}>
      {/* Collapsible Sidebar - Rendered strictly for Admin */}
      {role === 'admin' && (
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={(open) => {
            setIsSidebarOpen(open);
            localStorage.setItem('hotel_erp_sidebar_open', String(open));
          }}
          counterTab={counterTab}
          setCounterTab={setCounterTab}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
      )}

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        <main className="layout-main" style={{ flex: 1, width: '100%', padding: '16px' }}>
          {/* User sees strictly their role's terminal */}
          {role === 'waiter' && <WaiterView />}

          {role === 'chef' && <KitchenView />}

          {role === 'admin' && (
            <CounterView activeTab={counterTab} setActiveTab={setCounterTab} />
          )}
        </main>
      </div>

      {/* Profile & Password Change Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SoundProvider>
        <MainApp />
      </SoundProvider>
    </AuthProvider>
  );
}

export default App;
