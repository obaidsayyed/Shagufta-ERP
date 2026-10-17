import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, User, KeyRound, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentStaff, updateProfileAndName, updateUserPassword } = useAuth();

  const [displayName, setDisplayName] = useState(currentStaff?.display_name || '');
  const [staffId, setStaffId] = useState(currentStaff?.staff_id || '');
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

    if (!displayName.trim() || !staffId.trim()) {
      setErrorMessage('Display name and username/staff ID cannot be empty');
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
      // 1. Update Display Name and Staff ID / Username
      if (displayName.trim() !== currentStaff.display_name || staffId.trim() !== currentStaff.staff_id) {
        await updateProfileAndName(displayName.trim(), staffId.trim());
      }

      // 2. Update Password if provided
      if (newPassword) {
        await updateUserPassword(newPassword);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="var(--accent)" />
            <h3>My Staff Profile & Password</h3>
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

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="profile-display-name">Display Name</label>
              <input
                id="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="profile-staff-id">Staff Username / ID</label>
              <input
                id="profile-staff-id"
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                required
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                You can use this username to sign in.
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <KeyRound size={15} color="var(--text-secondary)" />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Change Password (Optional)</span>
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

              <div>
                <label htmlFor="profile-confirm-pass">Confirm New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="profile-confirm-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
