import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, KeyRound, AlertCircle } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { loginAsStaff, loginWithEmail, availableStaffList } = useAuth();
  const [selectedStaffId, setSelectedStaffId] = useState('ADM-001');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useEmailAuth, setUseEmailAuth] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (useEmailAuth) {
        const res = await loginWithEmail(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Authentication failed');
        }
      } else {
        await loginAsStaff(selectedStaffId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'var(--bg-page)',
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <Shield size={22} />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 700 }}>Hotel Operational ERP</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Authorized Staff Portal — Counter, Waiter & Kitchen
          </p>
        </div>

        {errorMsg && (
          <div className="alert-banner alert-banner-danger" style={{ marginBottom: '14px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleStaffLogin}>
          {!useEmailAuth ? (
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="staff-login-select">Select Staff Account</label>
              <select
                id="staff-login-select"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                style={{ width: '100%' }}
              >
                {availableStaffList.map((s) => (
                  <option key={s.id} value={s.staff_id} disabled={!s.is_active}>
                    {s.staff_id} — {s.display_name} ({s.role.toUpperCase()}) {!s.is_active ? '[DISABLED]' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Only active accounts assigned by Counter Admin can log in.
              </span>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="email-input">Email Address</label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hotel.local"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="password-input">Password</label>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', minHeight: '42px', marginBottom: '14px' }}
            disabled={loading}
          >
            <KeyRound size={16} />
            {loading ? 'Authenticating...' : 'Sign In to Terminal'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', textAlign: 'center' }}>
          <button
            type="button"
            className="btn-secondary btn-sm"
            style={{ border: 'none', color: 'var(--text-muted)' }}
            onClick={() => setUseEmailAuth(!useEmailAuth)}
          >
            {useEmailAuth ? 'Switch to Staff ID Selector' : 'Use Direct Email/Password'}
          </button>
        </div>
      </div>
    </div>
  );
};
