/**
 * Web Audio API synthesizer for premium and polished interactive sound effects in Oxente Festeje.
 * It features clean procedural synthesis models (no heavy external mp3s to download).
 */

type SoundType = 'success' | 'click' | 'alert' | 'complete' | 'trash' | 'pop';

// Storage Key
const MUTED_STORAGE_KEY = 'oxente_festeje_audio_muted';

// Get current muted state
export function getIsAudioMuted(): boolean {
  return localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
}

// Set muted state and notify other components via a custom event
export function setAudioMuted(muted: boolean) {
  localStorage.setItem(MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  // Dispatch a global event for UI reactiveness
  window.dispatchEvent(new CustomEvent('oxente_app_audio_mute_changed', { detail: muted }));
}

/**
 * Procedural Synthesizer for high fidelity micro-sounds
 */
export function playAppSound(type: SoundType) {
  try {
    if (getIsAudioMuted()) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    switch (type) {
      case 'click': {
        // Very quick, clean tactile acoustic tap / pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);
        
        gain.gain.setValueAtTime(0.015, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }

      case 'pop': {
        // High-pitch hollow water bubble pop state
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }

      case 'success': {
        // Happy, elegant double chime (e.g. reminders updated, state checked)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        gain1.gain.setValueAtTime(0.04, now);
        gain1.gain.exponentialRampToValueAtTime(0.002, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.09); // A5
        gain2.gain.setValueAtTime(0.04, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.002, now + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.28);
        break;
      }

      case 'alert': {
        // Friendly alert chime (two rapid medium-high notes)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.03, now);
        gain1.gain.exponentialRampToValueAtTime(0.002, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(587.33, now + 0.08); // D5
        gain2.gain.setValueAtTime(0.03, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.002, now + 0.22);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.22);
        break;
      }

      case 'complete': {
        // Triumphant, gold-grade warm triple chord melody for closing/completing packages/sales
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, index) => {
          const delay = index * 0.07;
          const duration = 0.4 - delay;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + delay);
          gain.gain.setValueAtTime(0.03, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now + delay);
          osc.stop(now + delay + duration);
        });
        break;
      }

      case 'trash': {
        // Descending digital dissolve sound for sweeps and trash/revert tasks
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
    }
  } catch (error) {
    console.warn('Procedural synthesis failed to actuate:', error);
  }
}
