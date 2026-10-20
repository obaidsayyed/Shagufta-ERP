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
            className="btn-secondary btn-sm"
            style={{ padding: '4px 8px', minHeight: '28px', fontSize: '11px', fontWeight: 600 }}
          >
            {isSidebarOpen ? 'Close Menu' : 'Menu'}
          </button>
        )}

        <span style={{ fontWeight: 800, fontSize: '14.5px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          HOTEL ERP
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
