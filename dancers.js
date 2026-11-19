const ink = '#33283f';
const pearl = '#fff8eb';
const profiles = [
  {skin: '#f7c7aa', blush: '#ed998e', hair: '#49374c', highlight: '#7c5777', trousers: '#61507e', shoes: '#a4bf69'},
  {skin: '#d79971', blush: '#c77f6c', hair: '#493434', highlight: '#785649', trousers: '#4e6186', shoes: '#619fb7'},
  {skin: '#aa7159', blush: '#ad665f', hair: '#3d2c3c', highlight: '#754f60', trousers: '#74516f', shoes: '#cd84a8'},
  {skin: '#eeb18d', blush: '#d68a7d', hair: '#8a4d42', highlight: '#bf7660', trousers: '#566b6e', shoes: '#c5985e'}
];
const paths = new Map();

// Character artwork uses 100 drawing units per normalized pose unit.
function shape(ctx, outline, fill, stroke = ink, width = 2.4) {
  let path = paths.get(outline);
  if (!path) {
    path = new Path2D(outline);
    paths.set(outline, path);
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}

function oval(ctx, x, y, rx, ry, fill, stroke, width = 2.2) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function stroke(ctx, from, bend, to, color, width) {
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.quadraticCurveTo(...bend, ...to);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function shoe(ctx, foot, side, profile, accent, points) {
  ctx.save();
  ctx.translate(...foot);
  ctx.scale(side, 1);
  if (foot[1] < 72) ctx.rotate(-.16);
  shape(ctx, 'M-8 -9 Q-4 -12 4 -10 L7 -5 Q16 -5 18 1 Q21 7 14 8 L-7 8 Q-12 8 -12 3Z', pearl);
  shape(ctx, 'M-11 2 Q3 5 17 0 Q21 4 17 7 Q14 10 -7 9 Q-12 9 -12 5Z', points === 4 ? accent : profile.shoes, ink, 1.6);
  shape(ctx, 'M-6 -6 L0 -4 M-4 -9 L2 -7', null, profile.shoes, 1.8);
  ctx.restore();
}

function mitt(ctx, hand, elbow, profile, accent, side) {
  ctx.save();
  ctx.translate(...hand);
  ctx.rotate(Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]) + Math.PI / 2);
  ctx.scale(side, 1);
  shape(ctx, 'M-6 5 Q-10 -1 -8 -6 Q-7 -10 -2 -10 Q3 -12 7 -8 Q10 -4 7 1 Q11 -4 13 -1 Q15 2 10 7 Q7 11 1 10Z', profile.skin, ink, 2);
  shape(ctx, 'M-6 7 Q-1 10 6 7 L6 11 Q0 14 -6 11Z', accent, ink, 1.4);
  shape(ctx, 'M-5 -6 Q-3 -8 -1 -7', null, '#fff2da', 1.2);
  ctx.restore();
}

const patches = [
  'M0 -6 L2 -2 L7 -2 L3 1 L4 6 L0 3 L-4 6 L-3 1 L-7 -2 L-2 -2Z',
  'M1 -7 L-6 1 L-1 1 L-2 7 L6 -2 L1 -2Z',
  'M0 6 Q-11 0 -6 -5 Q-3 -8 0 -3 Q4 -8 7 -4 Q10 0 0 6Z',
  'M-5 -2 L5 -6 L5 3 Q4 8 0 6 Q-4 4 1 2 L2 2 L2 -2 L-2 -1 L-2 5 Q-3 10 -7 8 Q-10 6 -6 4Z'
];

