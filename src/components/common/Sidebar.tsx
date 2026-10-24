import React from 'react';
import { useAuth } from '../../context/AuthContext';

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
              height: '48px',
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '13.5px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Hotel Shagufta POS
            </span>

            {/* Close button visible when sidebar is open in mobile view */}
            <button
              type="button"
              className="btn-secondary btn-sm mobile-sidebar-close-btn"
              onClick={() => setIsOpen(false)}
              title="Close Navigation"
              style={{ padding: '3px 8px', fontSize: '11px' }}
            >
              Close
            </button>
          </div>

          {/* Navigation Items based on Logged-in Role */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {role === 'admin' && (
              <div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '6px',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Administration
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => handleSelectTab('sessions')}
                  >
                    Active Sessions & Parcels
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => handleSelectTab('history')}
                  >
                    Bill History
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => handleSelectTab('analytics')}
                  >
                    Analytics & Sales
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => handleSelectTab('menu')}
                  >
                    Menu & Pricing
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'tables' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => handleSelectTab('tables')}
                  >
                    Floor Tables
                  </button>

                  <button
                    type="button"
                    className={`btn-sm ${counterTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => handleSelectTab('staff')}
                  >
                    Staff & Roles
                  </button>
                </div>
              </div>
            )}

            {role === 'waiter' && (
              <div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '6px',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Waiter Terminal
                </span>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => {
                    if (isMobile()) setIsOpen(false);
                  }}
                >
                  Floor Tables & Ordering
                </button>
              </div>
            )}

            {role === 'chef' && (
              <div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingLeft: '6px',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Kitchen Terminal
                </span>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => {
                    if (isMobile()) setIsOpen(false);
                  }}
                >
                  Preparation Queue
                </button>
              </div>
            )}
          </div>

          {/* Profile & Session Footer */}
          {currentStaff && (
            <div
              style={{
                padding: '10px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
            >
              <div
                style={{
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
                onClick={handleProfileClick}
                title="Click to view profile or change password"
              >
                <div style={{ fontWeight: 600, fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                  {currentStaff.display_name}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Staff ID: {currentStaff.staff_id}
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center', minHeight: '28px', fontSize: '11px' }}
                onClick={handleLogoutClick}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
