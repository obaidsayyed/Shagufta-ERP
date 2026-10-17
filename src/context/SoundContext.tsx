import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { kitchenSound } from '../lib/sound';

interface SoundContextType {
  audioUnlocked: boolean;
  soundEnabled: boolean;
  unlockAudio: () => Promise<boolean>;
  setSoundEnabled: (enabled: boolean) => void;
  playNewOrderChime: () => Promise<void>;
  registerInitialOrders: (orderIds: string[]) => void;
  notifyIfNewOrder: (orderId: string) => Promise<boolean>;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(kitchenSound.getStatus().enabled);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Check initial status
    const status = kitchenSound.getStatus();
    setAudioUnlocked(status.unlocked);
    setSoundEnabledState(status.enabled);
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

  // Pre-seed known orders on initial load to avoid playing sound for existing history
  const registerInitialOrders = (orderIds: string[]) => {
    orderIds.forEach((id) => seenOrderIdsRef.current.add(id));
    isInitializedRef.current = true;
  };

  // Only chimes if the order ticket has NEVER been seen by this client before
  const notifyIfNewOrder = async (orderId: string): Promise<boolean> => {
    // If not initialized yet, don't trigger chime on startup race
    if (!isInitializedRef.current) {
      seenOrderIdsRef.current.add(orderId);
      return false;
    }

    if (seenOrderIdsRef.current.has(orderId)) {
      // Already seen or reconnected: NO duplicate sound
      return false;
    }

    // Genuinely new ticket: register and chime
    seenOrderIdsRef.current.add(orderId);
    await kitchenSound.playNewOrderChime();
    return true;
  };

  const playNewOrderChime = async () => {
    await kitchenSound.playNewOrderChime();
  };

  return (
    <SoundContext.Provider
      value={{
        audioUnlocked,
        soundEnabled,
        unlockAudio,
        setSoundEnabled,
        playNewOrderChime,
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
