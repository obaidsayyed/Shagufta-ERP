import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { StaffProfile, StaffRole } from '../../types/database';
import { UserPlus, Shield, User, AlertCircle, X, Eye, EyeOff, CheckCircle } from 'lucide-react';

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
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'waiter' | 'chef'>('waiter');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate Staff ID based on role and existing accounts
  const computeNextStaffId = (targetRole: 'waiter' | 'chef'): string => {
    const prefix = targetRole === 'chef' ? 'CHF' : 'WTR';
    const baseNum = targetRole === 'chef' ? 200 : 100;
    let max = baseNum;
    for (const s of staffList) {
      if (s.staff_id.startsWith(`${prefix}-`)) {
        const val = parseInt(s.staff_id.replace(`${prefix}-`, ''), 10);
        if (!isNaN(val) && val > max) {
          max = val;
        }
      }
    }
    return `${prefix}-${max + 1}`;
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password || !currentStaff) return;
    
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const generatedStaffId = computeNextStaffId(role);

      await api.createStaffUser({
        staff_id: generatedStaffId,
        display_name: displayName.trim(),
        role,
        email: email.trim(),
        password,
        caller_admin: currentStaff,
      });

      setShowCreateModal(false);
      setDisplayName('');
      setEmail('');
      setPassword('');
      setNoticeMessage(`Staff account created: ${displayName.trim()} assigned Staff ID ${generatedStaffId}`);
      onStaffUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
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
      setNoticeMessage(`Staff member ${staff.display_name} (${staff.staff_id}) is now ${!staff.is_active ? 'active' : 'disabled'}.`);
      onStaffUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const nextStaffIdPreview = computeNextStaffId(role);

  return (
    <div>
      <div className="responsive-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Staff & Role Administration</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Provision waiter and kitchen staff accounts with auto-generated staff IDs and cloud auth login
          </span>
        </div>

        <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus size={14} />
          <span>Create Staff Account</span>
        </button>
      </div>

      {noticeMessage && (
        <div className="alert-banner alert-banner-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={15} color="var(--success)" />
            <span>{noticeMessage}</span>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setNoticeMessage('')} style={{ border: 'none', padding: '2px 6px' }}>
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
      <div className="panel table-responsive" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Display Name</th>
              <th>Assigned Role</th>
              <th>Status</th>
              <th>Created At</th>
              <th style={{ textAlign: 'center' }}>Access Control</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => {
              const isSelf = staff.auth_user_id === currentStaff?.auth_user_id;
              return (
                <tr key={staff.id} style={{ opacity: staff.is_active ? 1 : 0.6 }}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {staff.staff_id}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {staff.display_name}
                    {isSelf && (
                      <span className="badge badge-accent" style={{ marginLeft: '8px', fontSize: '10px' }}>
                        You (Admin)
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textTransform: 'capitalize',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: staff.role === 'admin' ? 'var(--primary-action)' : staff.role === 'chef' ? 'var(--secondary-accent)' : 'var(--text-primary)',
                      }}
                    >
                      {staff.role === 'admin' && <Shield size={13} color="var(--primary-action)" />}
                      {staff.role === 'waiter' && <User size={13} />}
                      {staff.role === 'chef' && <User size={13} color="var(--secondary-accent)" />}
                      {staff.role === 'admin' ? 'Administrator' : staff.role === 'waiter' ? 'Waiter' : 'Chef / Kitchen'}
                    </span>
                  </td>
                  <td>
                    {staff.is_active ? (
                      <span className="badge badge-ready">Active</span>
                    ) : (
                      <span className="badge badge-danger">Disabled</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(staff.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isSelf ? (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Locked (Current Account)</span>
                    ) : (
                      <button
                        type="button"
                        className={staff.is_active ? 'btn-danger btn-sm' : 'btn-success btn-sm'}
                        onClick={() => handleToggleStatus(staff)}
                      >
                        {staff.is_active ? 'Disable Login' : 'Enable Login'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Staff Account Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-primary)' }}>Create Staff Account</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowCreateModal(false)} style={{ border: 'none' }}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff}>
              <div className="modal-body">
                {/* Auto-generated Staff ID display */}
                <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border-strong)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Auto-Generated Staff ID
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary-action)', marginTop: '2px' }}>
                    {nextStaffIdPreview}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Generated automatically by the system for operational badge tracking.
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="staff-name-input">Display Name (Full Name)</label>
                  <input
                    id="staff-name-input"
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="staff-role-select">Assigned Operational Role</label>
                  <select
                    id="staff-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'waiter' | 'chef')}
                    style={{ width: '100%' }}
                  >
                    <option value="waiter">Waiter (Floor tables, order booking)</option>
                    <option value="chef">Chef / Kitchen (Live food prep queue)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="staff-email-input">Login Email Address (Required)</label>
                  <input
                    id="staff-email-input"
                    type="email"
                    placeholder="e.g. ramesh@hotel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="staff-pass-input">Password (Required)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="staff-pass-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', paddingRight: '38px' }}
                      required
                      minLength={6}
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
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Provisioning...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
