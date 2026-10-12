/**
 * Resilient Web Audio Alarm Engine
 * Provides 100% offline-capable synthesized alarms via Web Audio API,
 * speech synthesis voice announcements, and device vibration patterns.
 */

let audioCtx = null;
let activeToneInterval = null;
let isRinging = false;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a single tone burst using Web Audio API
 */
function playToneBurst(freq, type = 'sine', durationSec = 0.2, gainValue = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Envelope
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationSec);
  } catch (err) {
    console.warn('Audio tone burst error:', err);
  }
}

/**
 * Starts continuous alarm playback based on selected sound profile
 * @param {'digital'|'siren'|'gentle'} toneProfile
 */
export function startAlarmTone(toneProfile = 'digital') {
  if (isRinging) return;
  isRinging = true;

  getAudioContext();

  if (activeToneInterval) {
    clearInterval(activeToneInterval);
    activeToneInterval = null;
  }

  if (toneProfile === 'siren') {
    let high = true;
    const playSirenStep = () => {
      if (!isRinging) return;
      playToneBurst(high ? 960 : 770, 'sawtooth', 0.28, 0.35);
      high = !high;
    };
    playSirenStep();
    activeToneInterval = setInterval(playSirenStep, 320);

  } else if (toneProfile === 'gentle') {
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    let step = 0;
    const playGentleStep = () => {
      if (!isRinging) return;
      playToneBurst(chords[step % chords.length], 'sine', 0.45, 0.25);
      step++;
    };
    playGentleStep();
    activeToneInterval = setInterval(playGentleStep, 450);

  } else {
    // Default 'digital' watch alarm pattern (high-pitched rapid dual-beeps)
    const playDigitalBurst = () => {
      if (!isRinging) return;
      playToneBurst(1760, 'square', 0.08, 0.25);
      setTimeout(() => {
        if (isRinging) playToneBurst(1760, 'square', 0.08, 0.25);
      }, 110);
    };
    playDigitalBurst();
    activeToneInterval = setInterval(playDigitalBurst, 600);
  }
}

/**
 * Stops any actively ringing synthesized alarm
 */
export function stopAlarmTone() {
  isRinging = false;
  if (activeToneInterval) {
    clearInterval(activeToneInterval);
    activeToneInterval = null;
  }
}

/**
 * Device vibration with intensity scale
 * @param {number} intensity 1: Low, 2: Medium, 3: High
 */
export function triggerVibration(intensity = 3) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const patterns = {
        1: [200, 200, 200],
        2: [400, 200, 400, 200],
        3: [800, 200, 800, 200, 1000]
      };
      const pattern = patterns[intensity] || patterns[3];
      navigator.vibrate(pattern);
    } catch {
      // Non-fatal if unsupported
    }
  }
}

export function stopVibration() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
}

let lastSpokenText = '';
let lastSpokenTimestamp = 0;

/**
 * Speaks a voice announcement via Web Speech API with deduplication and throttling
 * to prevent speech stutter/re-triggering on live tracking telemetry updates.
 */
export function speakAnnouncement(text) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const now = Date.now();
      // Prevent re-triggering the same announcement within 12 seconds
      if (lastSpokenText === text && (now - lastSpokenTimestamp < 12000)) {
        return;
      }
      // If already speaking the same text, let it finish naturally
      if (window.speechSynthesis.speaking && lastSpokenText === text) {
        return;
      }

      window.speechSynthesis.cancel(); // Cancel any lingering speech
      lastSpokenText = text;
      lastSpokenTimestamp = now;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.volume = 1.0;
      utterance.onend = () => {
        // Speech ended naturally
      };
      utterance.onerror = () => {
        // Speech error handled silently
      };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis notice:', err);
    }
  }
}

export function stopAnnouncement() {
  lastSpokenText = '';
  lastSpokenTimestamp = 0;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Checks if the synthesized alarm is currently ringing
 */
export function isAlarmActive() {
  return isRinging;
}

/**
 * Desktop/PWA Web Notification
 */
export function showAlarmNotification(title, body) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          requireInteraction: true,
          tag: 'railsafe-destination-alarm'
        });
      } catch (e) {
        console.warn('Notification display notice:', e);
      }
    }
  }
}
