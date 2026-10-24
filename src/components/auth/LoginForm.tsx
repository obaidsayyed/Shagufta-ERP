import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    const emailToReset = resetEmail.trim();
    if (!emailToReset) return;

    setResetLoading(true);
    try {
      if (api.isLiveSupabase() && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
          redirectTo: `${window.location.origin}/#reset-password`,
        });
        if (error) {
          throw new Error(error.message);
        }
      }
      setResetSuccess(`Password reset link has been dispatched to ${emailToReset} by Supabase Auth.`);
      setResetEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResetError(msg);
    } finally {
      setResetLoading(false);
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
          maxWidth: '380px',
          width: '100%',
          padding: '24px 22px',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
        }}
      >
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <img
            src="/hotel%20logo.png"
            alt="Hotel Shagufta Logo"
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 12px auto',
              display: 'block',
              border: '2px solid rgba(234, 179, 8, 0.55)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
            }}
          />
          <h1 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Hotel Shagufta POS 
          </h1>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Authorized Counter, Waiter & Kitchen Staff Login
          </p>
        </div>

        {errorMsg && (
          <div className="alert-banner alert-banner-danger" style={{ marginBottom: '14px' }}>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="login-identifier">Email</label>
            <input
              id="login-identifier"
              type="text"
              placeholder="e.g. staff@hotel.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', minHeight: '38px' }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setResetError('');
                  setResetSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  minHeight: 'auto',
                  fontSize: '11px',
                  color: 'var(--secondary-accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                Forgot Password?
              </button>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', minHeight: '38px', paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  minHeight: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', minHeight: '40px', fontSize: '13.5px', fontWeight: 700, marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Accounts are provisioned by Administrator. Only authorized staff can sign in.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Reset Password</h3>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowForgotModal(false)}
                style={{ padding: '2px 8px', fontSize: '11px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleForgotPassword}>
              <div className="modal-body">
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '12px' }}>
                  Enter your registered staff email address to receive a password reset link.
                </p>

                {resetSuccess && (
                  <div className="alert-banner alert-banner-info" style={{ marginBottom: '12px' }}>
                    <span>{resetSuccess}</span>
                  </div>
                )}

                {resetError && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '12px' }}>
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="reset-email-input">Registered Staff Email</label>
                  <input
                    id="reset-email-input"
                    type="email"
                    placeholder="e.g. staff@hotel.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    style={{ width: '100%', minHeight: '36px' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForgotModal(false)}
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