function hoodie(ctx, player, accent) {
  shape(ctx, 'M-20 -31 Q-16 -39 -7 -39 L8 -39 Q18 -39 22 -29 L25 6 Q26 21 21 26 Q5 33 -20 27 Q-26 24 -25 11Z', accent);
  shape(ctx, 'M-24 17 Q-2 25 23 17 L21 26 Q5 32 -20 27Z', 'rgba(48,37,61,.16)', null);
  shape(ctx, 'M-19 -17 Q-21 -9 -21 -3', null, 'rgba(255,255,255,.48)', 2.6);
  shape(ctx, 'M-16 -34 Q-6 -42 1 -37 Q10 -42 17 -34 Q11 -25 0 -25 Q-9 -26 -16 -34Z', pearl, ink, 2);
  shape(ctx, 'M-7 -28 L-8 -21 M6 -28 L7 -22', null, ink, 1.7);
  ctx.save();
  ctx.translate(0, -7);
  shape(ctx, patches[player], pearl, ink, 1.5);
  ctx.restore();
  shape(ctx, 'M-10 8 L-13 13 Q0 16 13 12 L10 7', null, 'rgba(52,39,63,.46)', 1.5);
}

function face(ctx, profile, accent, player, beat) {
  const {hair, highlight, skin, blush} = profile;
  if (player === 0) {
    for (const side of [-1, 1]) {
      oval(ctx, side * 25, -20, 11.5, 10.5, hair, ink);
      oval(ctx, side * 24, -20, 5, 3, highlight);
      oval(ctx, side * 22, -14, 5, 3, accent);
    }
  }
  if (player === 2) {
    oval(ctx, 20, -21, 13, 13, hair, ink);
    oval(ctx, 30, -21, 5, 7, hair);
    oval(ctx, 24, -29, 6, 5, highlight);
  }
  oval(ctx, 0, 0, 30, 26, hair, ink);
  oval(ctx, -27, 5, 5.5, 6, skin, ink);
  oval(ctx, 27, 5, 5.5, 6, skin, ink);
  shape(ctx, 'M-26 -8 Q-23 -24 0 -23 Q23 -23 26 -8 L26 3 Q28 17 18 23 Q8 31 -7 28 Q-27 26 -27 9Z', skin);
  shape(ctx, 'M-26 -4 Q-28 -18 -16 -24 Q4 -36 21 -22 Q30 -16 28 -2 Q20 -4 15 -12 Q12 -7 7 -6 Q7 -11 3 -14 Q-5 -5 -15 -4 L-14 -10 Q-19 -4 -26 -2Z', hair, ink, 2);
  if (player === 1) {
    shape(ctx, 'M-27 -11 Q-29 -28 -10 -33 Q10 -38 22 -21 L24 -15 Q0 -12 -27 -11Z', accent);
    shape(ctx, 'M-3 -18 Q19 -25 32 -18 Q37 -14 29 -13 L-4 -11 Q-11 -12 -3 -18Z', profile.shoes, ink, 1.9);
    shape(ctx, 'M-16 -25 Q-12 -29 -7 -29', null, pearl, 2);
  } else if (player === 3) {
    shape(ctx, 'M-26 -11 Q-29 -29 -8 -33 Q11 -37 23 -22 L26 -12Z', accent);
    shape(ctx, 'M-28 -13 Q-2 -20 25 -13 L27 -5 Q1 -12 -26 -4Z', profile.shoes, ink, 2);
    shape(ctx, 'M-19 -12 L-18 -8 M-13 -13 L-12 -9 M18 -12 L19 -8', null, pearl, 1.4);
  } else if (player === 2) {
    shape(ctx, 'M-26 -11 Q-4 -23 24 -12 L25 -8 Q0 -17 -25 -6Z', accent, ink, 1.5);
  } else {
    shape(ctx, 'M-18 -16 Q-13 -21 -7 -21 M-14 -14 L-10 -17', null, highlight, 2.2);
    shape(ctx, 'M12 -13 L18 -17 M14 -10 L20 -14', null, accent, 2);
  }

  const blink = ((beat + player * 1.4) % 8 + 8) % 8;
  for (const side of [-1, 1]) {
    const eyeX = side * 11;
    oval(ctx, side * 18, 12, 5.1, 2.8, blush);
    if (blink > 7.82) {
      stroke(ctx, [eyeX - 3, 7], [eyeX, 3], [eyeX + 3, 7], ink, 2);
    } else {
      oval(ctx, eyeX, 5, 3.5, 4.9, ink);
      oval(ctx, eyeX - .8, 3.2, 1.25, 1.55, 'white');
    }
  }
  shape(ctx, 'M-4 13 Q0 15 5 12 Q5 19 1 19 Q-2 19 -4 13Z', '#7b4150', ink, 1.35);
  oval(ctx, .8, 17.2, 2.0, 1.1, '#f5a59e');
}

