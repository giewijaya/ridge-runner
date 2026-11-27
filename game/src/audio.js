// Small WebAudio sounds, no assets: an engine hum that follows the throttle, a
// two-note chime for a ring, and a low thud for a crash. Everything is guarded, so
// a browser without audio just plays silent.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let started = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function note(frequency, at, duration, volume) {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  return {
    /** Call from a user gesture: starts the engine hum. */
    start() {
      if (started) return;
      started = true;
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** Follow the throttle (0..1) and whether the plane is flying. */
    engine(throttle, flying) {
      if (!context || !engineOsc || !engineGain) return;
      const target = flying ? 0.03 + throttle * 0.05 : 0.012;
      engineOsc.frequency.setTargetAtTime(48 + throttle * 66, context.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
    },
    ring() {
      if (!ensure()) return;
      const at = context.currentTime;
      note(880, at, 0.35, 0.12);
      note(1318.5, at + 0.09, 0.4, 0.1);
    },
    crash() {
      if (!ensure()) return;
      const at = context.currentTime;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, at);
      osc.frequency.exponentialRampToValueAtTime(32, at + 0.4);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.25, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.45);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(at);
      osc.stop(at + 0.5);
    },
  };
}
