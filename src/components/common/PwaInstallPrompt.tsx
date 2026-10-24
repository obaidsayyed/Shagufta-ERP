import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. If already installed and running as standalone app, do not display install prompt
    const checkIsStandalone = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      );
    };

    if (checkIsStandalone()) {
      return;
    }

    // 2. Detect iOS device (Safari doesn't support beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const showPrompt = () => {
      if (!checkIsStandalone()) {
        setIsVisible(true);
      }
    };

    // 3. Always show on screen open / refresh
    const initialTimer = setTimeout(() => {
      showPrompt();
    }, 600);

    // 4. Capture native browser install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      showPrompt();
    };

    // 5. When tab was left in background and user comes back, or window gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        showPrompt();
      }
    };

    const handleFocus = () => {
      showPrompt();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsVisible(false);
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      } finally {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      // Guide iOS user to Safari "Add to Home Screen"
      setShowIosGuide(true);
    } else {
      // On desktop or browsers without active prompt event
      alert('To install Shagufta POS: Click the Install icon in your browser address bar or select "Install Shagufta POS" from your browser menu.');
      setIsVisible(false);
    }
  };

  const handleDismissClick = () => {
    // Dismiss current appearance; will show again when user refreshes or returns to tab
    setIsVisible(false);
    setShowIosGuide(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '440px',
        zIndex: 99999,
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1.5px solid var(--border-strong)',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12)',
        padding: '14px 16px',
        animation: 'pwaSlideUp 0.3s ease-out forwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/hotel%20logo.png"
          alt="Shagufta POS Logo"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid rgba(234, 179, 8, 0.6)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            id="pwa-install-title"
            style={{
              fontWeight: 800,
              fontSize: '14px',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Shagufta POS
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '3px',
              lineHeight: 1.35,
            }}
          >
            {showIosGuide
              ? "Tap Safari Share button (⎙ / [↑]), then select 'Add to Home Screen' (➕)."
              : "Install the web app on your device for quick access and full-screen experience."}
          </div>
        </div>
      </div>

      {/* Strictly the 2 options requested: Install and Not now */}
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
          onClick={handleDismissClick}
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
          onClick={showIosGuide ? handleDismissClick : handleInstallClick}
          style={{
            fontSize: '11.5px',
            padding: '5px 16px',
            minHeight: '30px',
            fontWeight: 700,
          }}
        >
          {showIosGuide ? 'Got it' : 'Install'}
        </button>
      </div>

      <style>{`
        @keyframes pwaSlideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
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
