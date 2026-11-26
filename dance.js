import {drawDancer} from './dancers.js';
import {panel} from './canvas-shapes.js';
import {dynamicMoves, sampleDanceMove, drawDanceMotionCue} from './dance-moves.js';
import {createDanceMotionTracker} from './dance-motion.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const colors = ['#c6fa69', '#74d8ff', '#ff9dc6', '#ffcc72'];
const poses = [
  { name: '双手举高', two: '双手向上，靠近头顶', hands: [[-.38, -1.02], [.38, -1.02]] },
  { name: '左手冲天', two: '举高左手，右手放低', hands: [[-.64, -1], [.56, .23]] },
  { name: '右手冲天', two: '举高右手，左手放低', hands: [[-.56, .23], [.64, -1]] },
  { name: '双臂平展', two: '双手向两侧伸到肩高', hands: [[-1, -.39], [1, -.39]] },
  { name: '胸前合掌', two: '双手在胸前靠拢', hands: [[-.04, -.17], [.04, -.17]] },
  { name: '双手垂下', two: '双臂放松，双手垂到髋旁', hands: [[-.46, .42], [.46, .42]] },
  { name: '双臂交叉', two: '在胸前交叉双臂', hands: [[.34, -.17], [-.34, -.17]] },
  { name: '左侧伸展', two: '左手侧平举，右手放低', four: '左手侧平举，同时抬起左脚', hands: [[-1, -.39], [.52, .3]], feet: [[-.64, .39], [.38, .95]] },
  { name: '右侧伸展', two: '右手侧平举，左手放低', four: '右手侧平举，同时抬起右脚', hands: [[-.52, .3], [1, -.39]], feet: [[-.38, .95], [.64, .39]] },
  { name: '星形打开', two: '双臂斜向上，打开成 V 形', four: '双臂斜上打开，双脚分开站', hands: [[-.98, -.89], [.98, -.89]], feet: [[-.78, .89], [.78, .89]] },
  ...dynamicMoves
];

const prefsKey = 'motion-party.dance.v1';
const defaults = { bpm: 112, beats: 4, offset: 0, steps: [0, 10, 14, 11, 15, 3, 12, 16, 17, 13, 7, 8, 4, 9] };
let settings = loadSettings();
let song = null;
let library;
let ready;
let songChange = 0;
let mediaLoading = false;
let editor = null;
let context;
let decoded = null;
let game = null;
let generation = 0;

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(prefsKey));
    if (data && Array.isArray(data.steps)) {
      const steps = data.steps.filter(id => Number.isInteger(id) && poses[id]).slice(0, 128);
      if (steps.length) return {
        bpm: clamp(Number(data.bpm) || 112, 40, 240),
        beats: [2, 4, 8].includes(data.beats) ? data.beats : 4,
        offset: clamp(Number(data.offset) || 0, 0, 60),
        steps
      };
    }
  } catch { /* Browser storage may be disabled. */ }
  return { ...defaults, steps: [...defaults.steps] };
}

function saveSettings() {
  try { localStorage.setItem(prefsKey, JSON.stringify(settings)); }
  catch { editor?.notify('此浏览器只会在本次打开时保留舞步。'); }
}

function database() {
  if (!library) library = new Promise((resolve, reject) => {
    const req = indexedDB.open('motion-party-dance', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('music');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return library;
}

async function useSongStore(mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const txn = db.transaction('music', mode);
    const req = action(txn.objectStore('music'));
    txn.oncomplete = () => resolve(req.result);
    txn.onabort = txn.onerror = () => reject(txn.error || Error('歌曲存储不可用'));
  });
}

function restoreSong() {
  if (!ready) {
    const revision = songChange;
    ready = useSongStore('readonly', store => store.get('selected')).then(item => {
      if (revision === songChange && item?.file instanceof Blob) {
        song = item;
        editor?.refreshSong();
      }
    }).catch(() => {});
  }
  return ready;
}

function formatTime(sec) {
  return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
}

function shuffled(size) {
  const list = [];
  while (list.length < size) {
    const batch = poses.map((_, i) => i);
    for (let i = batch.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [batch[i], batch[j]] = [batch[j], batch[i]];
    }
    if (list.length && batch[0] === list[list.length - 1]) [batch[0], batch[1]] = [batch[1], batch[0]];
    list.push(...batch);
  }
  return list.slice(0, size);
}

function probeFile(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => finish(false), 16000);
    function finish(ok) {
      clearTimeout(timer);
      const duration = audio.duration;
      audio.onloadedmetadata = audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      if (ok && Number.isFinite(duration) && duration > .15) resolve(duration);
      else reject(Error('读不到音频，请试试 MP3、M4A 或 WAV。'));
    }
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(true);
    audio.onerror = () => finish(false);
    audio.src = url;
  });
}

