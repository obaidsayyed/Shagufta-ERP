import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenProfile,
}) => {
  const { currentStaff, role, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-brand-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Sidebar Toggle Button: Visible strictly for Admin */}
        {role === 'admin' && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Collapse Navigation Sidebar' : 'Expand Navigation Sidebar'}
            aria-label={isSidebarOpen ? 'Collapse Navigation Sidebar' : 'Expand Navigation Sidebar'}
            className="btn-secondary btn-sm"
            style={{
              padding: '4px',
              minHeight: '28px',
              minWidth: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSidebarOpen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        )}

        <span style={{ fontWeight: 800, fontSize: '14.5px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          Hotel Shagufta POS
        </span>
      </div>

      {/* Current Staff Badge & Logout */}
      {currentStaff && (
        <div className="header-user-group" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onOpenProfile}
            title="Click to view profile or change password"
            style={{
              padding: '3px 8px',
              minHeight: '28px',
            }}
          >
            <span className="header-staff-name" style={{ fontWeight: 600 }}>{currentStaff.display_name}</span>
            <span className="header-staff-id" style={{ color: 'var(--text-muted)', fontSize: '10.5px', marginLeft: '4px' }}>({currentStaff.staff_id})</span>
          </button>

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={logout}
            title="Log out"
            style={{ minHeight: '28px', padding: '3px 8px', flexShrink: 0, fontWeight: 600 }}
          >
            Exit
          </button>
        </div>
      )}
    </header>
  );
};