export function drawDancer(ctx, {x, y, size, player, accent, hands, feet, beatPosition, points, key, lift = 0, squash = 1}) {
  const profile = profiles[player];
  const angle = Math.PI * (beatPosition + player * .055);
  const rock = Math.sin(angle), bounce = Math.cos(angle * 2);
  const lean = .065 * rock;
  const hipX = 3.9 * rock, hipY = 20 + 2.5 * bounce;
  const cs = Math.cos(lean), sn = Math.sin(lean);
  function onTorso(px, py) {
    return [hipX + px * cs - (py - 20) * sn, hipY + px * sn + (py - 20) * cs];
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = ctx.lineJoin = 'round';
  oval(ctx, 0, 107, (43 - bounce * 1.4) * (1 - lift), 5.1 - lift * 3, 'rgba(26,15,38,.35)');
  if (lift || squash !== 1) {
    ctx.translate(0, 95 - 100 * lift);
    ctx.scale(1 + (1 - squash) * .2, squash);
    ctx.translate(0, -95);
  }

  for (let i = 0; i < 2; i++) {
    const side = i * 2 - 1;
    const foot = [feet[i][0] * 100, feet[i][1] * 100];
    const hip = onTorso(side * 12, 22);
    const knee = [hip[0] * .45 + foot[0] * .55 + side * (7 + 2 * bounce), foot[1] < 70 ? 34 : 57];
    stroke(ctx, hip, knee, foot, ink, 22.8);
    stroke(ctx, hip, knee, foot, profile.trousers, 18.4);
    stroke(ctx, [foot[0] - 6, foot[1] - 13], [foot[0], foot[1] - 11], [foot[0] + 6, foot[1] - 13], 'rgba(255,255,255,.36)', 2);
    shoe(ctx, foot, side, profile, accent, points);
  }

  const arms = hands.map((target, i) => {
    const side = i * 2 - 1;
    const hand = [target[0] * 100 + 1.2 * rock, target[1] * 100 + 1.6 * bounce];
    const shoulder = onTorso(side * 19, -29);
    const inward = Math.min(1, Math.max(0, (.32 - side * target[0]) * 2));
    const elbow = [side * (33 + .34 * Math.abs(hand[0])) + hipX, (hand[1] + shoulder[1]) * .5 + 11 + 24 * inward];
    if (key === 'swipe-left' || key === 'swipe-right') {
      const crossing = Math.max(0, Math.min(1, -side * hand[0] / 35));
      elbow[0] += ((hand[0] + shoulder[0]) / 2 - elbow[0]) * crossing;
    }
    stroke(ctx, shoulder, shoulder, elbow, ink, 17);
    stroke(ctx, shoulder, shoulder, elbow, accent, 12.8);
    return {side, hand, elbow};
  });

  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -20);
  hoodie(ctx, player, accent);
  ctx.restore();

  const neck = onTorso(0, -35);
  ctx.save();
  ctx.translate(neck[0], neck[1]);
  ctx.rotate(lean + .073 * Math.sin(angle - .50));
  ctx.translate(0, -25 + 1.5 * Math.cos(2 * angle - .6));
  ctx.scale(1.12, 1.12);
  face(ctx, profile, accent, player, beatPosition);
  ctx.restore();

  // Forearms are drawn over the jacket so crossing and clapping stay visible.
  for (const {side, hand, elbow} of arms) {
    const bend = [(hand[0] + elbow[0]) / 2 + side * 1.6, (hand[1] + elbow[1]) / 2 + 1.6];
    stroke(ctx, elbow, bend, hand, ink, 12.5);
    stroke(ctx, elbow, bend, hand, profile.skin, 8.4);
    mitt(ctx, hand, elbow, profile, accent, side);
  }
  ctx.restore();
}