export function mountDanceEditor(container) {
  editor?.unmount();
  container.classList.add('dance-editor');
  container.innerHTML = '<section class="de-audio"><div class="de-heading"><h3>舞曲</h3><span class="de-song"></span></div>' +
    '<div class="de-source"><label class="de-upload">选择本机歌曲<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac"></label>' +
    '<button class="de-default" type="button">用内置节拍</button></div><audio class="de-preview" controls preload="none" hidden></audio>' +
    '<p class="de-notice" role="status"></p></section>' +
    '<div class="de-timing"><label>速度（BPM）<input class="de-bpm" type="number" min="40" max="240" inputmode="numeric"></label>' +
    '<label>每步拍数<select class="de-beats"><option value="2">2 拍</option><option value="4">4 拍</option><option value="8">8 拍</option></select></label>' +
    '<label>前奏（秒）<input class="de-offset" type="number" min="0" max="60" step="0.1" inputmode="decimal"></label></div>' +
    '<div class="de-heading"><h3>舞步编排</h3><button type="button" class="de-random">随机排列</button></div>' +
    '<p class="de-hint">选择一步，再点动作替换。歌曲较长时会循环舞步。</p>' +
    '<div class="de-steps" role="group" aria-label="舞步次序"></div>' +
    '<div class="de-arrange"><button type="button" data-edit="before">前移</button><button type="button" data-edit="after">后移</button>' +
    '<button type="button" data-edit="add">添加一步</button><button type="button" data-edit="remove">删除</button></div>' +
    '<div class="de-bank" role="group" aria-label="替换选中动作"></div>';
  const $ = sel => container.querySelector(sel);
  const songLabel = $('.de-song'), defaultBtn = $('.de-default'), preview = $('.de-preview');
  const input = $('input[type=file]'), notice = $('.de-notice'), steps = $('.de-steps'), bank = $('.de-bank');
  const bpm = $('.de-bpm'), beats = $('.de-beats'), offset = $('.de-offset');
  const listeners = [];
  let selected = 0, previewUrl = '';
  function listen(el, type, fn) {
    el.addEventListener(type, fn);
    listeners.push(() => el.removeEventListener(type, fn));
  }
  function notify(msg) { notice.textContent = msg; }
  function refreshSong() {
    songLabel.textContent = song ? song.name + ' · ' + formatTime(song.duration) : '内置电子节拍';
    defaultBtn.hidden = !song;
    preview.pause();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = song ? URL.createObjectURL(song.file) : '';
    if (song) preview.src = previewUrl;
    else preview.removeAttribute('src');
    preview.hidden = !song;
  }
  function refreshSteps() {
    steps.replaceChildren(...settings.steps.map((id, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.index = i;
      button.setAttribute('aria-pressed', String(i === selected));
      button.textContent = (i + 1) + ' · ' + poses[id].name;
      return button;
    }));
    bank.querySelectorAll('[data-pose]').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.pose) === settings.steps[selected]));
    });
    $('[data-edit=before]').disabled = selected === 0;
    $('[data-edit=after]').disabled = selected === settings.steps.length - 1;
    $('[data-edit=remove]').disabled = settings.steps.length <= 1;
    $('[data-edit=add]').disabled = settings.steps.length >= 128;
  }
  for (const dynamic of [true, false]) {
    const heading = document.createElement('h4');
    heading.textContent = dynamic ? '动态动作' : '定点动作';
    bank.append(heading);
    poses.forEach((pose, i) => {
      if (Boolean(pose.key) !== dynamic) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.pose = i;
      b.textContent = pose.name;
      bank.append(b);
    });
  }
  bpm.value = settings.bpm;
  beats.value = settings.beats;
  offset.value = settings.offset;
  listen(bpm, 'change', () => {
    settings.bpm = clamp(Math.round(Number(bpm.value) || 112), 40, 240);
    bpm.value = settings.bpm;
    saveSettings();
  });
  listen(beats, 'change', () => { settings.beats = Number(beats.value); saveSettings(); });
  listen(offset, 'change', () => {
    settings.offset = clamp(Number(offset.value) || 0, 0, 60);
    offset.value = settings.offset;
    saveSettings();
  });
  listen(steps, 'click', e => {
    const target = e.target.closest('[data-index]');
    if (target) {
      selected = Number(target.dataset.index);
      refreshSteps();
      steps.children[selected].focus({preventScroll: true});
    }
  });
  listen(bank, 'click', e => {
    const target = e.target.closest('[data-pose]');
    if (target) {
      settings.steps[selected] = Number(target.dataset.pose);
      refreshSteps();
      saveSettings();
    }
  });
  listen($('.de-random'), 'click', () => {
    settings.steps = shuffled(settings.steps.length);
    selected = 0;
    refreshSteps();
    saveSettings();
  });
  listen($('.de-arrange'), 'click', e => {
    const action = e.target.closest('[data-edit]')?.dataset.edit;
    if (!action) return;
    const list = settings.steps;
    if (action === 'add' && list.length < 128) list.splice(++selected, 0, list[selected - 1]);
    else if (action === 'remove' && list.length > 1) { list.splice(selected, 1); selected = Math.min(selected, list.length - 1); }
    else if (action === 'before' || action === 'after') {
      const next = clamp(selected + (action === 'before' ? -1 : 1), 0, list.length - 1);
      [list[selected], list[next]] = [list[next], list[selected]];
      selected = next;
    }
    refreshSteps();
    saveSettings();
  });
  listen(input, 'change', async () => {
    const file = input.files[0];
    if (!file) return;
    const rev = ++songChange;
    mediaLoading = true;
    notify('正在读取音频…');
    input.value = '';
    try {
      const duration = await probeFile(file);
      if (rev !== songChange) return;
      song = {file, name: file.name, duration};
      decoded = null;
      refreshSong();
      notify('歌曲已就绪。');
      try { await useSongStore('readwrite', store => store.put(song, 'selected')); }
      catch { if (rev === songChange) notify('歌曲已载入本次游戏。浏览器空间不足或限制了本机保存。'); }
    } catch (err) { if (rev === songChange) notify(err.message); }
    finally { if (rev === songChange) mediaLoading = false; }
  });
  listen(defaultBtn, 'click', async () => {
    const revision = ++songChange;
    mediaLoading = false;
    song = decoded = null;
    refreshSong();
    notify('');
    try { await useSongStore('readwrite', store => store.delete('selected')); }
    catch { if (revision === songChange) notify('本次游戏已切换到内置节拍。'); }
  });
  function unmount() {
    listeners.forEach(remove => remove());
    preview.pause();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    container.replaceChildren();
    editor = null;
  }
  editor = {refreshSong, unmount, notify, stopPreview: () => preview.pause()};
  refreshSong();
  refreshSteps();
  restoreSong();
  return unmount;
}

