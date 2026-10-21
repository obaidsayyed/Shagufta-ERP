import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';
import { api } from '../../lib/api';
import { 
  OrderTicket, 
  OrderItem, 
  DiningTable, 
  ParcelOrder, 
  KitchenPreparationGroup 
} from '../../types/database';


export const KitchenView: React.FC = () => {
  const { currentStaff } = useAuth();
  const { 
    audioUnlocked, 
    soundEnabled, 
    isRinging,
    unlockAudio, 
    setSoundEnabled, 
    playKitchenOrderRing, 
    stopRing,
    startKitchenBackgroundKeepAlive,
    stopKitchenBackgroundKeepAlive,
    registerInitialOrders, 
    notifyIfNewOrder 
  } = useSound();

  const [prepGroups, setPrepGroups] = useState<KitchenPreparationGroup[]>([]);
  
  const [markingGroupKey, setMarkingGroupKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Screen Wake Lock: Strictly for Kitchen Staff to prevent screen sleep/dimming
  useEffect(() => {
    if (currentStaff?.role !== 'chef') return;

    let wakeLockSentinel: { release: () => Promise<void> } | null = null;

    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock?.request) {
          wakeLockSentinel = await nav.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Screen WakeLock unavailable or denied:', err);
      }
    };

    requestWakeLock();

    // Re-acquire on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockSentinel) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Request Notification permission for background/lock-screen alerts
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [currentStaff?.role]);

  // 2. Background Audio Keep-Alive: Strictly for Kitchen Staff
  useEffect(() => {
    if (currentStaff?.role !== 'chef') return;

    if (audioUnlocked) {
      startKitchenBackgroundKeepAlive();
    }

    return () => {
      stopKitchenBackgroundKeepAlive();
    };
  }, [currentStaff?.role, audioUnlocked, startKitchenBackgroundKeepAlive, stopKitchenBackgroundKeepAlive]);

  const loadData = async (isInitialLoad = false) => {
    try {
      const [oList, oiList, tList, pList, sList] = await Promise.all([
        api.getOrders(),
        api.getOrderItems(),
        api.getTables(),
        api.getParcelOrders(),
        api.getTableSessions(),
      ]);

      if (isInitialLoad) {
        // Register initial orders so they never trigger audible alerts
        registerInitialOrders(oList.map((o) => o.id));
      } else {
        // Ring for any newly arrived orders not yet rung
        for (const ord of oList) {
          await notifyIfNewOrder(ord.id, ord.ticket_number);
        }
      }

      // Compute grouped preparation items with table sessions
      const groups = api.getKitchenPreparationGroups(oList, oiList, tList, pList, sList);
      setPrepGroups(groups);
    } catch (err: unknown) {
      console.error('Error loading kitchen orders:', err);
    }
  };

  useEffect(() => {
    loadData(true);

    // 1. Subscribe to Realtime events (postgres_changes and broadcast)
    const unsubscribe = api.subscribe(async (event, payload: unknown) => {
      if (event === 'NEW_ORDER') {
        const data = payload as { order?: OrderTicket; id?: string; ticket_number?: string };
        const orderId = data?.order?.id || data?.id;
        const ticketNumber = data?.order?.ticket_number || data?.ticket_number;
        if (orderId) {
          await notifyIfNewOrder(orderId, ticketNumber);
        }
      } else if (event === 'ORDERS_CHANGED') {
        const changePayload = payload as { eventType?: string; new?: { id?: string; ticket_number?: string } };
        if (changePayload?.eventType === 'INSERT' && changePayload.new?.id) {
          await notifyIfNewOrder(changePayload.new.id, changePayload.new.ticket_number);
        }
      }
      loadData(false);
    });

    // 2. High-reliability polling fallback: checks every 2.5s so kitchen rings
    // even if WebSockets are in reconnect or network throttled
    const pollInterval = window.setInterval(() => {
      loadData(false);
    }, 2500);

    // 3. User gesture auto-unlock: first tap/click anywhere unlocks audio context
    const unlockOnGesture = () => {
      unlockAudio();
    };
    window.addEventListener('pointerdown', unlockOnGesture, { once: true });
    window.addEventListener('keydown', unlockOnGesture, { once: true });

    return () => {
      unsubscribe();
      window.clearInterval(pollInterval);
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
    };
  }, [notifyIfNewOrder, unlockAudio]);

  const handleTestRing = async () => {
    await unlockAudio();
    await playKitchenOrderRing();
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      await unlockAudio();
    }
  };

  const handleMarkReady = async (group: KitchenPreparationGroup, qtyToReady: number) => {
    if (!currentStaff) return;
    setMarkingGroupKey(group.group_key);
    setErrorMessage('');

    try {
      await api.markPreparationGroupReady({
        table_session_id: group.table_session_id,
        parcel_id: group.parcel_id,
        menu_item_id: group.menu_item_id,
        quantity_to_ready: qtyToReady,
        caller_staff: currentStaff,
      });

      await loadData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setMarkingGroupKey(null);
    }
  };

  // Group prep groups by destination: Table or Parcel
  const tableGroups = prepGroups.filter((g) => g.order_type === 'dine_in');
  const parcelGroups = prepGroups.filter((g) => g.order_type === 'parcel');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Kitchen Control Header & Audio Status */}
      <div className="panel" style={{ marginBottom: '12px', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Kitchen Preparation Queue</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {prepGroups.length} pending dish group{prepGroups.length !== 1 ? 's' : ''} awaiting completion
            </span>
          </div>

          {/* Sound Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isRinging && (
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={stopRing}
                style={{
                  fontWeight: 800,
                  fontSize: '11.5px',
                  padding: '3px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Silence currently ringing alert"
              >
                <span>🔔 Ringing (5s)</span>
                <span style={{ textDecoration: 'underline' }}>Silence</span>
              </button>
            )}

            {!audioUnlocked ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={unlockAudio}
                title="Browser requires one user interaction to enable order alert sounds"
              >
                Enable Sound Alerts
              </button>
            ) : (
              <button
                type="button"
                className={`btn-sm ${soundEnabled ? 'btn-secondary' : 'btn-danger'}`}
                onClick={handleToggleSound}
                title={soundEnabled ? 'Mute Kitchen Alerts' : 'Unmute Kitchen Alerts'}
              >
                {soundEnabled ? 'Sound: On' : 'Sound: Muted'}
              </button>
            )}

            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleTestRing}
              title="Test the 5-second kitchen ringtone"
            >
              Test Ring (5s)
            </button>
          </div>
        </div>

        {!audioUnlocked && (
          <div
            className="alert-banner alert-banner-warning"
            style={{ marginTop: '8px', marginBottom: 0, padding: '6px 10px', fontSize: '12px' }}
          >
            <span>
              <strong>Audio Notice:</strong> Click <strong>&quot;Enable Sound Alerts&quot;</strong> once so the kitchen terminal can ring for 5 seconds when new orders arrive.
            </span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="alert-banner alert-banner-danger" style={{ marginBottom: '12px', padding: '8px 12px' }}>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Kitchen Prep Queue: Dine-In Tables vs Takeaway Parcels */}
      <div className="kitchen-queue-grid">
        {/* Column 1: Dine-In Table Groups */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Dine-In Tables ({tableGroups.length})
            </span>
          </div>

          {tableGroups.length === 0 ? (
            <div className="panel" style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 600, fontSize: '13px' }}>All table food prepared</p>
              <span style={{ fontSize: '12px' }}>No pending orders in dine-in queue</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tableGroups.map((group) => {
                const isMarking = markingGroupKey === group.group_key;
                const elapsedMinutes = Math.floor((Date.now() - new Date(group.first_ordered_at).getTime()) / 60000);
                const isUrgent = elapsedMinutes >= 15;

                return (
                  <div
                    key={group.group_key}
                    className="panel"
                    style={{
                      padding: '10px 12px',
                      borderLeft: isUrgent ? '3px solid var(--danger)' : '3px solid var(--accent)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '13px',
                            backgroundColor: 'var(--bg-surface-subtle)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-strong)',
                          }}
                        >
                          {group.table_number}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{group.dish_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {group.category_name}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: isUrgent ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {elapsedMinutes}m ago
                      </div>
                    </div>

                    {/* Pending quantity vs Already Prepared quantity */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pending:</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, marginLeft: '6px', color: 'var(--accent)' }}>
                          {group.pending_qty}
                        </span>
                      </div>

                      {group.total_prepared_qty > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                          {group.total_prepared_qty} ready
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {group.pending_qty > 1 && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={isMarking}
                          onClick={() => handleMarkReady(group, 1)}
                        >
                          Mark 1 Ready
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-success btn-sm"
                        disabled={isMarking}
                        onClick={() => handleMarkReady(group, group.pending_qty)}
                      >
                        {isMarking ? 'Updating...' : `Mark All ${group.pending_qty} Ready`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Takeaway Parcels */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Takeaway Parcels ({parcelGroups.length})
            </span>
          </div>

          {parcelGroups.length === 0 ? (
            <div className="panel" style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 600, fontSize: '13px' }}>No pending parcels</p>
              <span style={{ fontSize: '12px' }}>Takeaway preparation queue is clear</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {parcelGroups.map((group) => {
                const isMarking = markingGroupKey === group.group_key;
                const elapsedMinutes = Math.floor((Date.now() - new Date(group.first_ordered_at).getTime()) / 60000);

                return (
                  <div
                    key={group.group_key}
                    className="panel"
                    style={{
                      padding: '10px 12px',
                      borderLeft: '3px solid #0284c7', // Blue parcel accent
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '12px',
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid #bae6fd',
                          }}
                        >
                          {group.parcel_code}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{group.dish_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {group.category_name}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {elapsedMinutes}m ago
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pending:</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, marginLeft: '6px', color: '#0369a1' }}>
                          {group.pending_qty}
                        </span>
                      </div>

                      {group.total_prepared_qty > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                          {group.total_prepared_qty} ready
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {group.pending_qty > 1 && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={isMarking}
                          onClick={() => handleMarkReady(group, 1)}
                        >
                          Mark 1 Ready
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-success btn-sm"
                        disabled={isMarking}
                        onClick={() => handleMarkReady(group, group.pending_qty)}
                      >
                        {isMarking ? 'Updating...' : `Mark All ${group.pending_qty} Ready`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
