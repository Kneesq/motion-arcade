// Times are seconds on the dance clock. The tracker has already mirrored the
// front camera, so increasing x always means moving toward screen right.
const strokeWindow = .75;
const maxSampleGap = .45;
const shortestStroke = .09;
const minScore = .35;

function visible(point) {
  return point && point.score >= minScore && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samplePlayer(player, time) {
  const shoulders = [player.leftShoulder, player.rightShoulder].filter(visible);
  const hips = [player.leftHip, player.rightHip].filter(visible);
  if (!shoulders.length || !hips.length) return null;
  const average = (points, axis) => points.reduce((sum, p) => sum + p[axis], 0) / points.length;
  const shoulderY = average(shoulders, 'y');
  const hipY = average(hips, 'y');
  const height = hipY - shoulderY;
  if (height < .035) return null;
  const sample = {time, height, bodyY: (shoulderY + hipY) / 2, hands: null};
  if (shoulders.length < 2 || !visible(player.leftHand) || !visible(player.rightHand)) return sample;
  const width = Math.abs(shoulders[0].x - shoulders[1].x);
  if (width < .018) return sample;
  const center = average(shoulders, 'x');
  // Normalize to torso height first. Turning shoulders alone should not stretch
  // wrist positions, and stepping closer should not count as arm movement.
  sample.width = width / height;
  sample.hands = [player.leftHand, player.rightHand].map(p => ({
    x: (p.x - center) / height, y: (p.y - shoulderY) / height
  }));
  return sample;
}

function strokeDirection(track, sample) {
  // Prefer the most recent valid start, so the return leg of a pump can be
  // detected even while the history still contains its outbound leg.
  for (let i = track.history.length - 1; i >= 0; i--) {
    const before = track.history[i];
    if (!before.hands) break;
    if (sample.time - before.time < shortestStroke) continue;
    const width = (sample.width + before.width) / 2;
    const dxL = (sample.hands[0].x - before.hands[0].x) / width;
    const dxR = (sample.hands[1].x - before.hands[1].x) / width;
    const dyL = sample.hands[0].y - before.hands[0].y;
    const dyR = sample.hands[1].y - before.hands[1].y;
    const across = Math.abs(dxL) + Math.abs(dxR), along = Math.abs(dyL) + Math.abs(dyR);
    let direction = null;
    if (along < across * .86) {
      if (dxL < -.60 && dxR < -.60) direction = 'swipe-left';
      if (dxL > .60 && dxR > .60) direction = 'swipe-right';
    }
    if (across < along * .86) {
      if (dyL < -.46 && dyR < -.46) direction = 'up';
      if (dyL > .46 && dyR > .46) direction = 'down';
    }
    if (!direction && Math.abs(dyL - dyR) > .78 && dyL * dyR < -.06) {
      direction = 'alternate';
    }
    // A new stroke needs fresh travel after the last direction change. Older
    // horizontal motion cannot reappear during a following vertical pump.
    if (direction && (direction === track.stroke || before.time >= track.strokeAt)) return direction;
  }
  return null;
}

function sameSample(a, b) {
  return a && a.bodyY === b.bodyY && a.height === b.height && a.width === b.width &&
    (b.hands ? a.hands?.every((p, i) => p.x === b.hands[i].x && p.y === b.hands[i].y) : !a.hands);
}

function gesture(track, key, time) {
  const event = {key, time, cue: null};
  track.events.push(event);
  return event;
}

function followEndpoint(track, sample) {
  const end = track.endpoint;
  if (!end) return;
  if (end.event.cue !== null || sample.time - end.event.time > .32) {
    track.endpoint = null;
    return;
  }
  const horizontal = end.stroke === 'swipe-left' || end.stroke === 'swipe-right';
  const axis = horizontal ? 'x' : 'y';
  const scale = horizontal ? (sample.width + end.sample.width) / 2 : 1;
  const sign = end.stroke === 'up' || end.stroke === 'swipe-left' ? -1 : 1;
  const advance = Math.min(...sample.hands.map((hand, i) =>
    sign * (hand[axis] - end.sample.hands[i][axis]) / scale
  ));
  if (advance < -.10) track.endpoint = null;
  else if (advance > .03) {
    end.event.time = sample.time;
    end.sample = sample;
  }
}

function observeHands(track, sample) {
  const time = sample.time;
  if (!sample.hands) {
    track.stroke = null;
    track.pump = null;
    track.endpoint = null;
    return;
  }
  followEndpoint(track, sample);
  const spread = Math.abs(sample.hands[0].x - sample.hands[1].x) / sample.width;
  if (spread > .92) track.wideAt = time;
  if (spread < .50 && time - (track.wideAt || -Infinity) <= .85 && time - (track.lastClap || -Infinity) > .35) {
    track.lastClap = time;
    track.wideAt = -Infinity;
    gesture(track, 'clap-beat', time);
  }
  const stroke = strokeDirection(track, sample);
  if (!stroke) {
    if (time - track.lastStroke > .18) track.stroke = null;
    return;
  }
  track.lastStroke = time;
  if (track.stroke === stroke) return;
  track.stroke = stroke;
  track.strokeAt = time;
  track.endpoint = null;
  let key;
  if (stroke === 'swipe-left' || stroke === 'swipe-right') {
    const overhead = sample.hands[0].y < -.12 && sample.hands[1].y < -.12;
    if (overhead) gesture(track, 'wave-both', time);
    key = stroke;
    track.pump = null;
  } else if (stroke === 'alternate') {
    key = 'alternate-pump';
    track.pump = null;
  } else if (track.pump && track.pump.stroke !== stroke && time - track.pump.time <= 1.5) {
    key = 'hands-pump';
    track.pump = null;
  } else {
    track.pump = {stroke, time};
  }
  if (key) track.endpoint = {event: gesture(track, key, time), stroke, sample};
}

export function createDanceMotionTracker() {
  const tracks = new Map();
  let clock = -Infinity;

  function reset() {
    tracks.clear();
    clock = -Infinity;
  }

  function update(players, time) {
    if (!Number.isFinite(time)) { reset(); return; }
    if (time < clock || time - clock > maxSampleGap) reset();
    clock = time;
    const seen = new Set();
    for (const p of players || []) {
      if (!Number.isInteger(p?.id) || p.calibrated === false) continue;
      const sample = samplePlayer(p, time);
      if (!sample) continue;
      seen.add(p.id);
      const jumping = p.gestures?.jump === true;
      const ducking = p.gestures?.duck === true;
      let track = tracks.get(p.id);
      // getPlayers() reuses the last inference object between camera frames.
      // Sampling it every repaint could turn a stale wrist into a new stroke.
      if (track && p === track.cameraFrame && jumping === track.jumping && ducking === track.ducking &&
          sameSample(track.history[track.history.length - 1], sample)) continue;
      if (!track || time - track.lastSample > maxSampleGap) {
        track = {history: [], events: [], stroke: null, strokeAt: -Infinity,
          lastStroke: -Infinity, pump: null, endpoint: null, jumping, ducking};
        tracks.set(p.id, track);
      }
      if (time === track.lastSample) continue;
      track.cameraFrame = p;
      track.lastSample = time;
      track.history = track.history.filter(s => time - s.time <= strokeWindow);
      track.events = track.events.filter(e => time - e.time <= 2);
      if (jumping && !track.jumping && track.history.some(s =>
        time - s.time <= .55 && s.bodyY - sample.bodyY >= .10 * sample.height
      )) gesture(track, 'jump', time);
      if (ducking && !track.ducking) gesture(track, 'squat', time);
      track.jumping = jumping;
      track.ducking = ducking;
      observeHands(track, sample);
      track.history.push(sample);
    }
    for (const id of tracks.keys()) if (!seen.has(id)) tracks.delete(id);
  }

  function matchTime(playerId, key, cueTime, tolerance) {
    const track = tracks.get(playerId);
    if (!track || !Number.isFinite(cueTime) || !Number.isFinite(tolerance) || tolerance < 0 ||
        Math.abs(clock - cueTime) > tolerance + 1e-6) return null;
    let best = null;
    for (const event of track.events) {
      if (event.key !== key || Math.abs(event.time - cueTime) > tolerance + 1e-6) continue;
      if (event.cue === cueTime) return event.time;
      if (event.cue === null && (!best || Math.abs(event.time - cueTime) < Math.abs(best.time - cueTime))) best = event;
    }
    if (!best) return null;
    best.cue = cueTime;
    return best.time;
  }
  return {update, matchTime, reset};
}