function matchesPose(id, player, points) {
  const l = player.leftHand, r = player.rightHand;
  if (!l || !r || l.score < .35 || r.score < .35) return false;
  const ls = player.leftShoulder, rs = player.rightShoulder;
  const lh = player.leftHip, rh = player.rightHip;
  if (![ls, rs, lh, rh].every(p => p && p.score >= .25)) return false;
  const shoulderX = (ls.x + rs.x) / 2, shoulderY = (ls.y + rs.y) / 2;
  const width = Math.max(.018, Math.abs(ls.x - rs.x)), height = Math.max(.035, (lh.y + rh.y) / 2 - shoulderY);
  const sign = ls.x >= rs.x ? 1 : -1;
  const lx = sign * (l.x - shoulderX) / width, rx = sign * (r.x - shoulderX) / width;
  const ly = (l.y - shoulderY) / height, ry = (r.y - shoulderY) / height;
  const lHigh = ly < -.31, rHigh = ry < -.31;
  const lSide = Math.abs(ly) < .42 && lx > .86, rSide = Math.abs(ry) < .42 && rx < -.86;
  const lf = player.leftFoot, rf = player.rightFoot;
  const feet = lf && rf && lf.score >= .35 && rf.score >= .35;
  switch (id) {
    case 0: return lHigh && rHigh && lx < 1.18 && rx > -1.18;
    case 1: return lHigh && ry > .12;
    case 2: return rHigh && ly > .12;
    case 3: return lSide && rSide;
    case 4: return Math.abs(lx - rx) < .38 && Math.abs(ly - ry) < .32 && Math.abs(lx + rx) < .86 && ly > -.22 && ly < .87;
    case 5: return ly > .74 && ry > .74;
    case 6: return lx < -.04 && rx > .04 && ly > -.25 && ry > -.25 && ly < .86 && ry < .86;
    case 7: return lSide && ry > .3 && (points === 2 || (feet && rf.y - lf.y > .22 * height));
    case 8: return rSide && ly > .3 && (points === 2 || (feet && lf.y - rf.y > .22 * height));
    case 9: return lHigh && rHigh && lx > .9 && rx < -.9 && (points === 2 || (feet && Math.abs(lf.x - rf.x) > 1.05 * width));
    default: return false;
  }
}

