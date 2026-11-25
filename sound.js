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

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const nurserySongs = {
  babyshark: {
    bpm: 124,
    bass: [43, 48, 40, 50],
    notes: [
      [62,.5],[64,.5],[67,.5],[67,.5],[67,.5],[67,.25],[67,.25],[67,.5],[67,.5],
      [62,.5],[64,.5],[67,.5],[67,.5],[67,.5],[67,.25],[67,.25],[67,.5],[67,.5],
      [62,.5],[64,.5],[67,.5],[67,.5],[67,.5],[67,.25],[67,.25],[67,.5],[67,.5],
      [67,.5],[67,.5],[66,1.5],[0,1.5],
      [74,.5],[76,.5],[79,.5],[79,.5],[79,.5],[79,.25],[79,.25],[79,.5],[79,.5],
      [74,.5],[76,.5],[79,.5],[79,.5],[79,.5],[79,.25],[79,.25],[79,.5],[79,.5],
      [74,.5],[76,.5],[79,.5],[79,.5],[79,.5],[79,.25],[79,.25],[79,.5],[79,.5],
      [79,.5],[79,.5],[78,1.5],[0,1.5]
    ]
  },
  twinkle: {
    bpm: 134,
    bass: [48, 45, 41, 43],
    notes: [
      [60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2],
      [65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2],
      [67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2],
      [67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2],
      [60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2],
      [65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2]
    ]
  },
  tigers: {
    bpm: 138,
    bass: [48, 48, 43, 48],
    notes: [
      [60,1],[62,1],[64,1],[60,1],[60,1],[62,1],[64,1],[60,1],
      [64,1],[65,1],[67,2],[64,1],[65,1],[67,2],
      [67,.5],[69,.5],[67,.5],[65,.5],[64,1],[60,1],
      [67,.5],[69,.5],[67,.5],[65,.5],[64,1],[60,1],
      [60,1],[55,1],[60,2],[60,1],[55,1],[60,2]
    ]
  },
  lamb: {
    bpm: 138,
    bass: [48, 43, 48, 43],
    notes: [
      [64,1],[62,1],[60,1],[62,1],[64,1],[64,1],[64,2],
      [62,1],[62,1],[62,2],[64,1],[67,1],[67,2],
      [64,1],[62,1],[60,1],[62,1],[64,1],[64,1],[64,1],[64,1],
      [62,1],[62,1],[64,1],[62,1],[60,4]
    ]
  },
  happy: {
    bpm: 144,
    bass: [48, 43, 41, 48],
    notes: [
      [55,.5],[55,.5],[60,1],[60,1],[60,1],[60,1],[60,1],[60,1],[59,1],[60,1],[62,2],[0,2],
      [55,.5],[55,.5],[62,1],[62,1],[62,1],[62,1],[62,1],[62,1],[60,1],[62,1],[64,2],[0,2],
      [64,.5],[64,.5],[65,1],[65,1],[65,1],[65,1],[65,1],[65,1],[64,1],[62,1],[60,2],[0,2]
    ]
  }
};
const songOrder = Object.keys(nurserySongs);
let bgmTimer = 0;
let bgmPreviewStop = 0;
let bgmMode = 'auto';
let bgmSongIndex = 0;
let bgmNoteIndex = 0;
let bgmNextTime = 0;
let bgmDrumTime = 0;
let bgmDrumStep = 0;

function playKick(start) {
  tone(start, 0.11, 145, 42, 0.30, 'sine');
}

function playClap(start) {
  const snap = context.createBufferSource();
  snap.buffer = popNoise;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1700, start);
  filter.Q.value = 1.1;
  playSource(snap, start, 0.08, 0.22, filter);
}

function playHat(start) {
  const snap = context.createBufferSource();
  snap.buffer = popNoise;
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(6800, start);
  playSource(snap, start, 0.032, 0.09, filter);
}

function playSynthLead(start, duration, midi) {
  if (!midi) return;
  const hz = midiHz(midi);
  const len = Math.min(duration * 0.80, 0.42);
  const osc = context.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(hz, start);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, start);
  filter.frequency.exponentialRampToValueAtTime(950, start + len);
  playSource(osc, start, len, 0.14, filter);
  tone(start, len, hz, hz, 0.16, 'triangle');
  tone(start, Math.min(len * 0.7, 0.22), hz * 2, hz * 2, 0.045, 'sine');
}

