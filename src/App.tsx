import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SoundProvider } from './context/SoundContext';
import { Navbar } from './components/common/Navbar';
import { LoginForm } from './components/auth/LoginForm';
import { WaiterView } from './components/waiter/WaiterView';
import { KitchenView } from './components/kitchen/KitchenView';
import { CounterView } from './components/counter/CounterView';

const MainApp: React.FC = () => {
  const { currentStaff, role, isAuthenticated } = useAuth();
  const [activeView, setActiveView] = useState<'counter' | 'waiter' | 'kitchen'>('counter');

  // Sync active view based on authenticated role
  useEffect(() => {
    if (role === 'waiter') {
      setActiveView('waiter');
    } else if (role === 'chef') {
      setActiveView('kitchen');
    } else if (role === 'admin') {
      // Default admin to counter unless previously selected
      setActiveView((prev) => prev || 'counter');
    }
  }, [role]);

  if (!isAuthenticated || !currentStaff) {
    return <LoginForm />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar activeView={activeView} setActiveView={(v) => setActiveView(v as 'counter' | 'waiter' | 'kitchen')} />
      
      <main className="layout-main" style={{ flex: 1 }}>
        {/* Role Access Security Guard */}
        {role === 'waiter' && <WaiterView />}
        
        {role === 'chef' && <KitchenView />}
        
        {role === 'admin' && (
          <>
            {activeView === 'counter' && <CounterView />}
            {activeView === 'waiter' && <WaiterView />}
            {activeView === 'kitchen' && <KitchenView />}
          </>
        )}
      </main>
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
