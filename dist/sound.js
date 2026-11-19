// Short procedural effects keep the game self-contained on mobile.
const preferenceKey = 'motion-arcade-sound-v1';
const effects = new Set(['balloon', 'bubble', 'wrong', 'coin', 'star']);
let enabled = true;
try { enabled = localStorage.getItem(preferenceKey) !== '0'; } catch {}

let context;
let output;
let popNoise;
const sources = new Map();
const bursts = new Map();

function prepare() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return false;
  if (context && context.state !== 'closed') return true;
  context = new Audio();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 15;
  compressor.ratio.value = 6;
  compressor.attack.value = .003;
  compressor.release.value = .1;
  output = context.createGain();
  output.gain.value = .75;
  output.connect(compressor);
  compressor.connect(context.destination);
  popNoise = context.createBuffer(1, Math.ceil(context.sampleRate * .085), context.sampleRate);
  const samples = popNoise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = 2 * Math.random() - 1;
  return true;
}

async function unlock() {
  if (!enabled) return false;
  try {
    if (!prepare()) return false;
    if (context.state !== 'running') {
      // Resume and start the silent sample inside the original tap on iOS.
      const resumed = context.resume();
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, context.sampleRate);
      silent.connect(output);
      silent.onended = () => silent.disconnect();
      silent.start();
      await resumed;
    }
    return context.state === 'running';
  } catch { return false; }
}

function playSource(source, start, duration, volume, filter) {
  const gain = context.createGain();
  const end = start + duration;
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .004);
  gain.gain.exponentialRampToValueAtTime(.0001, end);
  if (filter) {
    source.connect(filter);
    filter.connect(gain);
  } else source.connect(gain);
  gain.connect(output);

  function release() {
    source.onended = null;
    source.disconnect();
    filter?.disconnect();
    gain.disconnect();
    sources.delete(source);
  }
  sources.set(source, release);
  source.onended = release;
  try {
    source.start(start);
    source.stop(end + .005);
  } catch { release(); }
}

function tone(start, duration, hz, endHz, volume, type = 'sine') {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(hz, start);
  if (endHz !== hz) oscillator.frequency.exponentialRampToValueAtTime(endHz, start + duration * .85);
  playSource(oscillator, start, duration, volume);
}

function balloon(start) {
  const snap = context.createBufferSource();
  snap.buffer = popNoise;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = .75;
  filter.frequency.setValueAtTime(2700, start);
  filter.frequency.exponentialRampToValueAtTime(560, start + .06);
  playSource(snap, start, .075, .59, filter);
  tone(start, .12, 205 + Math.random() * 26, 54, .34, 'triangle');
}

function play(name, playerId) {
  if (!enabled || context?.state !== 'running' || !effects.has(name)) return;
  // Coalesce only rapid repeats from the same player and type of contact.
  const hasPlayer = Number.isInteger(playerId) && playerId >= 0 && playerId < 4;
  const key = name + (hasPlayer ? playerId : '');
  const now = context.currentTime;
  let burst = bursts.get(key);
  if (!burst || now - burst.at >= .055) {
    burst = {at:now, count:0};
    bursts.set(key, burst);
  }
  if (burst.count >= (hasPlayer ? 2 : 4)) return;
  const start = now + .003 + .008 * burst.count++;
  try {
    switch (name) {
      case 'balloon':
        balloon(start);
        break;
      case 'bubble': {
        const pitch = .96 + Math.random() * .08;
        tone(start, .15, 580 * pitch, 1470 * pitch, .29);
        tone(start + .064, .11, 1170 * pitch, 800 * pitch, .11);
        break;
      }
      case 'wrong':
        tone(start, .12, 320, 270, .26, 'triangle');
        tone(start + .12, .18, 233, 180, .24, 'triangle');
        break;
      case 'coin':
        tone(start, .085, 1046.5, 1046.5, .23, 'triangle');
        tone(start + .065, .22, 1568, 1568, .21);
        tone(start + .065, .075, 3136, 3136, .06);
        break;
      case 'star':
        for (const [i, hz] of [659.25, 830.61, 987.77, 1318.51].entries()) {
          tone(start + i * .071, i === 3 ? .35 : .18, hz, hz, .21);
          tone(start + i * .071, .12, hz * 2, hz * 2, .065, 'triangle');
        }
        break;
    }
  } catch { /* Sound is optional on a device with interrupted audio output. */ }
}

function stop() {
  for (const [source, release] of sources) {
    try { source.stop(); } catch {}
    release();
  }
  bursts.clear();
}

export const gameAudio = {
  get enabled() { return enabled; },
  setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) stop();
    try { localStorage.setItem(preferenceKey, enabled ? '1' : '0'); } catch {}
  },
  unlock, play, stop
};