function unlockAudio() {
  try {
    if (!context || context.state === 'closed') {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return Promise.resolve(false);
      context = new Audio();
    }
    if (context.state === 'running') return Promise.resolve(true);
    return context.resume().then(() => context.state === 'running').catch(() => false);
  } catch { return Promise.resolve(false); }
}

async function ensureAudio() {
  let timer;
  try {
    const live = await Promise.race([unlockAudio(), new Promise(resolve => {timer = setTimeout(() => resolve(false), 3500);})]);
    if (!live) throw Error('请点一下开始按钮，开启舞曲声音。');
  } finally { clearTimeout(timer); }
}

function stopSource(source) {
  if (!source) return;
  try { source.stop(); } catch {}
  source.disconnect();
}

function attachMusic(g) {
  if (!g.buffer || g.elapsed >= g.buffer.duration) return;
  const source = context.createBufferSource();
  source.buffer = g.buffer;
  source.connect(g.master);
  source.start(0, g.elapsed);
  g.source = source;
}

function stop() {
  ++generation;
  if (!game) return;
  stopSource(game.source);
  game.master?.disconnect();
  game = null;
}

async function start(options = {}) {
  stop();
  const rev = generation;
  editor?.stopPreview();
  if (mediaLoading) throw Error('歌曲正在读取，请稍后再开始。');
  const audible = options.soundEnabled !== false;
  await Promise.all([audible ? ensureAudio() : undefined, restoreSong()]);
  if (generation !== rev) return;
  const selected = song;
  let buffer = null;
  if (selected && audible) {
    if (decoded?.song === selected) buffer = decoded.buffer;
    else {
      try {
        const bytes = await selected.file.arrayBuffer();
        // The callback API also works in older mobile WebKit.
        buffer = await new Promise((resolve, reject) => context.decodeAudioData(bytes, resolve, reject));
      } catch { throw Error('此浏览器无法解码这首歌。请选择 MP3 或 M4A，或切换到内置节拍。'); }
      if (generation !== rev) return;
      if (song === selected) decoded = {song: selected, buffer};
    }
  }
  const count = clamp(Number(options.players) || 1, 1, 4);
  const beat = 60 / settings.bpm, interval = beat * settings.beats, offset = settings.offset;
  const firstCue = offset + interval;
  const songDuration = buffer?.duration ?? selected?.duration;
  if (selected && !(songDuration >= firstCue)) throw Error('歌曲太短，无法容纳第一步。请缩短前奏、减少每步拍数或换歌。');
  const cueCount = selected ? Math.max(1, 1 + Math.floor((songDuration - firstCue) / interval)) : settings.steps.length;
  const master = audible ? context.createGain() : null;
  if (master) master.connect(context.destination);
  const clock = audible ? () => context.currentTime : () => performance.now() / 1000;
  game = {
    master, buffer, clock, hasSong: Boolean(selected), source: null, beat, interval, firstCue, cueCount, offset,
    duration: songDuration ?? firstCue + (cueCount - 1) * interval + Math.min(.6, beat),
    steps: [...settings.steps], points: Number(options.points) === 4 ? 4 : 2,
    motion: settings.steps.some(id => poses[id].key) ? createDanceMotionTracker() : null,
    elapsed: 0, origin: clock(), paused: false, index: 0, nextBeat: 0,
    scores: Array(count).fill(0), hits: Array(count).fill(false), feedback: Array(count).fill(''),
    acknowledged: Array(count).fill(false), feedbackAt: Array(count).fill(-9),
    onFinish: options.onFinish
  };
  attachMusic(game);
}

