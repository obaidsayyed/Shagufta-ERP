import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await login(identifier, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Authentication failed');
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
          padding: '32px 28px',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--primary-action)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Shield size={26} color="var(--primary-action)" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Hotel Operations Terminal
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Authorized Counter, Waiter & Kitchen Staff Login
          </p>
        </div>

        {errorMsg && (
          <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="login-identifier">Staff ID or Email</label>
            <input
              id="login-identifier"
              type="text"
              placeholder="e.g. Admin123 or staff@hotel.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', minHeight: '42px' }}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label htmlFor="login-password">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', minHeight: '42px', paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  minHeight: 'auto',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', minHeight: '44px', fontSize: '14px', fontWeight: 700 }}
            disabled={loading}
          >
            <KeyRound size={16} />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Accounts are provisioned by the Administrator. Only authorized active staff can sign in.
          </p>
        </div>
      </div>
    </div>
  );
};
