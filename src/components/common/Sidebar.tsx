import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
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
  counterTab: 'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff';
  setCounterTab: (tab: 'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff') => void;
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  counterTab,
  setCounterTab,
  onOpenProfile,
}) => {
  const { currentStaff, role, logout } = useAuth();

  return (
    <aside
      style={{
        width: isOpen ? '240px' : '0px',
        minWidth: isOpen ? '240px' : '0px',
        maxWidth: isOpen ? '240px' : '0px',
        height: '100vh',
        backgroundColor: 'var(--bg-surface)',
        borderRight: isOpen ? '1px solid var(--border-subtle)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.15s ease, min-width 0.15s ease, max-width 0.15s ease',
        overflow: 'hidden',
        zIndex: 998,
        position: 'sticky',
        top: 0,
        flexShrink: 0,
      }}
    >
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '240px' }}>
          {/* Sidebar Header */}
          <div
            style={{
              height: '52px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-action)' }} />
              <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                HOTEL ERP
              </span>
            </div>
          </div>

          {/* Navigation Items based on Logged-in Role */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
            {role === 'admin' && (
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '8px',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Administration
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                    onClick={() => setCounterTab('sessions')}
                  >
                    <LayoutDashboard size={15} />
                    <span>Active Sessions & Parcels</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                    onClick={() => setCounterTab('history')}
                  >
                    <Receipt size={15} />
                    <span>Bill History</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                    onClick={() => setCounterTab('analytics')}
                  >
                    <BarChart3 size={15} />
                    <span>Analytics & Sales</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                    onClick={() => setCounterTab('menu')}
                  >
                    <UtensilsCrossed size={15} />
                    <span>Menu & Pricing</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'tables' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                    onClick={() => setCounterTab('tables')}
                  >
                    <Grid size={15} />
                    <span>Floor Tables</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                    onClick={() => setCounterTab('staff')}
                  >
                    <Users size={15} />
                    <span>Staff & Roles</span>
                  </button>
                </div>
              </div>
            )}

            {role === 'waiter' && (
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '8px',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Waiter Terminal
                </span>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                >
                  <Smartphone size={15} />
                  <span>Floor Tables & Ordering</span>
                </button>
              </div>
            )}

            {role === 'chef' && (
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '8px',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Kitchen Terminal
                </span>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '36px', padding: '0 12px' }}
                >
                  <ChefHat size={15} />
                  <span>Preparation Queue</span>
                </button>
              </div>
            )}
          </div>

          {/* Profile & Session Footer */}
          {currentStaff && (
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                }}
                onClick={onOpenProfile}
                title="Click to view profile or change password"
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                  }}
                >
                  {role === 'admin' ? <Shield size={16} color="var(--primary-action)" /> : <User size={16} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                    {currentStaff.display_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    Staff ID: {currentStaff.staff_id}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={logout}
              >
                <LogOut size={13} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
