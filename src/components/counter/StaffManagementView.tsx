import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { StaffProfile, StaffRole } from '../../types/database';
import { UserPlus, Shield, User, AlertCircle, X, Eye, EyeOff } from 'lucide-react';

interface StaffManagementViewProps {
  staffList: StaffProfile[];
  onStaffUpdated: () => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  staffList,
  onStaffUpdated,
}) => {
  const { currentStaff } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !displayName.trim() || !currentStaff) return;
    setErrorMessage('');
    try {
      await api.createStaffUser({
        staff_id: staffId.trim().toUpperCase(),
        display_name: displayName.trim(),
        role,
        email: email.trim() || undefined,
        password: password || undefined,
        caller_admin: currentStaff,
      });

      setShowCreateModal(false);
      setStaffId('');
      setDisplayName('');
      setEmail('');
      setPassword('');
      setNoticeMessage(`Staff account ${displayName} (${staffId}) created successfully.`);
      onStaffUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleStatus = async (staff: StaffProfile) => {
    if (staff.auth_user_id === currentStaff?.auth_user_id) {
      setErrorMessage('You cannot disable your own active administrator account.');
      return;
    }
    setErrorMessage('');
    try {
      await api.toggleStaffStatus(staff.id, !staff.is_active);
      setNoticeMessage(`Staff member ${staff.display_name} is now ${!staff.is_active ? 'active' : 'disabled'}.`);
      onStaffUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Staff & Role Administration</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Provision staff profiles, assign roles (Waiter, Chef, Admin) and control login access
          </span>
        </div>

        <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus size={14} />
          Create Staff Account
        </button>
      </div>

      {noticeMessage && (
        <div className="alert-banner alert-banner-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{noticeMessage}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setNoticeMessage('')} style={{ border: 'none' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="alert-banner alert-banner-danger">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Display Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th style={{ textAlign: 'center' }}>Access Control</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => {
              const isSelf = staff.auth_user_id === currentStaff?.auth_user_id;
              return (
                <tr key={staff.id} style={{ opacity: staff.is_active ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {staff.staff_id}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {staff.display_name} {isSelf && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>(You)</span>}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: staff.role === 'admin' ? 'var(--accent-subtle)' : 'var(--bg-surface-subtle)',
                        color: staff.role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {staff.role}
                    </span>
                  </td>
                  <td>
                    {staff.is_active ? (
                      <span className="badge badge-ready">Active</span>
                    ) : (
                      <span className="badge badge-danger">Disabled</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(staff.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className={`btn-sm ${staff.is_active ? 'btn-danger' : 'btn-success'}`}
                      style={{ minHeight: '26px', fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => handleToggleStatus(staff)}
                      disabled={isSelf}
                      title={isSelf ? 'Cannot disable your own active account' : ''}
                    >
                      {staff.is_active ? 'Disable Account' : 'Enable Account'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Staff Account */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Create Staff Account</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowCreateModal(false)} style={{ border: 'none' }}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="staff-id-input">Unique Staff ID</label>
                  <input
                    id="staff-id-input"
                    type="text"
                    placeholder="e.g. WTR-105 or CHF-203"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Standard convention: ADM-XXX for Admin, WTR-XXX for Waiter, CHF-XXX for Kitchen.
                  </span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="staff-name-input">Full Name / Display Name</label>
                  <input
                    id="staff-name-input"
                    type="text"
                    placeholder="e.g. Prakash Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="staff-role-select">Assigned Operational Role</label>
                  <select
                    id="staff-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffRole)}
                    style={{ width: '100%' }}
                  >
                    <option value="waiter">Waiter (Mobile ordering, table sessions)</option>
                    <option value="chef">Chef / Kitchen (Food prep, readiness action)</option>
                    <option value="admin">Counter Admin (All modules, billing, staff, menu)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="staff-email-input">Email Address (Optional / Supabase Auth)</label>
                  <input
                    id="staff-email-input"
                    type="email"
                    placeholder="prakash@hotel.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="staff-pass-input">Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="staff-pass-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Provision Staff Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