function beatSound(g, at, n) {
  function tone(hz, endHz, vol, decay, type) {
    const osc = context.createOscillator(), envelope = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, at);
    osc.frequency.exponentialRampToValueAtTime(endHz, at + decay);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(vol, at + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + decay);
    osc.connect(envelope);
    envelope.connect(g.master);
    osc.start(at);
    osc.stop(at + decay + .01);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  tone(n % 4 === 0 ? 155 : 110, 45, n % 4 === 0 ? .48 : .31, .19, 'sine');
  const bass = [220, 261.63, 293.66, 196][Math.floor(n / 4) % 4] * (n % 2 ? 2 : 1);
  tone(bass, bass, n % 2 ? .074 : .105, .23, 'triangle');
}

function tickTime(g) { return g.paused ? g.elapsed : Math.min(g.duration, Math.max(0, g.clock() - g.origin)); }
function cueTime(g) { return g.firstCue + g.index * g.interval; }
function hit(g, id, err) {
  if (g.hits[id] || id < 0 || id >= g.scores.length || g.index >= g.cueCount) return;
  g.hits[id] = true;
  const perfect = Math.abs(err) <= Math.min(.24, g.interval * .22);
  g.scores[id] += perfect ? 100 : 70;
  g.feedback[id] = perfect ? '精准 +100' : '合拍 +70';
  g.feedbackAt[id] = tickTime(g);
}
function update(frame) {
  const g = game;
  if (!g || g.paused) return;
  const t = tickTime(g);
  const players = frame.players || [];
  g.motion?.update(players, t);
  if (g.master && !g.buffer) {
    const currentBeat = Math.floor(t / g.beat);
    g.nextBeat = Math.max(g.nextBeat, currentBeat);
    while (g.nextBeat * g.beat <= t + .1 && g.nextBeat * g.beat < g.duration) {
      beatSound(g, Math.max(context.currentTime + .004, g.origin + g.nextBeat * g.beat), g.nextBeat++);
    }
  }
  const halfWindow = Math.min(.48, g.interval * .36);
  while (g.index < g.cueCount && t > cueTime(g) + halfWindow) {
    g.hits.forEach((done, id) => {
      if (!done) {
        g.feedback[id] = '未跟上';
        g.feedbackAt[id] = t;
      }
    });
    g.hits.fill(false);
    g.acknowledged.fill(false);
    ++g.index;
  }
  if (g.index < g.cueCount) {
    const target = cueTime(g), err = t - target, pose = g.steps[g.index % g.steps.length];
    if (Math.abs(err) <= halfWindow) {
      for (const player of players) {
        if (g.hits[player.id]) continue;
        const key = poses[pose].key;
        if (key) {
          // Let an early stroke reach its endpoint before grading its timing.
          if (err < 0) continue;
          const at = g.motion.matchTime(player.id, key, target, halfWindow);
          if (at != null) hit(g, player.id, at - target);
          continue;
        }
        if (!matchesPose(pose, player, g.points)) continue;
        // A held pose scores at the beat; later arrivals score when first matched.
        g.acknowledged[player.id] = true;
        if (err >= -.055) hit(g, player.id, err);
      }
      if (err >= 0) g.acknowledged.forEach((seen, id) => {
        if (seen && !g.hits[id]) hit(g, id, -halfWindow);
      });
    }
  }
  if (t >= g.duration) {
    const callback = g.onFinish, scores = [...g.scores];
    stop();
    callback?.(scores);
  }
}

