import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Shield, User, LogOut, PanelLeft, PanelLeftClose } from 'lucide-react';

interface NavbarProps {
  activeView: string;
  setActiveView: (view: 'counter' | 'waiter' | 'kitchen') => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  isSidebarOpen,
  onToggleSidebar,
  onOpenProfile,
}) => {
  const { currentStaff, role, logout } = useAuth();
  const isLive = api.isLiveSupabase();

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Sidebar Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          className="btn-secondary btn-sm"
          style={{ padding: '6px', minHeight: '32px', width: '32px' }}
        >
          {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
          <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.01em' }}>
            HOTEL ERP
          </span>
        </div>

        <span
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: isLive ? 'var(--success-bg)' : 'var(--bg-surface-subtle)',
            color: isLive ? 'var(--success)' : 'var(--text-secondary)',
            border: `1px solid ${isLive ? 'var(--success-border)' : 'var(--border-strong)'}`,
            fontWeight: 600,
          }}
        >
          {isLive ? 'SUPABASE LIVE' : 'LOCAL ENGINE'}
        </span>
      </div>

      {/* Role Navigation */}
      {currentStaff && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {role === 'admin' && (
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-surface-subtle)', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                className={`btn-sm ${activeView === 'counter' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', minHeight: '28px' }}
                onClick={() => setActiveView('counter')}
              >
                Counter Admin
              </button>
              <button
                type="button"
                className={`btn-sm ${activeView === 'waiter' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', minHeight: '28px' }}
                onClick={() => setActiveView('waiter')}
              >
                Waiter View
              </button>
              <button
                type="button"
                className={`btn-sm ${activeView === 'kitchen' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', minHeight: '28px' }}
                onClick={() => setActiveView('kitchen')}
              >
                Kitchen View
              </button>
            </div>
          )}

          {/* Current Staff Badge / Profile Button */}
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onOpenProfile}
            title="Click to edit profile or change password"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              minHeight: '32px',
            }}
          >
            {role === 'admin' ? (
              <Shield size={14} color="var(--accent)" />
            ) : (
              <User size={14} color="var(--text-secondary)" />
            )}
            <span style={{ fontWeight: 600 }}>{currentStaff.display_name}</span>
            <span style={{ color: 'var(--text-muted)' }}>({currentStaff.staff_id})</span>
          </button>

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={logout}
            title="Log out"
            style={{ minHeight: '32px' }}
          >
            <LogOut size={13} />
            Exit
          </button>
        </div>
      )}
    </header>
  );
};
