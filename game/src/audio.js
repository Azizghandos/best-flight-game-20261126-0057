// All sound is synthesized with WebAudio: an engine hum whose pitch follows the
// throttle, plus short bleeps for rings, drops, touchdowns and crashes. No audio
// files, no network. The context is created on the first user gesture.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(context.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(volume || 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain).connect(context.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Sound is decoration; a failure here must never break the game.
    }
  }

  function noiseBurst(dur, volume) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const length = Math.floor(context.sampleRate * dur);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = volume || 0.2;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(now);
    } catch {
      // Sound is decoration; ignore failures.
    }
  }

  return {
    /** Call from any user gesture so the browser unlocks audio. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** Engine hum follows the throttle (0..1) and whether the plane is flying. */
    setEngine(throttle, flying) {
      if (!ensure() || muted) return;
      try {
        const target = flying ? 0.045 + throttle * 0.075 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.15);
        engineOsc.frequency.setTargetAtTime(46 + throttle * 68, context.currentTime, 0.2);
      } catch {
        // Ignore audio errors.
      }
    },
    ring() {
      tone(880, 0.22, 'sine', 0.16);
      setTimeout(() => tone(1318, 0.3, 'sine', 0.14), 70);
    },
    centreRing() {
      tone(1046, 0.18, 'sine', 0.16);
      setTimeout(() => tone(1568, 0.34, 'sine', 0.15), 60);
    },
    drop() {
      tone(620, 0.35, 'sine', 0.12, 240);
    },
    bullseye() {
      tone(784, 0.16, 'triangle', 0.16);
      setTimeout(() => tone(1046, 0.16, 'triangle', 0.16), 90);
      setTimeout(() => tone(1318, 0.3, 'triangle', 0.16), 180);
    },
    touchdown() {
      noiseBurst(0.18, 0.16);
      tone(140, 0.22, 'sine', 0.18, 70);
    },
    click() {
      tone(660, 0.07, 'square', 0.06);
    },
    warning() {
      tone(440, 0.14, 'square', 0.08);
      setTimeout(() => tone(440, 0.14, 'square', 0.08), 180);
    },
    crash() {
      noiseBurst(0.7, 0.32);
      tone(90, 0.6, 'sawtooth', 0.2, 38);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((freq, index) => {
        setTimeout(() => tone(freq, 0.32, 'triangle', 0.15), index * 110);
      });
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
  };
}
