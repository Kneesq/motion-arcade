const asset = name => new URL('./vendor/mediapipe/' + name, import.meta.url).href;
const visible = 0.45;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const blank = () => ({x: 0, y: 0, score: 0});
const cancelled = () => new DOMException('已结束相机追踪。', 'AbortError');

// The Wasm loader temporarily uses a global module factory. Serialize overlapping
// initializations when someone switches cameras while the model is still loading.
let loading = Promise.resolve();
function openModel(count, active) {
  const next = loading.then(async () => {
    if (!active()) throw cancelled();
    const {FilesetResolver, PoseLandmarker} = await import('./vendor/mediapipe/vision_bundle.mjs');
    const files = await FilesetResolver.forVisionTasks(asset('wasm'));
    const options = {
      baseOptions: {modelAssetPath: asset('pose_landmarker_lite.task'), delegate: 'GPU'},
      numPoses: count, runningMode: count === 1 ? 'VIDEO' : 'IMAGE', outputSegmentationMasks: false
    };
    if (!active()) throw cancelled();
    try {
      return await PoseLandmarker.createFromOptions(files, options);
    } catch (gpuError) {
      if (!active()) throw cancelled();
      options.baseOptions.delegate = 'CPU';
      return await PoseLandmarker.createFromOptions(files, options);
    }
  });
  loading = next.catch(() => {});
  return next;
}

function measure(landmarks, mirror, points, region = {x: 0, y: 0, w: 1, h: 1}) {
  function point(index) {
    const p = landmarks[index];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
        p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return blank();
    const x = region.x + p.x * region.w;
    return {x: mirror ? 1 - x : x, y: region.y + p.y * region.h, score: Math.min(p.visibility ?? 1, p.presence ?? 1)};
  }
  const leftShoulder = point(11), rightShoulder = point(12);
  const leftHip = point(23), rightHip = point(24);
  const shoulders = [leftShoulder, rightShoulder].filter(p => p.score >= visible);
  const hips = [leftHip, rightHip].filter(p => p.score >= visible);
  if (!shoulders.length || !hips.length) return null;
  const mean = (pts, key) => pts.reduce((s, p) => s + p[key], 0) / pts.length;
  const center = {
    x: (mean(shoulders, 'x') + mean(hips, 'x')) / 2,
    y: (mean(shoulders, 'y') + mean(hips, 'y')) / 2
  };
  const height = Math.max(0.045, mean(hips, 'y') - mean(shoulders, 'y'));
  const width = shoulders.length === 2 ? Math.abs(leftShoulder.x - rightShoulder.x) : 0;
  return {
    leftHand: point(15), rightHand: point(16),
    leftFoot: points === 4 ? point(27) : blank(), rightFoot: points === 4 ? point(28) : blank(),
    leftShoulder, rightShoulder, leftHip, rightHip, center, height, width
  };
}

// A wide shot can shrink four people below the detector's input resolution.
// Try successively closer views until everyone is found, then reuse that layout.
// IMAGE mode keeps inference independent when adjacent crops enter the detector.
function groupScanner(detector, video, count, mirror, points) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {alpha: false});
  const layouts = count === 2 ? [[1, 1], [2, 1], [1, 2]] : [[1, 1], [2, 1], [count, 1], [2, 2]];
  let layout = 0, nextTry = 0;
  return now => {
    const [columns, rows] = layouts[layout];
    const poses = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        // Padding allows arms and legs to extend beyond the player's tile.
        const x = Math.max(0, (column - 0.24) / columns), y = Math.max(0, (row - 0.20) / rows);
        const w = Math.min(1, (column + 1.24) / columns) - x;
        const h = Math.min(1, (row + 1.20) / rows) - y;
        let image = video;
        if (columns * rows > 1) {
          const sw = w * video.videoWidth, sh = h * video.videoHeight;
          const ratio = Math.min(1, 480 / Math.max(sw, sh));
          const cw = Math.max(1, Math.round(sw * ratio)), ch = Math.max(1, Math.round(sh * ratio));
          if (canvas.width !== cw) canvas.width = cw;
          if (canvas.height !== ch) canvas.height = ch;
          context.drawImage(video, x * video.videoWidth, y * video.videoHeight, sw, sh, 0, 0, cw, ch);
          image = canvas;
        }
        for (const landmarks of detector.detect(image).landmarks) {
          const p = measure(landmarks, mirror, points, {x, y, w, h});
          if (!p) continue;
          const sourceX = mirror ? 1 - p.center.x : p.center.x;
          if (Math.floor(sourceX * columns) === column && Math.floor(p.center.y * rows) === row) poses.push(p);
        }
      }
    }
    if (poses.length >= count) nextTry = now + 800;
    else if (now >= nextTry) {
      layout = (layout + 1) % layouts.length;
      nextTry = now + 200;
    }
    return poses.slice(0, count);
  };
}

