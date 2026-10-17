import React, { useState } from 'react';
import { api } from '../../lib/api';
import { DiningTable, TableSession } from '../../types/database';
import { Plus, Check, X, AlertCircle } from 'lucide-react';

interface TableManagementViewProps {
  tables: DiningTable[];
  tableSessions: TableSession[];
  onTablesUpdated: () => void;
}

export const TableManagementView: React.FC<TableManagementViewProps> = ({
  tables,
  tableSessions,
  onTablesUpdated,
}) => {
  const [newTableNumber, setNewTableNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;
    setErrorMessage('');
    try {
      await api.createTable(newTableNumber.trim().toUpperCase());
      setNewTableNumber('');
      setNoticeMessage(`Table ${newTableNumber.trim().toUpperCase()} created.`);
      onTablesUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleTable = async (tbl: DiningTable) => {
    setErrorMessage('');
    setNoticeMessage('');
    try {
      await api.toggleTableActive(tbl.id, !tbl.is_active);
      setNoticeMessage(`Table ${tbl.table_number} status updated.`);
      onTablesUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Table Management</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Configure active floor tables and toggle operational availability
          </span>
        </div>

        {/* Add Table form */}
        <form onSubmit={handleAddTable} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="e.g. T13 or Garden-1"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            style={{ width: '160px', minHeight: '34px' }}
            required
          />
          <button type="submit" className="btn-primary btn-sm">
            <Plus size={14} />
            Add Table
          </button>
        </form>
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

      {/* Tables Grid */}
      <div className="grid-4">
        {tables.map((tbl) => {
          const hasOpenSession = tableSessions.some((s) => s.table_id === tbl.id && s.session_status === 'open');
          return (
            <div
              key={tbl.id}
              className="panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                opacity: tbl.is_active ? 1 : 0.6,
                backgroundColor: tbl.is_active ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
              }}
            >
              <div>
                <span style={{ fontWeight: 800, fontSize: '16px' }}>{tbl.table_number}</span>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                  {hasOpenSession ? (
                    <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Active Dining Session</span>
                  ) : tbl.is_active ? (
                    <span style={{ color: 'var(--success)' }}>Operational & Vacant</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Deactivated</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={`btn-sm ${tbl.is_active ? 'btn-danger' : 'btn-success'}`}
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => handleToggleTable(tbl)}
                disabled={hasOpenSession && tbl.is_active}
                title={hasOpenSession ? 'Cannot deactivate table while active session is open' : ''}
              >
                {tbl.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