function playBassPulse(start, stepDuration, song, step) {
  const bar = Math.floor(step / 8);
  const root = song.bass[bar % song.bass.length];
  const octave = step % 2 === 1 ? 12 : 0;
  tone(start, stepDuration * 0.85, midiHz(root + octave), midiHz(root + octave), step % 2 === 0 ? 0.15 : 0.09, 'triangle');
}

function scheduleBgm() {
  if (!enabled || !bgmTimer || !context) return;
  if (context.state !== 'running') {
    context.resume().catch(() => {});
    return;
  }
  const now = context.currentTime;
  if (bgmNextTime < now) bgmNextTime = now + 0.04;
  if (bgmDrumTime < now) bgmDrumTime = now + 0.04;
  const horizon = now + 0.32;
  const key = bgmMode === 'auto' ? songOrder[bgmSongIndex % songOrder.length] : bgmMode;
  const song = nurserySongs[key] || nurserySongs.babyshark;
  const beatSec = 60 / song.bpm;
  const eighthSec = beatSec * 0.5;

  while (bgmDrumTime < horizon) {
    const step = bgmDrumStep % 8;
    if (step % 2 === 0) playKick(bgmDrumTime);
    if (step === 2 || step === 6) playClap(bgmDrumTime);
    if (step % 2 === 1) playHat(bgmDrumTime);
    playBassPulse(bgmDrumTime, eighthSec, song, bgmDrumStep);
    bgmDrumTime += eighthSec;
    bgmDrumStep++;
  }

  while (bgmNextTime < horizon) {
    const activeKey = bgmMode === 'auto' ? songOrder[bgmSongIndex % songOrder.length] : bgmMode;
    const activeSong = nurserySongs[activeKey] || nurserySongs.babyshark;
    const [midi, beats] = activeSong.notes[bgmNoteIndex];
    const sec = beats * (60 / activeSong.bpm);
    playSynthLead(bgmNextTime, sec, midi);
    bgmNextTime += sec;
    bgmNoteIndex++;
    if (bgmNoteIndex >= activeSong.notes.length) {
      bgmNoteIndex = 0;
      if (bgmMode === 'auto') bgmSongIndex = (bgmSongIndex + 1) % songOrder.length;
    }
  }
}

function startBgm(choice = 'auto') {
  stopBgm();
  if (!enabled || choice === 'off') return;
  if (!prepare()) return;
  if (context.state !== 'running') unlock();
  bgmMode = nurserySongs[choice] ? choice : 'auto';
  bgmNoteIndex = 0;
  bgmDrumStep = 0;
  bgmNextTime = context.currentTime + 0.06;
  bgmDrumTime = bgmNextTime;
  bgmTimer = setInterval(scheduleBgm, 90);
  scheduleBgm();
}

async function previewBgm(choice = 'auto') {
  stop();
  if (!enabled || choice === 'off') return;
  await unlock();
  startBgm(choice);
  bgmPreviewStop = setTimeout(() => stop(), 3200);
}

function stopBgm() {
  if (bgmPreviewStop) {
    clearTimeout(bgmPreviewStop);
    bgmPreviewStop = 0;
  }
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = 0;
  }
}

function stop() {
  stopBgm();
  for (const [source, release] of sources) {
    try { source.stop(); } catch {}
    release();
  }
  bursts.clear();
}

function wakeAudio() {
  if (enabled && bgmTimer && context && context.state !== 'running') {
    unlock().then(() => { if (bgmTimer) scheduleBgm(); });
  }
}
window.addEventListener('pointerdown', wakeAudio, {passive: true});
window.addEventListener('keydown', wakeAudio, {passive: true});

export const gameAudio = {
  get enabled() { return enabled; },
  setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) stop();
    try { localStorage.setItem(preferenceKey, enabled ? '1' : '0'); } catch {}
  },
  unlock, play, stop, startBgm, stopBgm, previewBgm
};
