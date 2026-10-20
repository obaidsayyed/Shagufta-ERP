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
  Shield,
  X
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
  setIsOpen,
  counterTab,
  setCounterTab,
  onOpenProfile,
}) => {
  const { currentStaff, role, logout } = useAuth();

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768;

  const handleSelectTab = (tab: 'sessions' | 'history' | 'analytics' | 'menu' | 'tables' | 'staff') => {
    setCounterTab(tab);
    if (isMobile()) {
      setIsOpen(false);
    }
  };

  const handleProfileClick = () => {
    onOpenProfile();
    if (isMobile()) {
      setIsOpen(false);
    }
  };

  const handleLogoutClick = () => {
    if (isMobile()) {
      setIsOpen(false);
    }
    logout();
  };

  return (
    <aside className={`app-sidebar ${!isOpen ? 'closed' : ''}`}>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          {/* Sidebar Header */}
          <div
            style={{
              height: '52px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-action)' }} />
              <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                HOTEL ERP
              </span>
            </div>

            {/* Close button visible when sidebar is open in mobile view */}
            <button
              type="button"
              className="btn-secondary btn-sm mobile-sidebar-close-btn"
              onClick={() => setIsOpen(false)}
              title="Close Navigation"
              style={{ padding: '4px 8px' }}
            >
              <X size={16} />
              <span>Close</span>
            </button>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                    onClick={() => handleSelectTab('sessions')}
                  >
                    <LayoutDashboard size={15} />
                    <span>Active Sessions & Parcels</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                    onClick={() => handleSelectTab('history')}
                  >
                    <Receipt size={15} />
                    <span>Bill History</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                    onClick={() => handleSelectTab('analytics')}
                  >
                    <BarChart3 size={15} />
                    <span>Analytics & Sales</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                    onClick={() => handleSelectTab('menu')}
                  >
                    <UtensilsCrossed size={15} />
                    <span>Menu & Pricing</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'tables' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                    onClick={() => handleSelectTab('tables')}
                  >
                    <Grid size={15} />
                    <span>Floor Tables</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                    onClick={() => handleSelectTab('staff')}
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
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                  onClick={() => {
                    if (isMobile()) setIsOpen(false);
                  }}
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
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '38px', padding: '0 12px' }}
                  onClick={() => {
                    if (isMobile()) setIsOpen(false);
                  }}
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
                onClick={handleProfileClick}
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
                onClick={handleLogoutClick}
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