function action(playerId, actionName) {
  const g = game;
  if (!g || g.paused || actionName !== 'hit') return;
  const err = tickTime(g) - cueTime(g);
  if (Math.abs(err) <= Math.min(.48, g.interval * .36)) hit(g, playerId, err);
}

function pause() {
  if (!game || game.paused) return;
  game.motion?.reset();
  game.elapsed = tickTime(game);
  game.paused = true;
  stopSource(game.source);
  game.source = null;
  if (game.master) game.master.gain.value = 0;
}

async function resume() {
  const g = game;
  if (!g || !g.paused) return;
  if (g.master) await ensureAudio();
  if (game !== g || !g.paused) return;
  g.paused = false;
  g.origin = g.clock() - g.elapsed;
  if (g.master) g.master.gain.value = 1;
  g.nextBeat = Math.ceil(g.elapsed / g.beat);
  attachMusic(g);
}

function text(ctx, value, x, y, size, color, align = 'center', weight = 650, maxWidth) {
  ctx.font = weight + ' ' + size + 'px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (maxWidth) ctx.fillText(value, x, y, maxWidth);
  else ctx.fillText(value, x, y);
}

const restingFeet = [[-.32, .95], [.32, .95]];

function sampleStep(g, index, t) {
  const pose = poses[g.steps[index % g.steps.length]];
  if (!pose.key) {
    return {hands:pose.hands, feet:g.points === 4 && pose.feet ? pose.feet : restingFeet, lift:0, squash:1};
  }
  // Rehearse on two-beat phrases. The final sweep, pump or jump lands on the scoring beat.
  const period = Math.min(g.interval, 2 * g.beat);
  const duration = Math.min(1.12, period * .86);
  const untilBeat = g.firstCue + index * g.interval - t;
  const elapsed = .75 * duration - untilBeat;
  const local = untilBeat > 0 ? ((elapsed % period) + period) % period : elapsed;
  const progress = clamp(local / duration, 0, 1);
  return {...sampleDanceMove(pose.key, progress), key:pose.key, progress};
}

function dancerPose(g, t) {
  const index = Math.min(g.index, g.cueCount - 1);
  const current = sampleStep(g, index, t);
  // The guide changes moves as soon as the previous scoring window closes.
  const windowEnd = g.firstCue + (index - 1) * g.interval + Math.min(.48, g.interval * .36);
  const fraction = clamp((t - windowEnd) / Math.min(.25, g.beat * .48), 0, 1);
  if (!index || fraction >= 1) return current;

  const previous = sampleStep(g, index - 1, windowEnd);
  const mix = fraction * fraction * (3 - 2 * fraction);
  function blend(from, to) {
    return from.map(([x, y], i) => [x + (to[i][0] - x) * mix, y + (to[i][1] - y) * mix]);
  }
  return {...current, hands:blend(previous.hands, current.hands), feet:blend(previous.feet, current.feet),
    lift:previous.lift + (current.lift - previous.lift) * mix,
    squash:previous.squash + (current.squash - previous.squash) * mix};
}

function drawCast(ctx, g, t, area) {
  const count = g.scores.length;
  const labelSize = clamp(area.h * .053, 10, 15);
  const labelSpace = count > 1 ? labelSize * 1.7 : 0;
  const grid = columns => {
    const rows = Math.ceil(count / columns);
    const cellH = area.h / rows;
    // Leave room for the widest arm span, head bounce, shoes and player label.
    return {columns, cellH, size: Math.min(area.w / columns / 2.08, (cellH - labelSpace) / 2.12)};
  };
  // Duets stay side by side. Larger casts wrap when it gives them more room.
  let layout = grid(count);
  if (count > 2) {
    const paired = grid(2);
    if (paired.size > layout.size) layout = paired;
  }
  const {columns, cellH, size} = layout;
  const spacing = Math.min(area.w / columns, size * 2.98);
  const pose = dancerPose(g, t);
  const beatPosition = (t - (g.hasSong ? g.offset : 0)) / g.beat;

  for (let player = 0; player < count; player++) {
    const row = Math.floor(player / columns);
    const rowCount = Math.min(columns, count - row * columns);
    const x = area.x + area.w / 2 + (player % columns - (rowCount - 1) / 2) * spacing;
    const y = area.y + (row + .5) * cellH - labelSpace / 2 + .045 * size;
    const accent = colors[player];
    drawDancer(ctx, {x, y, size, player, accent, ...pose, beatPosition, points: g.points});
    if (pose.key) drawDanceMotionCue(ctx, {key:pose.key, progress:pose.progress, x, y, size, accent});
    if (count > 1) {
      const labelY = y + 1.15 * size + labelSpace / 2;
      ctx.fillStyle = '#30223f';
      ctx.beginPath();
      ctx.ellipse(x, labelY, labelSize * 1.4, labelSize * .76, 0, 0, 2 * Math.PI);
      ctx.fill();
      text(ctx, 'P' + (player + 1), x, labelY, labelSize, accent, 'center', 800);
    }
  }
}

