import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentStaff, role, updateProfileAndName, updateUserPassword } = useAuth();

  const [displayName, setDisplayName] = useState(currentStaff?.display_name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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

    // If changing password, oldPassword is required
    if (newPassword || oldPassword || confirmPassword) {
      if (!oldPassword) {
        setErrorMessage('Current password is required to change password.');
        return;
      }
      if (!newPassword) {
        setErrorMessage('Please enter your new password.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New password and confirm password do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update Display Name if changed
      if (displayName.trim() !== currentStaff.display_name) {
        await updateProfileAndName(displayName.trim(), currentStaff.staff_id);
      }

      // 2. Update Password with old password verification
      if (newPassword && oldPassword) {
        await updateUserPassword(oldPassword, newPassword);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      setSuccessMessage('Profile and credentials updated successfully!');
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
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Staff Profile Settings</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} style={{ padding: '2px 8px', fontSize: '11px' }}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {successMessage && (
              <div className="alert-banner alert-banner-info" style={{ marginBottom: '14px' }}>
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="alert-banner alert-banner-danger" style={{ marginBottom: '14px' }}>
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
            <div style={{ marginBottom: '16px' }}>
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

            {/* Secure Password Change Section with Old Password Requirement */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Change Password</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                To update your password, enter your current password first for verification.
              </p>

              {/* Old Password Field */}
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="profile-old-pass">Current Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="profile-old-pass"
                    type={showOldPassword ? 'text' : 'password'}
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      background: 'none',
                      border: 'none',
                      padding: '4px 6px',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {showOldPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="profile-new-pass">New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="profile-new-pass"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      background: 'none',
                      border: 'none',
                      padding: '4px 6px',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="profile-confirm-pass">Confirm New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="profile-confirm-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      background: 'none',
                      border: 'none',
                      padding: '4px 6px',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Verifying & Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
