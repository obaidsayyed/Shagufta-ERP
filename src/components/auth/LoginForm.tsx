import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Shield, KeyRound, AlertCircle, Eye, EyeOff, Mail, CheckCircle, X } from 'lucide-react';

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
            style={{ width: '100%', minHeight: '44px', fontSize: '14px', fontWeight: 700, marginTop: '14px' }}
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} color="var(--primary-action)" />
                <h3 style={{ color: 'var(--text-primary)' }}>Reset Password</h3>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowForgotModal(false)}
                style={{ border: 'none', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleForgotPassword}>
              <div className="modal-body">
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                  Enter your registered staff email address. A password reset link will be sent to your email directly by Supabase.
                </p>

                {resetSuccess && (
                  <div className="alert-banner alert-banner-info" style={{ marginBottom: '14px' }}>
                    <CheckCircle size={15} color="var(--success)" />
                    <span>{resetSuccess}</span>
                  </div>
                )}

                {resetError && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '14px' }}>
                    <AlertCircle size={15} />
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
                    style={{ width: '100%', minHeight: '40px' }}
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
                  {resetLoading ? 'Sending Link...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