const ink = '#f7effe', dim = '#cabbd8', pink = '#ffafd9', lime = '#c6fa69';

function drawStudioCue(ctx, g, t, w, h, pad, pose, step, hint, next) {
  const landscape = w > h * 1.28;
  const split = landscape && g.scores.length === 1;
  const band = landscape && !split;
  const stageTop = h * (split ? .045 : band ? .215 : .208);
  const stageBottom = h * (landscape ? .775 : .657);
  const area = {x: pad, y: stageTop, w: (split ? w * .565 : w) - 2 * pad, h: stageBottom - stageTop};
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#271d42');
  bg.addColorStop(.57, '#553462');
  bg.addColorStop(1, '#271b3b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const dancerX = area.x + area.w / 2, dancerY = area.y + area.h / 2;
  const size = Math.min(landscape ? w * .162 : w * .29, h * (landscape ? .29 : .199));
  const light = ctx.createRadialGradient(dancerX, dancerY, 1, dancerX, dancerY, size * 1.75);
  light.addColorStop(0, 'rgba(237,153,241,.30)');
  light.addColorStop(1, 'rgba(237,153,241,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(230,201,255,.11)';
  [1.16, 1.29, 1.42].forEach(radius => {
    ctx.beginPath();
    ctx.arc(dancerX, dancerY, size * radius, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
  });
  const horizon = dancerY + size * .83, vanish = dancerX;
  ctx.beginPath();
  for (let i = -10; i <= 10; i++) {
    ctx.moveTo(vanish + i * size * .085, horizon);
    ctx.lineTo(vanish + i * size * .81, h);
  }
  for (const frac of [0, .08, .22, .43, .73]) {
    const y = horizon + (h - horizon) * frac;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  drawCast(ctx, g, t, area);

  const headingX = split ? w * .59 : band ? pad : w / 2;
  const headingY = h * (split ? .305 : band ? .145 : .153), align = landscape ? 'left' : 'center';
  const titleSize = Math.max(17, Math.min(w * (landscape ? .053 : .084), h * (split ? .119 : band ? .083 : .065), 47));
  const cap = Math.max(11, Math.min(15, w * .032, h * .056));
  text(ctx, step, headingX, headingY - titleSize * .97, cap, lime, align);
  text(ctx, pose.name, headingX, headingY, titleSize, ink, align, 800);
  const hintX = band ? w * .46 : headingX;
  const hintY = split ? headingY + titleSize * 1.07 : band ? h * .075 : h * .69;
  const hintWidth = landscape ? w - hintX - pad : w - 2 * pad;
  text(ctx, hint, hintX, hintY, Math.max(11, Math.min(18, w * .037, h * .06)), ink, align, 650, hintWidth);
  if (next) text(ctx, next, hintX, hintY + cap * 1.7, cap, dim, align);
}

function drawCameraCue(ctx, g, t, w, h, pose, step, hint, next) {
  // Prominent dancer guide panel on the right, compact instruction card on the left.
  const count = g.scores.length, inset = clamp(Math.min(w, h) * .022, 6, 16);
  const guideH = clamp(h * .44, 150, 300);
  const guideW = clamp(w * (count > 1 ? .46 : .34), 130, 340);
  const guideX = w - inset - guideW, guideY = inset;
  const textW = Math.min(guideX - inset * 2, 270);
  const textH = clamp(h * .21, 78, 126);
  const x = inset, y = inset, textX = x + 12;
  ctx.lineWidth = 1.2;
  if (textW > 90) {
    panel(ctx, x, y, textW, textH, 14, 'rgba(38,26,52,.82)', '#eed6ff70');
    const small = clamp(textH * .135, 11, 15);
    text(ctx, step, textX, y + textH * .15, small, lime, 'left', 700, textW - 20);
    text(ctx, pose.name, textX, y + textH * .38, clamp(textH * .24, 18, 27), ink, 'left', 800, textW - 20);
    const lines = hint.split('，');
    lines.forEach((line, i) => {
      text(ctx, line, textX, y + textH * (.60 + i * .145), small, ink, 'left', 650, textW - 20);
    });
    if (next) text(ctx, next, textX, y + textH * .90, small, dim, 'left', 650, textW - 20);
  }
  panel(ctx, guideX, guideY, guideW, guideH, 16, 'rgba(38,26,52,.58)', '#eed6ff66');
  drawCast(ctx, g, t, {x: guideX + 4, y: guideY + 6, w: guideW - 8, h: guideH - 12});
}

function draw(ctx, {w, h, cameraVisible}) {
  const g = game;
  if (!g || !w || !h) return;
  const t = tickTime(g), progress = t / g.duration, phase = (t / g.beat) % 1, glow = (1 - phase) ** 3;
  const pad = Math.max(10, Math.min(w * .05, 34));
  const pose = poses[g.steps[Math.min(g.index, g.cueCount - 1) % g.steps.length]];
  const hint = g.points === 4 && pose.four ? pose.four : pose.two;
  const end = g.index >= g.cueCount, step = end ? '完成编舞' : '第 ' + (g.index + 1) + ' / ' + g.cueCount + ' 步';
  const next = g.index + 1 < g.cueCount ? '下一步  ' + poses[g.steps[(g.index + 1) % g.steps.length]].name : '';
  const footer = clamp(h * .14, 37, 68);
  ctx.save();
  if (cameraVisible) {
    drawCameraCue(ctx, g, t, w, h, pose, step, hint, next);
    panel(ctx, pad / 2, h - footer, w - pad, footer - 6, 12, 'rgba(38,26,52,.85)');
  } else {
    drawStudioCue(ctx, g, t, w, h, pad, pose, step, hint, next);
  }

  // The moving note reaches the fixed target on the scoring beat.
  const x1 = pad, x2 = w - pad, laneY = cameraVisible ? h - footer * .69 : h * .826;
  const targetX = x1 + (x2 - x1) * .18;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9875a2';
  ctx.beginPath(); ctx.moveTo(x1, laneY); ctx.lineTo(x2, laneY); ctx.stroke();
  const noteR = cameraVisible ? footer * .115 : Math.min(11, h * .032);
  ctx.beginPath(); ctx.arc(targetX, laneY, noteR + 3 + 2 * glow, 0, 2 * Math.PI);
  ctx.strokeStyle = lime; ctx.lineWidth = 3; ctx.stroke();
  if (!end) {
    for (let i = 0; i < 3 && i + g.index < g.cueCount; i++) {
      const delta = cueTime(g) + i * g.interval - t;
      const x = targetX + delta / g.interval * (x2 - targetX) * .77;
      if (x < x1 || x > x2) continue;
      ctx.beginPath(); ctx.arc(x, laneY, noteR * .75, 0, 2 * Math.PI);
      ctx.fillStyle = i === 0 ? lime : pink; ctx.fill();
    }
  }
  const unit = (w - pad * 2) / g.scores.length;
  g.scores.forEach((score, i) => {
    const x = pad + unit * (i + .5), y = cameraVisible ? h - footer * .30 : h * .932, recent = t - g.feedbackAt[i] < 1;
    const message = recent ? g.feedback[i] : score + ' 分';
    text(ctx, 'P' + (i + 1) + '  ' + message, x, y, Math.min(16, Math.max(10, unit / 6.8), h * .052), colors[i]);
  });
  ctx.fillStyle = '#45394e'; ctx.fillRect(0, h - 4, w, 4);
  ctx.fillStyle = lime; ctx.fillRect(0, h - 4, w * progress, 4);
  ctx.restore();
}

export const danceGame = {
  start, update, draw, stop, pause, resume, unlockAudio, action,
  get scores() { return game?.scores || []; }
};
