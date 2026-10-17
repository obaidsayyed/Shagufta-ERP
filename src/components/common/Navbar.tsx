import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Shield, User, LogOut, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeView, setActiveView }) => {
  const { currentStaff, role, loginAsStaff, logout, availableStaffList } = useAuth();
  const isLive = api.isLiveSupabase();

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
            HOTEL ORDER MANAGEMENT
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
          {isLive ? 'SUPABASE LIVE' : 'TRANSACTIONAL ENGINE'}
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

          {/* Quick Staff Switcher for Operational Convenience */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="staff-quick-select" style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
              Staff:
            </label>
            <select
              id="staff-quick-select"
              value={currentStaff.staff_id}
              onChange={(e) => loginAsStaff(e.target.value)}
              style={{ minHeight: '30px', padding: '2px 8px', fontSize: '12px' }}
            >
              {availableStaffList.map((s) => (
                <option key={s.id} value={s.staff_id} disabled={!s.is_active}>
                  {s.staff_id} — {s.display_name} ({s.role}) {!s.is_active ? '[Disabled]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Current Staff Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            {role === 'admin' ? (
              <Shield size={14} color="var(--accent)" />
            ) : (
              <User size={14} color="var(--text-secondary)" />
            )}
            <span style={{ fontWeight: 600 }}>{currentStaff.staff_id}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
              {currentStaff.role}
            </span>
          </div>

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={logout}
            title="Log out of current staff account"
          >
            <LogOut size={13} />
            Exit
          </button>
        </div>
      )}
    </header>
  );
};
