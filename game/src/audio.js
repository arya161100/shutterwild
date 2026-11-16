// All sound is synthesised with WebAudio — no audio files, no network. A shutter click
// (filtered noise burst plus a low thock), a little chime arpeggio for a good shot, a
// rising phrase for a perfect one, soft bird chirps that drift in from the valley, and a
// low wind bed underneath it all. Nothing plays until the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let wind = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startWind();
      return true;
    } catch {
      return false;
    }
  }

  function startWind() {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    wind = ctx.createGain();
    wind.gain.value = 0.05;
    source.connect(filter);
    filter.connect(wind);
    wind.connect(master);
    source.start();
  }

  function tone(freq, start, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noise(start, dur, vol, freq) {
    if (!ctx || muted) return;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call from any user gesture; safe to call often. */
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shutter() {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      noise(t, 0.07, 0.5, 3200);
      tone(180, t, 0.09, 'sine', 0.35, 90);
    },
    chime(grade) {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      const notes = grade === 'perfect' ? [523.25, 659.25, 783.99, 1046.5]
        : grade === 'great' ? [523.25, 659.25, 783.99]
        : [440, 554.37];
      notes.forEach((f, i) => tone(f, t + i * 0.09, 0.5, 'triangle', 0.22));
    },
    targetDone() {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      [392, 523.25, 659.25].forEach((f, i) => tone(f, t + i * 0.07, 0.4, 'sine', 0.2));
    },
    dayDone() {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.11, 0.7, 'triangle', 0.2));
    },
    fail() {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      tone(330, t, 0.4, 'sine', 0.2, 220);
      tone(220, t + 0.15, 0.5, 'sine', 0.18, 165);
    },
    /** A short bird chirp from somewhere in the valley. */
    chirp() {
      if (!ctx || muted || Math.random() > 0.5) return;
      const t = ctx.currentTime;
      const base = 2200 + Math.random() * 1400;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i += 1) {
        tone(base + Math.random() * 400, t + i * 0.09, 0.08, 'sine', 0.05, base * 1.2);
      }
    },
  };
}
