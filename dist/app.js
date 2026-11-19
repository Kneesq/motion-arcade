import {MotionTracker} from './tracker.js';
import {balloonGame, runnerGame} from './arcade.js';
import {danceGame, mountDanceEditor} from './dance.js';

const $ = id => document.getElementById(id);
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const games = [
  {id:'balloon', title:'气球爆破', en:'BALLOON POP', tag:'反应挑战', detail:'挥动双手，戳破迎面飘来的缤纷气球！', short:'瞄准缤纷气球，看看谁的反应最快。', meta:'动作捕捉', game:balloonGame},
  {id:'dance', title:'节拍舞台', en:'BEAT STUDIO', tag:'音乐节奏', detail:'上传喜欢的歌，编排属于你的十种舞步。', short:'上传你的音乐，自由组合专属舞步。', meta:'自由编舞', game:danceGame},
  {id:'runner', title:'冒险跑酷', en:'RUSH RUN', tag:'冒险闯关', detail:'跳跃、闪身、下蹲，穿过眼前的重重障碍！', short:'穿越不同场景，用身体躲开障碍。', meta:'第一视角', game:runnerGame}
];
const actions = {left:'向左',right:'向右',jump:'跳跃',duck:'下蹲',hit:'跟拍'};
const palette = ['#d5f75a','#ffb094','#9adfff','#dabaff'];
const prefs = {players:1,points:2,camera:'user'};
try {
  const saved = JSON.parse(localStorage.getItem('motion-arcade-settings'));
  if ([1,2,3,4].includes(saved?.players)) prefs.players = saved.players;
  if (saved?.points === 4) prefs.points = 4;
  if (saved?.camera === 'environment') prefs.camera = saved.camera;
} catch {}
const panel = $('panel'), stage = $('stage'), canvas = $('screen'), ctx = canvas.getContext('2d');
const tracker = new MotionTracker($('camera'));
let featured = 0, chosen = 0, phase = 'lobby', mode = 'demo', revision = 0;
let raf = 0, lastTime = 0, elapsed = 0, loseSince = 0, readySince = 0, demoPlayer = 0;
let game = games[0].game;
let editorMounted = false;
const img = g => 'assets/' + g.id + '.webp';
function button(text, action, primary = false) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = text; b.className = primary ? 'primary' : 'secondary';
  b.onclick = action; return b;
}
function renderFeature(index) {
  featured = (index + games.length) % games.length;
  const g = games[featured];
  $('hero').className = 'hero ' + g.id;
  $('hero-art').src = img(g); $('hero-en').textContent = g.en;
  $('hero-title').textContent = g.title; $('hero-desc').textContent = g.detail;
  $('hero-count').innerHTML = '0' + (featured + 1) + ' <i>/</i> 03';
}
games.forEach((g,index) => {
  const card = document.createElement('button');
  card.className = 'game-card ' + g.id; card.setAttribute('aria-label','游玩' + g.title);
  card.innerHTML = '<span class="card-art"><img src="' + img(g) + '" alt=""><span class="category">' + g.tag + '</span></span><span class="card-body"><span class="card-title"><strong>' + g.title + '</strong><small lang="en">' + g.en + '</small></span><span class="card-desc">' + g.short + '</span><span class="card-bottom"><span class="card-meta">' + icon('people') + '1–4 人</span><i class="sep"></i><span class="card-meta">' + g.meta + '</span><span class="card-go">' + icon('play') + '</span></span></span>';
  card.onclick = () => openSetup(index); $('cards').append(card);
});
$('prev').onclick = () => renderFeature(featured - 1);
$('next').onclick = () => renderFeature(featured + 1);
$('hero-play').onclick = $('settings').onclick = () => openSetup(featured);
function showPanel(title,setup = false) {
  $('panel-title').textContent = title;
  $('setup-content').hidden = !setup; $('info-content').hidden = setup;
  if (!panel.open) panel.showModal();
  document.body.style.overflow = 'hidden';
}
$('close').onclick = () => panel.close();
panel.addEventListener('click',e => { if (e.target === panel) panel.close(); });
panel.addEventListener('close',() => {
  document.body.style.overflow = phase === 'lobby' ? '' : 'hidden';
  $('dance-editor').querySelectorAll('audio').forEach(a => a.pause());
});
function renderPrefs() {
  document.querySelectorAll('[data-opt]').forEach(group => {
    group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(prefs[group.dataset.opt]) === b.dataset.value));
  });
}
document.querySelectorAll('[data-opt]').forEach(group => {
  group.addEventListener('click',e => {
    const b = e.target.closest('button'); if (!b) return;
    const key = group.dataset.opt;
    prefs[key] = key === 'camera' ? b.dataset.value : Number(b.dataset.value);
    try { localStorage.setItem('motion-arcade-settings', JSON.stringify(prefs)); } catch {}
    renderPrefs();
  });
});
function openSetup(index) {
  chosen = index;
  const g = games[chosen];
  const wrap = $('dance-editor-wrap');
  wrap.hidden = g.id !== 'dance';
  if (!wrap.hidden && !editorMounted) { mountDanceEditor($('dance-editor')); editorMounted = true; }
  $('chosen-game').innerHTML = '<img alt="" src="' + img(g) + '"><span>' + g.title + '<small>' + g.en + '</small></span>';
  renderPrefs(); showPanel('游玩设置', true); panel.scrollTop = 0;
}
const guide = '<p class="intro">把手机放稳，让镜头同时看到所有玩家。横屏游玩时，左右移动的空间更大。</p><section class="info-block"><h3>选择人数和镜头</h3><p>可选 1 至 4 人、前置或后置镜头。面向镜头并肩站好，保持双手、双脚可见，站直片刻完成定位。</p></section><section class="info-block"><h3>选择侦测点</h3><p>双手模式用左右手玩游戏，四点模式加入两只脚。跑酷会同时参考身体中心，识别跳跃、下蹲和侧移。</p></section><section class="info-block"><h3>开始游玩</h3><p>戳碰气球可以得分。舞蹈按节拍模仿动作，可在设置里选歌和编舞。跑酷跟随提示避开障碍。触控试玩可以直接点按画面或操作按钮。</p></section><section class="info-block"><h3>相机权限</h3><p>用 Safari 或 Chrome 打开 HTTPS 游戏网址，并在浏览器提示时允许相机。画面在手机本机分析，返回大厅后镜头会关闭。</p></section>';
const cast = '<p class="intro">手机负责识别动作，电视同步显示整场游戏。先让手机和电视连接同一个 Wi-Fi。</p><section class="info-block"><h3>iPhone · AirPlay</h3><p>打开控制中心，点「屏幕镜像」，选择 Apple TV 或支持 AirPlay 的电视，再回到游戏横屏游玩。</p><a href="https://support.apple.com/zh-cn/102661" target="_blank" rel="noopener">Apple 屏幕镜像说明</a></section><section class="info-block"><h3>Android · Google Cast</h3><p>打开 Google Home，长按支持 Google Cast 的电视或 Chromecast，选择投放屏幕。若系统询问分享范围，选择整个屏幕或正在玩的浏览器，再回到 Chrome。</p><a href="https://support.google.com/googlecast/answer/6059461?hl=zh-Hans" target="_blank" rel="noopener">Google 投屏说明</a></section>';
document.querySelectorAll('[data-dialog]').forEach(b => b.onclick = () => {
  if (phase === 'playing') pause('游戏已暂停');
  const tv = b.dataset.dialog === 'cast'; $('info-content').innerHTML = tv ? cast : guide;
  showPanel(tv ? '投屏到电视' : '游玩指南'); panel.scrollTop = 0;
});
function overlay(title,description,buttons = []) {
  $('inter-title').textContent = title; $('inter-desc').textContent = description;
  $('scores').replaceChildren(); $('inter-actions').replaceChildren(...buttons);
  $('intermission').hidden = false;
}
function closeRound() {
  revision++; cancelAnimationFrame(raf); raf = 0; tracker.stop(); game.stop();
  $('camera-box').hidden = true; stage.classList.remove('calibrating');
  $('controls').hidden = true; $('intermission').hidden = true;
  lastTime = 0; elapsed = 0; loseSince = 0; readySince = 0;
}
function lobby() {
  closeRound(); phase = 'lobby'; stage.hidden = true; $('lobby').hidden = false;
  document.body.style.overflow = '';
  if (document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
}
function setupAgain() { lobby(); openSetup(chosen); }
$('exit-game').onclick = lobby;
function fail(error) {
  closeRound(); phase = 'error'; $('pause').disabled = true;
  overlay(mode === 'camera' ? '体感游戏未能继续' : '游戏未能开始',error?.message || '请重新选择游戏设置。',[
    button('返回设置',setupAgain,true),button(mode === 'camera' ? '触控试玩' : '返回大厅',mode === 'camera' ? () => begin('demo') : lobby)
  ]);
}
function ready(players) { return players.length === prefs.players && players.every(p => p.calibrated); }
function cameraCount(players) {
  const label = '已识别 ' + players.length + ' / ' + prefs.players + ' 人';
  if ($('camera-count').textContent !== label) $('camera-count').textContent = label;
}
async function begin(requestMode) {
  closeRound(); mode = requestMode; game = games[chosen].game;
  const token = revision;
  if (game === danceGame) danceGame.unlockAudio();
  if (panel.open) panel.close();
  $('lobby').hidden = true; stage.hidden = false; $('pause').disabled = true;
  document.body.style.overflow = 'hidden'; $('stage-title').textContent = games[chosen].title;
  $('session-mode').textContent = mode === 'camera' ? '相机模式' : '触控试玩'; demoPlayer = 0;
  $('fullscreen').hidden = !stage.requestFullscreen || !document.fullscreenEnabled;
  ctx.clearRect(0,0,canvas.width,canvas.height); buildControls();
  if (mode === 'demo') { await startRound(token); return; }
  phase = 'loading'; stage.classList.add('calibrating'); $('camera-box').hidden = false;
  $('camera-count').textContent = '等待镜头';
  overlay('准备镜头','请在浏览器中允许使用相机。',[button('返回设置',setupAgain)]);
  try {
    await tracker.start({...prefs,onStatus:message => {
      if (token === revision && phase === 'loading') $('inter-desc').textContent = message;
    },onError:error => { if (token === revision) fail(error); }});
    if (revision !== token) return;
    phase = 'calibrate';
    overlay('请玩家站好','所有玩家并肩站直，保持手脚入镜。识别齐全后自动开始。',[button('返回设置',setupAgain)]);
    raf = requestAnimationFrame(function calibrate(t) {
      if (token !== revision || phase !== 'calibrate') return;
      const players = tracker.getPlayers(); cameraCount(players);
      if (ready(players) && !document.hidden && !panel.open) {
        readySince ||= t;
        if (t - readySince >= 700) { startRound(token); return; }
      } else readySince = 0;
      raf = requestAnimationFrame(calibrate);
    });
  } catch (e) { if (token === revision) fail(e); }
}
$('camera-start').onclick = () => begin('camera'); $('demo-start').onclick = () => begin('demo');
async function startRound(token) {
  phase = 'starting'; stage.classList.remove('calibrating');
  overlay('正在开始',games[chosen].title);
  try {
    await game.start({...prefs,mode,onFinish:(scores,details) => {if (revision === token) finish(scores,details);}});
    if (revision !== token) return;
    phase = 'playing'; lastTime = 0; elapsed = 0; $('pause').disabled = false;
    $('intermission').hidden = true;
    $('controls').hidden = mode !== 'demo' || (game === balloonGame && prefs.players === 1);
    if (document.hidden || panel.open) pause('游戏已暂停');
    else raf = requestAnimationFrame(tick);
  } catch (e) { if (revision === token) fail(e); }
}
function finish(scores,details) {
  closeRound(); phase = 'finished'; $('pause').disabled = true;
  const title = details?.completed === false ? '本关未通过' : details?.completed ? '全程通关！' : '本局结束！';
  const result = details?.stageName ? details.stageName + ' · 已通过 ' + details.cleared + ' 个障碍' : games[chosen].title;
  overlay(title,result,[button('再玩一局',() => begin(mode),true),button('返回大厅',lobby)]);
  scores.forEach((s,id) => {
    const row = document.createElement('div'); row.className = 'score-row';
    row.innerHTML = '<b>玩家 ' + (id + 1) + '</b><span>' + Number(s) + ' 分</span>'; $('scores').append(row);
  });
}
function markers(players,w,h) {
  const limbs = prefs.points === 4 ? ['leftHand','rightHand','leftFoot','rightFoot'] : ['leftHand','rightHand'];
  ctx.save();
  for (const p of players) for (const key of limbs) {
    const point = p[key]; if (!point || point.score < .45) continue;
    const x = point.x * w, y = point.y * h, radius = Math.max(8,Math.min(14,Math.min(w,h)*.024));
    ctx.fillStyle = palette[p.id]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#19282a'; ctx.font = 'bold ' + radius + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.id + 1,x,y);
  }
  ctx.restore();
}
function tick(now) {
  if (phase !== 'playing') return;
  const dt = lastTime ? Math.min(.2,(now-lastTime)/1000) : 0; lastTime = now; elapsed += dt;
  const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1,2);
  if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);}
  const players = mode === 'camera' ? tracker.getPlayers() : [];
  if (mode === 'camera') {
    cameraCount(players);
    if (players.length < prefs.players) {
      loseSince ||= now;
      if (now-loseSince > 1800) { pause('请回到镜头前','所有玩家重新入镜后，点「继续游戏」。'); return; }
    } else loseSince = 0;
  }
  const frame = {w,h,dt,time:elapsed,players};
  game.update(frame);
  if (phase !== 'playing') return;
  if (w && h) {
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.save(); game.draw(ctx,frame); ctx.restore();
    if (game === balloonGame && mode === 'camera') markers(players,w,h);
  }
  raf = requestAnimationFrame(tick);
}
function pause(title,description = '准备好后继续本局。') {
  if (phase !== 'playing') return;
  phase = 'paused'; cancelAnimationFrame(raf); game.pause?.(); $('pause').disabled = true;
  overlay(title,description,[button('继续游戏',resume,true),button('返回大厅',lobby)]);
}
async function resume() {
  if (phase !== 'paused') return;
  if (mode === 'camera' && !ready(tracker.getPlayers())) {
    cameraCount(tracker.getPlayers()); $('inter-desc').textContent = '请让所有玩家入镜，站稳后再点继续。'; return;
  }
  const token = revision; phase = 'resuming';
  try {
    await game.resume?.(); if (token !== revision) return;
    lastTime = 0; loseSince = 0; phase = 'playing'; $('pause').disabled = false;
    $('intermission').hidden = true;
    if (document.hidden || panel.open) pause('游戏已暂停');
    else raf = requestAnimationFrame(tick);
  } catch (e) { if (token === revision) fail(e); }
}
$('pause').onclick = () => pause('游戏已暂停');
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); }
  catch { pause('当前浏览器限制全屏','横放手机即可使用宽屏画面。'); }
};
function buildControls() {
  const root = $('controls'); root.replaceChildren(); root.hidden = true;
  if (mode !== 'demo') return;
  if (prefs.players > 1) {
    const picker = document.createElement('select'); picker.setAttribute('aria-label','控制玩家');
    for (let i = 0; i < prefs.players; i++) picker.add(new Option('玩家 ' + (i+1),String(i)));
    picker.onchange = () => {demoPlayer = Number(picker.value);}; root.append(picker);
  }
  const names = game === runnerGame ? ['left','jump','duck','right'] : game === danceGame ? ['hit'] : [];
  for (const a of names) root.append(button(actions[a],() => input(a)));
}
function input(a) {
  if (phase === 'playing' && mode === 'demo') game.action?.(demoPlayer,a);
}
canvas.addEventListener('pointerdown',e => {
  if (phase !== 'playing' || mode !== 'demo') return;
  const r = canvas.getBoundingClientRect();
  if (game === balloonGame) game.tap((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,demoPlayer);
  else if (game === danceGame) input('hit');
});
window.addEventListener('keydown',e => {
  if (phase !== 'playing' || panel.open || e.repeat || e.target.tagName === 'SELECT') return;
  const a = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',ArrowDown:'duck',' ':game === danceGame ? 'hit' : 'jump'}[e.key];
  if (a && mode === 'demo') {e.preventDefault(); input(a);}
  if (e.key === 'Escape') pause('游戏已暂停');
});
document.addEventListener('visibilitychange',() => { if (document.hidden && phase === 'playing') pause('游戏已暂停'); });
window.addEventListener('pagehide',() => { if (phase !== 'lobby') lobby(); });

