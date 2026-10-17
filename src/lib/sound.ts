// Kitchen audible alert system using Web Audio API
// Handles browser autoplay policies, explicit sound activation, and single-event chime

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked = false;
  private soundEnabled = true;

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
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  public getStatus(): { unlocked: boolean; enabled: boolean } {
    return {
      unlocked: this.isAudioUnlocked && (this.audioCtx?.state === 'running'),
      enabled: this.soundEnabled,
    };
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('kitchen_sound_enabled', enabled ? 'true' : 'false');
  }

  // Plays a distinctive, crisp two-tone kitchen chime (high-low ding-ding)
  public async playNewOrderChime(): Promise<void> {
    if (!this.soundEnabled) return;

    if (!this.audioCtx || this.audioCtx.state !== 'running') {
      const unlocked = await this.unlockAudio();
      if (!unlocked || !this.audioCtx) {
        console.warn('Cannot play kitchen alert: AudioContext not unlocked by user gesture yet.');
        return;
      }
    }

    try {
      const now = this.audioCtx.currentTime;

      // Note 1: 880Hz (A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.35, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: 1174.66Hz (D6) - resonant chime
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);
    } catch (err) {
      console.warn('Error playing kitchen order chime:', err);
    }
  }
}

export const kitchenSound = new SoundManager();
