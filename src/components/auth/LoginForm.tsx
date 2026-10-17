import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await login(username, password);
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
          maxWidth: '400px',
          width: '100%',
          padding: '28px 24px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
          borderRadius: '8px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <Shield size={24} />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
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
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="login-username">Staff Username / ID</label>
            <input
              id="login-username"
              type="text"
              placeholder="e.g. Admin123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', minHeight: '40px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="login-password">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', minHeight: '40px', paddingRight: '40px' }}
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
            style={{ width: '100%', minHeight: '42px', fontSize: '14px', fontWeight: 600 }}
            disabled={loading}
          >
            <KeyRound size={15} />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Accounts are provisioned by the Counter Administrator. Only active authorized staff can sign in.
          </p>
        </div>
      </div>
    </div>
  );
};
