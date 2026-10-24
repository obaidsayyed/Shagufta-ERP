import React, { useState, useEffect } from 'react';
import { useSound } from '../../context/SoundContext';
import { useAuth } from '../../context/AuthContext';

export const BackgroundPermissionPrompt: React.FC = () => {
  const { unlockAudio, startKitchenBackgroundKeepAlive } = useSound();
  const { currentStaff } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Check if permission was already handled globally on this device
    const deviceHandled = localStorage.getItem('shagufta_bg_permission_handled') === 'true';
    if (deviceHandled) {
      return;
    }

    // 2. Check if current staff account already handled / allowed this permission
    if (currentStaff) {
      const accountHandled =
        localStorage.getItem(`shagufta_bg_permission_handled_${currentStaff.staff_id}`) === 'true' ||
        localStorage.getItem(`shagufta_bg_permission_handled_${currentStaff.id}`) === 'true';

      if (accountHandled) {
        return;
      }
    }

    // 3. Delay display slightly so it animates in smoothly after initial render
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentStaff]);

  const handleAllowBackground = async () => {
    // 1. Record globally on device
    localStorage.setItem('shagufta_bg_permission_handled', 'true');
    localStorage.setItem('shagufta_bg_permission_granted', 'true');

    // 2. Record specifically for this staff account so it NEVER asks again
    if (currentStaff) {
      localStorage.setItem(`shagufta_bg_permission_handled_${currentStaff.staff_id}`, 'true');
      localStorage.setItem(`shagufta_bg_permission_granted_${currentStaff.staff_id}`, 'true');
      localStorage.setItem(`shagufta_bg_permission_handled_${currentStaff.id}`, 'true');
      localStorage.setItem(`shagufta_bg_permission_granted_${currentStaff.id}`, 'true');
    }

    try {
      // Unlock Web Audio Context
      await unlockAudio();

      // Start silent keep-alive audio carrier for continuous background operation
      await startKitchenBackgroundKeepAlive();

      // Request Screen WakeLock if available on device
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          const wakeLockNav = navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } };
          await wakeLockNav.wakeLock.request('screen');
        } catch {
          // Wake lock rejected or not supported on this device/state
        }
      }
    } catch (err) {
      console.warn('Background audio activation error:', err);
    } finally {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    // Record that permission is handled so it is never asked again for this device and account
    localStorage.setItem('shagufta_bg_permission_handled', 'true');
    localStorage.setItem('shagufta_bg_permission_granted', 'false');

    if (currentStaff) {
      localStorage.setItem(`shagufta_bg_permission_handled_${currentStaff.staff_id}`, 'true');
      localStorage.setItem(`shagufta_bg_permission_granted_${currentStaff.staff_id}`, 'false');
      localStorage.setItem(`shagufta_bg_permission_handled_${currentStaff.id}`, 'true');
      localStorage.setItem(`shagufta_bg_permission_granted_${currentStaff.id}`, 'false');
    }

    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="bg-permission-title"
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '440px',
        zIndex: 99998,
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1.5px solid var(--border-strong)',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12)',
        padding: '14px 16px',
        animation: 'bgSlideDown 0.3s ease-out forwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Pulsing Bell / Background Audio Icon */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1.5px solid var(--secondary-accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--secondary-accent)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            id="bg-permission-title"
            style={{
              fontWeight: 800,
              fontSize: '13.5px',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Run in Background Permission
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '3px',
              lineHeight: 1.35,
            }}
          >
            Allow Shagufta POS to keep audio order alerts active in the background when your screen is locked or you switch apps.
          </div>
        </div>
      </div>

      {/* Action Buttons: Allow in Background vs Not now */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          className="btn-secondary"
          onClick={handleDismiss}
          style={{
            fontSize: '11.5px',
            padding: '5px 14px',
            minHeight: '30px',
            fontWeight: 600,
          }}
        >
          Not now
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={handleAllowBackground}
          style={{
            fontSize: '11.5px',
            padding: '5px 16px',
            minHeight: '30px',
            fontWeight: 700,
          }}
        >
          Allow in Background
        </button>
      </div>

      <style>{`
        @keyframes bgSlideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
};