// At most four people. Maximize the number of plausible matches, then minimize
// total distance to predicted positions, independently of detector output order.
function matchTracks(poses, tracks, now) {
  let best = {count: -1, cost: Infinity, ids: []};
  function search(i, ids, used, count, cost) {
    if (i === poses.length) {
      if (count > best.count || (count === best.count && cost < best.cost)) {
        best = {count, cost, ids: [...ids]};
      }
      return;
    }
    ids[i] = -1;
    search(i + 1, ids, used, count, cost);
    const p = poses[i];
    for (const t of tracks.values()) {
      if (used.has(t.id)) continue;
      const age = now - t.last;
      const horizon = Math.min(age, 200);
      const dx = p.center.x - t.x - t.vx * horizon;
      const dy = p.center.y - t.y - t.vy * horizon;
      const distance = Math.hypot(dx, dy);
      if (distance > Math.max(0.13, t.baseHeight * 1.1) + Math.min(0.12, age / 2500)) continue;
      ids[i] = t.id;
      used.add(t.id);
      search(i + 1, ids, used, count + 1, cost + distance + 0.14 * Math.abs(t.baseHeight - p.height));
      used.delete(t.id);
    }
  }
  search(0, [], new Set(), 0, 0);
  return best.ids;
}

function footLevel(p) {
  if (p.leftFoot.score < visible || p.rightFoot.score < visible) return null;
  return Math.max(p.leftFoot.y, p.rightFoot.y);
}

function newTrack(id, p, now) {
  return {
    id, x: p.center.x, y: p.center.y, vx: 0, vy: 0, last: now, since: now,
    baseX: p.center.x, baseY: p.center.y, baseHeight: p.height, baseWidth: p.width,
    baseFoot: footLevel(p), jumpUntil: 0, duckUntil: 0
  };
}

function updateTrack(t, p, now) {
  const dt = Math.max(1, now - t.last);
  t.vx = clamp(0.55 * t.vx + 0.45 * (p.center.x - t.x) / dt, -0.001, 0.001);
  t.vy = clamp(0.55 * t.vy + 0.45 * (p.center.y - t.y) / dt, -0.001, 0.001);
  t.x = p.center.x;
  t.y = p.center.y;
  t.last = now;
  const floor = footLevel(p);
  const calibrating = now - t.since < 550;
  const sideways = t.x - t.baseX, down = t.y - t.baseY;
  const sideThreshold = Math.max(0.032, t.baseWidth * 0.48);
  const upThreshold = Math.max(0.024, t.baseHeight * 0.21);
  const downThreshold = Math.max(0.042, t.baseHeight * 0.37);
  // Follow small changes in standing posture, preserving deliberate, held poses.
  if (calibrating || (Math.abs(sideways) < sideThreshold * 0.65 && Math.abs(down) < upThreshold * 0.65)) {
    const rate = calibrating ? 0.22 : Math.min(dt / 6500, 0.08);
    t.baseX += sideways * rate;
    t.baseY += down * rate;
    t.baseHeight += (p.height - t.baseHeight) * rate;
    if (p.width > 0) t.baseWidth += (p.width - t.baseWidth) * rate;
    if (floor !== null) t.baseFoot = t.baseFoot === null ? floor : t.baseFoot + (floor - t.baseFoot) * rate;
  }
  if (!calibrating) {
    const feetRose = floor === null || t.baseFoot === null || t.baseFoot - floor > upThreshold * 0.50;
    if (down < -upThreshold && feetRose) t.jumpUntil = now + 230;
    if (down > downThreshold) t.duckUntil = now + 150;
  }
  const {height, width, ...player} = p;
  return {
    ...player, id: t.id, calibrated: !calibrating,
    gestures: {
      left: !calibrating && sideways < -sideThreshold,
      right: !calibrating && sideways > sideThreshold,
      jump: now < t.jumpUntil, duck: now < t.duckUntil
    }
  };
}

const cameraErrors = {
  NotAllowedError: '相机权限未开启。请在浏览器的网站设置中允许相机，然后重试。',
  NotFoundError: '找不到相机。请连接相机，或改选另一个镜头。',
  OverconstrainedError: '这个镜头不支持所需的拍摄模式，请改选另一个镜头。',
  NotReadableError: '相机正在被其他程序使用。请关闭该程序，然后重试。'
};

