// Kitchen audible alert system using Web Audio API
// Provides loud, authentic 5.0-second phone/bell ringtone and background keep-alive for kitchen staff

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked = false;
  private soundEnabled = true;
  private activeRingNodes: AudioNode[] = [];
  private keepAliveNode: AudioNode | null = null;
  private isCurrentlyRinging = false;
  private ringTimeoutId: number | null = null;
  private ringListeners: Set<(isRinging: boolean) => void> = new Set();

  constructor() {
    // Check localStorage preference if previously chosen
    const stored = localStorage.getItem('kitchen_sound_enabled');
    if (stored !== null) {
      this.soundEnabled = stored === 'true';
    }
  }

  // Initialize or resume AudioContext on user interaction
  public async unlockAudio(): Promise<boolean> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.isAudioUnlocked = this.audioCtx.state === 'running';
      return this.isAudioUnlocked;
    } catch (err) {
      console.warn('Web Audio unlock failed:', err);
      this.isAudioUnlocked = false;
      return false;
    }
  }

  public getStatus(): { unlocked: boolean; enabled: boolean; isRinging: boolean } {
    return {
      unlocked: this.isAudioUnlocked && (this.audioCtx?.state === 'running'),
      enabled: this.soundEnabled,
      isRinging: this.isCurrentlyRinging,
    };
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('kitchen_sound_enabled', enabled ? 'true' : 'false');
    if (!enabled) {
      this.stopRing();
    }
  }

  public subscribeRingState(listener: (isRinging: boolean) => void): () => void {
    this.ringListeners.add(listener);
    return () => {
      this.ringListeners.delete(listener);
    };
  }

  private setRinging(val: boolean) {
    this.isCurrentlyRinging = val;
    this.ringListeners.forEach((fn) => fn(val));
  }

  // Stops currently active ringtone immediately
  public stopRing(): void {
    if (this.ringTimeoutId !== null) {
      clearTimeout(this.ringTimeoutId);
      this.ringTimeoutId = null;
    }

    if (this.activeRingNodes.length > 0) {
      this.activeRingNodes.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore already stopped
        }
      });
      this.activeRingNodes = [];
    }

    this.setRinging(false);
  }

  // Plays an authentic, loud, rich telephone/bell ringtone for EXACTLY 5.0 seconds
  // Hardware-scheduled on AudioContext.currentTime so it never gets throttled in background
  public async playKitchenOrderRing(): Promise<void> {
    if (!this.soundEnabled) return;

    if (!this.audioCtx || this.audioCtx.state !== 'running') {
      const unlocked = await this.unlockAudio();
      if (!unlocked || !this.audioCtx) {
        console.warn('Cannot play kitchen ring: AudioContext not unlocked by user gesture yet.');
        return;
      }
    }

    // Stop any existing ring first
    this.stopRing();

    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const duration = 5.0; // EXACTLY 5.000 seconds

      // Master output gain: loud and strong (0.85)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.85, now);
      masterGain.connect(ctx.destination);

      // Resonant dual-tone bell frequencies: 784 Hz (G5) + 1046.5 Hz (C6) + 1318.5 Hz harmonic
      const tone1 = ctx.createOscillator();
      tone1.type = 'sine';
      tone1.frequency.setValueAtTime(784, now);

      const tone2 = ctx.createOscillator();
      tone2.type = 'triangle'; // Gives metallic chime harmonics
      tone2.frequency.setValueAtTime(1046.5, now);

      const tone3 = ctx.createOscillator();
      tone3.type = 'sine';
      tone3.frequency.setValueAtTime(1318.5, now);

      // Tremolo / mechanical bell cadence modulator: 22Hz oscillation
      const tremoloOsc = ctx.createOscillator();
      tremoloOsc.frequency.setValueAtTime(22, now);
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.setValueAtTime(0.3, now);
      tremoloOsc.connect(tremoloGain.gain);

      // Cadence gain: ring burst pattern across exactly 5.0 seconds:
      // Burst 1: 0.0s to 1.8s (ring)
      // Pause:   1.8s to 2.2s (silence)
      // Burst 2: 2.2s to 4.0s (ring)
      // Pause:   4.0s to 4.3s (silence)
      // Burst 3: 4.3s to 5.0s (final ring)
      const cadenceGain = ctx.createGain();
      cadenceGain.gain.setValueAtTime(0, now);

      // Burst 1
      cadenceGain.gain.setValueAtTime(0, now);
      cadenceGain.gain.linearRampToValueAtTime(1.0, now + 0.04);
      cadenceGain.gain.setValueAtTime(1.0, now + 1.76);
      cadenceGain.gain.linearRampToValueAtTime(0, now + 1.80);

      // Burst 2
      cadenceGain.gain.setValueAtTime(0, now + 2.16);
      cadenceGain.gain.linearRampToValueAtTime(1.0, now + 2.20);
      cadenceGain.gain.setValueAtTime(1.0, now + 3.96);
      cadenceGain.gain.linearRampToValueAtTime(0, now + 4.00);

      // Burst 3 (stops cleanly at 5.00s)
      cadenceGain.gain.setValueAtTime(0, now + 4.26);
      cadenceGain.gain.linearRampToValueAtTime(1.0, now + 4.30);
      cadenceGain.gain.setValueAtTime(1.0, now + 4.96);
      cadenceGain.gain.linearRampToValueAtTime(0, now + 5.00);

      // Connect graph
      tone1.connect(cadenceGain);
      tone2.connect(cadenceGain);
      tone3.connect(cadenceGain);
      cadenceGain.connect(masterGain);

      // Hardware timing schedule
      tremoloOsc.start(now);
      tone1.start(now);
      tone2.start(now);
      tone3.start(now);

      tremoloOsc.stop(now + duration);
      tone1.stop(now + duration);
      tone2.stop(now + duration);
      tone3.stop(now + duration);

      this.activeRingNodes = [tremoloOsc, tone1, tone2, tone3, cadenceGain, masterGain];
      this.setRinging(true);

      // Cleanup when 5.0 seconds expire
      this.ringTimeoutId = window.setTimeout(() => {
        this.stopRing();
      }, 5000);
    } catch (err) {
      console.warn('Error playing 5-second kitchen ring:', err);
      this.setRinging(false);
    }
  }

  // Alias for backward compatibility
  public async playNewOrderChime(): Promise<void> {
    await this.playKitchenOrderRing();
  }

  // Kitchen Background Keep-Alive: Maintains low-level audio carrier so mobile/desktop OS
  // does not pause WebSockets, Realtime listeners, or AudioContext when screen is locked or app is backgrounded.
  // ONLY activated for Kitchen Staff role.
  public async startKitchenBackgroundKeepAlive(): Promise<void> {
    if (this.keepAliveNode) return;

    if (!this.audioCtx || this.audioCtx.state !== 'running') {
      await this.unlockAudio();
    }

    if (!this.audioCtx) return;

    try {
      const silentOsc = this.audioCtx.createOscillator();
      const silentGain = this.audioCtx.createGain();
      // Near-inaudible carrier gain (0.00001) that keeps OS audio pipeline active
      silentGain.gain.setValueAtTime(0.00001, this.audioCtx.currentTime);
      silentOsc.frequency.setValueAtTime(45, this.audioCtx.currentTime);

      silentOsc.connect(silentGain);
      silentGain.connect(this.audioCtx.destination);
      silentOsc.start();
      this.keepAliveNode = silentOsc;
    } catch (err) {
      console.warn('Failed to initialize kitchen audio keep-alive:', err);
    }
  }

  public stopKitchenBackgroundKeepAlive(): void {
    if (this.keepAliveNode) {
      try {
        if ('stop' in this.keepAliveNode && typeof (this.keepAliveNode as AudioScheduledSourceNode).stop === 'function') {
          (this.keepAliveNode as AudioScheduledSourceNode).stop();
        }
        this.keepAliveNode.disconnect();
      } catch {
        // ignore
      }
      this.keepAliveNode = null;
    }
  }
}

export const kitchenSound = new SoundManager();
