import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, User, KeyRound, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentStaff, role, updateProfileAndName, updateUserPassword } = useAuth();

  const [displayName, setDisplayName] = useState(currentStaff?.display_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen || !currentStaff) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!displayName.trim()) {
      setErrorMessage('Display name cannot be empty');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update Display Name
      if (displayName.trim() !== currentStaff.display_name) {
        await updateProfileAndName(displayName.trim(), currentStaff.staff_id);
      }

      // 2. Update Password if provided
      if (newPassword) {
        await updateUserPassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
      }

      setSuccessMessage('Profile information updated successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="var(--primary-action)" />
            <h3 style={{ color: 'var(--text-primary)' }}>Staff Profile Settings</h3>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ border: 'none', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {successMessage && (
              <div className="alert-banner alert-banner-info" style={{ marginBottom: '14px' }}>
                <CheckCircle size={15} color="var(--success)" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="alert-banner alert-banner-danger" style={{ marginBottom: '14px' }}>
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Read-only System-Generated Staff ID & Assigned Role */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '16px',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Staff ID
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {currentStaff.staff_id}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Assigned Role
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'capitalize', color: role === 'admin' ? 'var(--primary-action)' : 'var(--text-primary)', marginTop: '3px' }}>
                  {role === 'admin' ? 'Administrator' : role === 'chef' ? 'Chef / Kitchen' : 'Waiter'}
                </div>
              </div>
            </div>

            {/* Editable Display Name */}
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="profile-display-name">Display Name (Your Name)</label>
              <input
                id="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Your public name displayed on orders, kitchen tickets, and settled bills.
              </span>
            </div>

            {/* Password Reset Section */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <KeyRound size={15} color="var(--text-secondary)" />
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Change Password (Optional)</span>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="profile-new-pass">New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="profile-new-pass"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '38px' }}
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
                      padding: '6px',
                      color: 'var(--text-muted)',
                      minHeight: 'auto',
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="profile-confirm-pass">Confirm New Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="profile-confirm-pass"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ width: '100%', paddingRight: '38px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        color: 'var(--text-muted)',
                        minHeight: 'auto',
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Updating...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
