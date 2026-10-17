import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, User, LogOut, PanelLeft, PanelLeftClose } from 'lucide-react';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Single Sidebar Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Collapse Navigation Sidebar' : 'Expand Navigation Sidebar'}
          className="btn-secondary btn-sm"
          style={{ padding: '6px', minHeight: '34px', width: '34px' }}
        >
          {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: 'var(--primary-action)' }} />
          <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            HOTEL ERP
          </span>
        </div>
      </div>

      {/* Current Staff Badge & Logout */}
      {currentStaff && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onOpenProfile}
            title="Click to view profile or change password"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              minHeight: '34px',
            }}
          >
            {role === 'admin' ? (
              <Shield size={14} color="var(--primary-action)" />
            ) : (
              <User size={14} color="var(--text-secondary)" />
            )}
            <span style={{ fontWeight: 600 }}>{currentStaff.display_name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({currentStaff.staff_id})</span>
          </button>

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={logout}
            title="Log out"
            style={{ minHeight: '34px', padding: '5px 12px' }}
          >
            <LogOut size={14} />
            <span>Exit</span>
          </button>
        </div>
      )}
    </header>
  );
};
