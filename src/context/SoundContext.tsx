import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { kitchenSound } from '../lib/sound';

interface SoundContextType {
  audioUnlocked: boolean;
  soundEnabled: boolean;
  isRinging: boolean;
  unlockAudio: () => Promise<boolean>;
  setSoundEnabled: (enabled: boolean) => void;
  playKitchenOrderRing: () => Promise<void>;
  playNewOrderChime: () => Promise<void>;
  stopRing: () => void;
  startKitchenBackgroundKeepAlive: () => Promise<void>;
  stopKitchenBackgroundKeepAlive: () => void;
  registerInitialOrders: (orderIds: string[]) => void;
  notifyIfNewOrder: (orderId: string, ticketNumber?: string) => Promise<boolean>;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(kitchenSound.getStatus().enabled);
  const [isRinging, setIsRinging] = useState(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Check initial status
    const status = kitchenSound.getStatus();
    setAudioUnlocked(status.unlocked);
    setSoundEnabledState(status.enabled);
    setIsRinging(status.isRinging);

    // Subscribe to ringing state changes
    const unsub = kitchenSound.subscribeRingState((ringing) => {
      setIsRinging(ringing);
    });

    return () => unsub();
  }, []);

  const unlockAudio = async (): Promise<boolean> => {
    const success = await kitchenSound.unlockAudio();
    setAudioUnlocked(success);
    return success;
  };

  const setSoundEnabled = (enabled: boolean) => {
    kitchenSound.setSoundEnabled(enabled);
    setSoundEnabledState(enabled);
  };

  const stopRing = () => {
    kitchenSound.stopRing();
  };

  const playKitchenOrderRing = async () => {
    await kitchenSound.playKitchenOrderRing();
  };

  const playNewOrderChime = async () => {
    await kitchenSound.playKitchenOrderRing();
  };

  const startKitchenBackgroundKeepAlive = async () => {
    await kitchenSound.startKitchenBackgroundKeepAlive();
  };

  const stopKitchenBackgroundKeepAlive = () => {
    kitchenSound.stopKitchenBackgroundKeepAlive();
  };

  // Pre-seed known orders on initial load to avoid playing sound for existing history
  const registerInitialOrders = (orderIds: string[]) => {
    orderIds.forEach((id) => seenOrderIdsRef.current.add(id));
    isInitializedRef.current = true;
  };

  // Rings for exactly 5 seconds if order ticket has NEVER been seen by this client before
  const notifyIfNewOrder = async (orderId: string, ticketNumber?: string): Promise<boolean> => {
    // If not initialized yet, don't trigger alert on startup race
    if (!isInitializedRef.current) {
      seenOrderIdsRef.current.add(orderId);
      return false;
    }

    if (seenOrderIdsRef.current.has(orderId)) {
      // Already seen or reconnected: NO duplicate sound
      return false;
    }

    // Genuinely new ticket: register and ring
    seenOrderIdsRef.current.add(orderId);
    await kitchenSound.playKitchenOrderRing();

    // Trigger system notification if screen is locked or tab is hidden
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = `🚨 NEW KITCHEN ORDER: ${ticketNumber || 'Ticket'}`;
        const notif = new Notification(title, {
          body: 'A new order was just sent to the kitchen queue.',
          icon: '/hotel%20logo.png',
          tag: 'kitchen-new-order',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Notification display failed:', err);
      }
    }

    return true;
  };

  return (
    <SoundContext.Provider
      value={{
        audioUnlocked,
        soundEnabled,
        isRinging,
        unlockAudio,
        setSoundEnabled,
        playKitchenOrderRing,
        playNewOrderChime,
        stopRing,
        startKitchenBackgroundKeepAlive,
        stopKitchenBackgroundKeepAlive,
        registerInitialOrders,
        notifyIfNewOrder,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) throw new Error('useSound must be used within a SoundProvider');
  return context;
};
