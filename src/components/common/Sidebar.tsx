import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  PanelLeftClose, 
  PanelLeft, 
  LayoutDashboard, 
  Receipt, 
  BarChart3, 
  UtensilsCrossed, 
  Grid, 
  Users, 
  User, 
  LogOut, 
  ChefHat, 
  Smartphone,
  Shield
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeView: 'counter' | 'waiter' | 'kitchen';
  setActiveView: (view: 'counter' | 'waiter' | 'kitchen') => void;
  counterTab: 'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff';
  setCounterTab: (tab: 'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff') => void;
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  activeView,
  setActiveView,
  counterTab,
  setCounterTab,
  onOpenProfile,
}) => {
  const { currentStaff, role, logout } = useAuth();

  return (
    <>
      {/* Floating Toggle Button when Collapsed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Expand Navigation Sidebar"
          style={{
            position: 'fixed',
            left: '12px',
            top: '12px',
            zIndex: 999,
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <PanelLeft size={18} />
        </button>
      )}

      {/* Main Sidebar Container */}
      <aside
        style={{
          width: isOpen ? '250px' : '0px',
          minWidth: isOpen ? '250px' : '0px',
          maxWidth: isOpen ? '250px' : '0px',
          height: '100vh',
          backgroundColor: 'var(--bg-surface)',
          borderRight: isOpen ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s, max-width 0.2s',
          overflow: 'hidden',
          zIndex: 998,
          position: 'sticky',
          top: 0,
          flexShrink: 0,
        }}
      >
        {isOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '250px' }}>
            {/* Sidebar Header */}
            <div
              style={{
                height: '52px',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.01em' }}>
                  HOTEL ERP
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Collapse Sidebar"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  minHeight: 'auto',
                }}
              >
                <PanelLeftClose size={17} />
              </button>
            </div>

            {/* Navigation Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
              {/* Role Switcher for Admin */}
              {role === 'admin' && (
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '8px' }}>
                    OPERATIONAL TERMINALS
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className={`btn-sm ${activeView === 'counter' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '34px' }}
                      onClick={() => setActiveView('counter')}
                    >
                      <LayoutDashboard size={14} />
                      Counter Admin Cockpit
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${activeView === 'waiter' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '34px' }}
                      onClick={() => setActiveView('waiter')}
                    >
                      <Smartphone size={14} />
                      Waiter Terminal
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${activeView === 'kitchen' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '34px' }}
                      onClick={() => setActiveView('kitchen')}
                    >
                      <ChefHat size={14} />
                      Kitchen Display
                    </button>
                  </div>
                </div>
              )}

              {/* Counter Admin Sub-modules Navigation (When Counter view active) */}
              {role === 'admin' && activeView === 'counter' && (
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '8px' }}>
                    ADMIN MODULES
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                    <button
                      type="button"
                      style={{
                        justifyContent: 'flex-start',
                        border: 'none',
                        width: '100%',
                        minHeight: '32px',
                        backgroundColor: counterTab === 'sessions' ? 'var(--bg-surface-subtle)' : 'transparent',
                        fontWeight: counterTab === 'sessions' ? 700 : 500,
                        color: counterTab === 'sessions' ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                      onClick={() => setCounterTab('sessions')}
                    >
                      <LayoutDashboard size={14} />
                      Active Sessions & Parcels
                    </button>

                    <button
                      type="button"
                      style={{
                        justifyContent: 'flex-start',
                        border: 'none',
                        width: '100%',
                        minHeight: '32px',
                        backgroundColor: counterTab === 'history' ? 'var(--bg-surface-subtle)' : 'transparent',
                        fontWeight: counterTab === 'history' ? 700 : 500,
                        color: counterTab === 'history' ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                      onClick={() => setCounterTab('history')}
                    >
                      <Receipt size={14} />
                      Bill History
                    </button>

                    <button
                      type="button"
                      style={{
                        justifyContent: 'flex-start',
                        border: 'none',
                        width: '100%',
                        minHeight: '32px',
                        backgroundColor: counterTab === 'analytics' ? 'var(--bg-surface-subtle)' : 'transparent',
                        fontWeight: counterTab === 'analytics' ? 700 : 500,
                        color: counterTab === 'analytics' ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                      onClick={() => setCounterTab('analytics')}
                    >
                      <BarChart3 size={14} />
                      Analytics & Sales
                    </button>

                    <button
                      type="button"
                      style={{
                        justifyContent: 'flex-start',
                        border: 'none',
                        width: '100%',
                        minHeight: '32px',
                        backgroundColor: counterTab === 'menu' ? 'var(--bg-surface-subtle)' : 'transparent',
                        fontWeight: counterTab === 'menu' ? 700 : 500,
                        color: counterTab === 'menu' ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                      onClick={() => setCounterTab('menu')}
                    >
                      <UtensilsCrossed size={14} />
                      Menu & Pricing
                    </button>

                    <button
                      type="button"
                      style={{
                        justifyContent: 'flex-start',
                        border: 'none',
                        width: '100%',
                        minHeight: '32px',
                        backgroundColor: counterTab === 'tables' ? 'var(--bg-surface-subtle)' : 'transparent',
                        fontWeight: counterTab === 'tables' ? 700 : 500,
                        color: counterTab === 'tables' ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                      onClick={() => setCounterTab('tables')}
                    >
                      <Grid size={14} />
                      Floor Tables
                    </button>

                    <button
                      type="button"
                      style={{
                        justifyContent: 'flex-start',
                        border: 'none',
                        width: '100%',
                        minHeight: '32px',
                        backgroundColor: counterTab === 'staff' ? 'var(--bg-surface-subtle)' : 'transparent',
                        fontWeight: counterTab === 'staff' ? 700 : 500,
                        color: counterTab === 'staff' ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                      onClick={() => setCounterTab('staff')}
                    >
                      <Users size={14} />
                      Staff & Roles
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Footer with Profile & Logout */}
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {currentStaff?.display_name || 'Staff User'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    @{currentStaff?.staff_id}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                  }}
                >
                  {role}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ flex: 1, fontSize: '11px' }}
                  onClick={onOpenProfile}
                  title="Rename profile or change password"
                >
                  <User size={13} />
                  My Profile
                </button>

                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ padding: '6px', color: 'var(--danger)' }}
                  onClick={logout}
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
