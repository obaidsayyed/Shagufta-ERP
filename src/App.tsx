import React, { useState, useEffect } from 'react';
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
  const [activeView, setActiveView] = useState<'counter' | 'waiter' | 'kitchen'>('counter');
  const [counterTab, setCounterTab] = useState<'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff'>('sessions');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('hotel_erp_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Sync active view based on authenticated role
  useEffect(() => {
    if (role === 'waiter') {
      setActiveView('waiter');
    } else if (role === 'chef') {
      setActiveView('kitchen');
    } else if (role === 'admin') {
      setActiveView((prev) => prev || 'counter');
    }
  }, [role]);

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
      {/* Collapsible Sidebar - Can collapse totally to give full space to components */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={(open) => {
          setIsSidebarOpen(open);
          localStorage.setItem('hotel_erp_sidebar_open', String(open));
        }}
        activeView={activeView}
        setActiveView={setActiveView}
        counterTab={counterTab}
        setCounterTab={setCounterTab}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        <Navbar
          activeView={activeView}
          setActiveView={setActiveView}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        <main className="layout-main" style={{ flex: 1, width: '100%', padding: '16px' }}>
          {role === 'waiter' && <WaiterView />}

          {role === 'chef' && <KitchenView />}

          {role === 'admin' && (
            <>
              {activeView === 'counter' && (
                <CounterView activeTab={counterTab} setActiveTab={setCounterTab} />
              )}
              {activeView === 'waiter' && <WaiterView />}
              {activeView === 'kitchen' && <KitchenView />}
            </>
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