export class MotionTracker {
  constructor(video) {
    this.video = video;
    this.tracks = new Map();
    this.players = [];
    this.session = 0;
  }

  getPlayers() {
    return performance.now() - this.updated < 1000 ? this.players : [];
  }

  async start({camera = 'user', players = 1, points = 2, onStatus = () => {}, onError = () => {}} = {}) {
    this.stop();
    const session = this.session;
    const active = () => this.session === session;
    const count = clamp(Math.trunc(+players) || 1, 1, 4);
    const pointCount = +points === 4 ? 4 : 2;
    const video = this.video;
    let stage = 'camera';
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('相机需要安全连接。请用 Safari 或 Chrome 打开游戏的 HTTPS 网址。');
    }
    try {
      onStatus('等待相机权限…');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {ideal: camera}, width: {ideal: count > 1 ? 960 : 640},
          height: {ideal: count > 1 ? 540 : 480}, frameRate: {ideal: 24, max: 30}
        }
      });
      if (!active()) {
        stream.getTracks().forEach(t => t.stop());
        throw cancelled();
      }
      this.stream = stream;
      const cameraTrack = stream.getVideoTracks()[0];
      const facing = cameraTrack.getSettings?.().facingMode;
      if (facing && facing !== camera && ['user', 'environment'].includes(facing)) {
        throw new Error('设备未提供所选镜头。请改选另一个镜头后重试。');
      }
      const mirror = (facing || camera) === 'user';
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.style.transform = mirror ? 'scaleX(-1)' : 'none';
      video.srcObject = stream;
      const fail = message => {
        if (!active()) return;
        this.stop();
        onStatus(message);
        onError(new Error(message));
      };
      cameraTrack.onended = () => fail('相机连接已中断，请重新开启相机。');
      await video.play();
      if (!active()) throw cancelled();
      stage = 'model';
      onStatus('正在载入动作模型…');
      const detector = await openModel(count, active);
      if (!active()) {
        detector.close();
        throw cancelled();
      }
      this.detector = detector;
      const scanGroup = count > 1 ? groupScanner(detector, video, count, mirror, pointCount) : null;
      let previousVideoTime = -1, previousRun = -Infinity, previousCount = -1;
      const frame = now => {
        if (!active()) return;
        if (video.readyState >= 2 && video.videoWidth && video.currentTime !== previousVideoTime && now - previousRun >= 50) {
          previousVideoTime = video.currentTime;
          previousRun = now;
          try {
            const poses = scanGroup ? scanGroup(now) :
              detector.detectForVideo(video, now).landmarks.map(p => measure(p, mirror, pointCount)).filter(Boolean);
            this.update(poses, count, now);
            if (this.players.length !== previousCount) {
              previousCount = this.players.length;
              onStatus(previousCount ? '已识别 ' + previousCount + ' / ' + count + ' 位玩家' : '请面向镜头，让身体进入画面。');
            }
          } catch {
            fail('动作识别已中断。请退出本局后重新开启相机。');
            return;
          }
        }
        if (active()) this.frameId = requestAnimationFrame(frame);
      };
      onStatus('请站直片刻，让镜头记住你的起始位置。');
      this.frameId = requestAnimationFrame(frame);
    } catch (error) {
      if (!active()) throw cancelled();
      this.stop();
      if (stage === 'model') throw new Error('动作模型无法载入。请确认游戏文件已完整下载，并更新浏览器后重试。');
      throw new Error(cameraErrors[error.name] || error.message || '无法打开相机。');
    }
  }

  update(poses, limit, now) {
    for (const [id, t] of this.tracks) {
      if (now - t.last > 1250) this.tracks.delete(id);
    }
    poses.sort((a, b) => a.center.x - b.center.x);
    const ids = matchTracks(poses, this.tracks, now);
    this.players = [];
    poses.forEach((pose, index) => {
      let id = ids[index];
      if (id === -1) {
        id = 0;
        while (this.tracks.has(id) && id < limit) id++;
        if (id >= limit) return;
        this.tracks.set(id, newTrack(id, pose, now));
      }
      this.players.push(updateTrack(this.tracks.get(id), pose, now));
    });
    this.players.sort((a, b) => a.id - b.id);
    this.updated = performance.now();
  }

  stop() {
    this.session++;
    if (this.frameId != null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.onended = null;
        track.stop();
      }
      this.stream = null;
    }
    this.video.pause();
    this.video.srcObject = null;
    if (this.detector) {
      this.detector.close();
      this.detector = null;
    }
    this.tracks.clear();
    this.players = [];
    this.updated = -Infinity;
  }
}
