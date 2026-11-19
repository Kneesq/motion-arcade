import {polygon, ellipse, panel, sky} from './canvas-shapes.js';

// Balloon hit tests use the tracker's normalized screen coordinates.
const ink = '#19282a';
const paper = '#fffdf3';
const playerColors = ['#d5f75a', '#ffb094', '#9adfff', '#dabaff'];
export const balloonPalette = [
  {key:'red', name:'红色', color:'#ec566a'},
  {key:'blue', name:'蓝色', color:'#428ae3'},
  {key:'green', name:'绿色', color:'#27a57b'},
  {key:'yellow', name:'黄色', color:'#f3c839'},
  {key:'purple', name:'紫色', color:'#a674dc'},
  {key:'orange', name:'橙色', color:'#f48d47'}
];
const balloonColors = balloonPalette.map(choice => choice.color);
const tau = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;

function label(ctx, value, x, y, size, color = ink, align = 'left', weight = 700) {
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function layer(ctx, w, h, y, a, phase, fill) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 72; i++) {
    const f = i / 72;
    ctx.lineTo(f * w, (y + a * (Math.sin(f * 8 + phase) + .37 * Math.cos(f * 15 - phase))) * h);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function scoreStrip(ctx, w, h, s) {
  const size = clamp(Math.min(w,h) * .041, 13, 23);
  const gap = size * .4;
  const width = Math.min(size * 7.2, (w - gap * (s.count + 1)) / s.count);
  const height = size * 1.95;
  const start = (w - s.count * width - (s.count - 1) * gap) / 2;
  for (let id = 0; id < s.count; id++) {
    const x = start + (width + gap) * id;
    const y = h - height - gap * 1.4;
    const note = s.notes[id];
    const active = note && s.age - note.at < .9;
    ctx.lineWidth = 1.5;
    const color = active ? note.color : paper;
    panel(ctx, x, y, width, height, height / 2, color, ink);
    const r = height * .34;
    ellipse(ctx, x + height / 2, y + height / 2, r, r, playerColors[id], ink);
    label(ctx, id + 1, x + height / 2, y + height / 2, size * .9, ink, 'center', 850);
    const text = active ? note.text : s.scores[id] + '分';
    label(ctx, text, x + height / 2 + r + (width - height / 2 - r) / 2 - 2, y + height / 2, size * .93, ink, 'center');
  }
}

function newRound(options) {
  const count = clamp(Math.floor(options.players) || 1, 1, 4);
  return {
    count, points: options.points === 4 ? 4 : 2, age: 0,
    scores: Array(count).fill(0), notes: Array(count).fill(null),
    onFinish: options.onFinish, onSfx: options.onSfx, finished: false
  };
}

function finish(s, details) {
  if (s.finished) return;
  s.finished = true;
  s.onSfx?.('finish');
  s.onFinish?.(s.scores.slice(), details);
}

function cloud(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.bezierCurveTo(x - size, y - size * .45, x - size * .58, y - size * .55, x - size * .35, y - size * .39);
  ctx.bezierCurveTo(x - size * .23, y - size * .98, x + size * .51, y - size * .85, x + size * .56, y - size * .41);
  ctx.bezierCurveTo(x + size * .88, y - size * .5, x + size, y - size * .26, x + size, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,244,.8)';
  ctx.fill();
}

function fairground(ctx, w, h, t) {
  sky(ctx, w, h, '#7dd9e9', '#f6f4db', .9);
  const unit = Math.min(w,h);
  ellipse(ctx, w * .83, h * .24, unit * .095, unit * .095, '#fff2ae');
  for (let i = 0; i < 6; i++) {
    const x = ((i * .237 + t * .003) % 1.25 - .13) * w;
    cloud(ctx, x, h * (.2 + ((i * 13) % 5) * .11), unit * (.052 + (i % 3) * .025));
  }
  layer(ctx, w, h, .79, .044, .8, '#a9d9b3');
  layer(ctx, w, h, .88, .055, 2.7, '#71be99');
  layer(ctx, w, h, .96, .023, 4.2, '#4ca68a');
  ctx.lineWidth = Math.max(1, unit * .003);
  ctx.strokeStyle = '#39585b';
  ctx.beginPath();
  ctx.moveTo(-10, h * .029);
  ctx.quadraticCurveTo(w / 2, h * .18, w + 10, h * .029);
  ctx.stroke();
  const n = Math.max(9, Math.ceil(w / (unit * .083)));
  for (let i = 0; i < n; i++) {
    const x = (i + .5) / n;
    const y = h * (.029 + .302 * x * (1 - x));
    const a = Math.min(w / n * .32, unit * .024);
    polygon(ctx, [[x*w-a,y],[x*w+a,y],[x*w+a*.19,y+a*1.6]], balloonColors[i % 6]);
  }
}

const duration = 45;
let balloons;

function assignColors(count, keys) {
  const selected = [];
  const used = new Set();
  // Reserve explicitly requested colors before filling gaps or duplicates.
  for (let id = 0; id < count; id++) {
    const choice = balloonPalette.find(entry => entry.key === keys?.[id] && !used.has(entry.key));
    selected.push(choice);
    if (choice) used.add(choice.key);
  }
  return selected.map(choice => {
    if (choice) return choice;
    const available = balloonPalette.find(entry => !used.has(entry.key));
    used.add(available.key);
    return available;
  });
}

function spawnBalloon(s) {
  const lane = s.serial % s.count;
  const wave = Math.floor(s.serial / s.count);
  const anchor = s.anchors[lane];
  const reach = s.count === 1 ? .28 : Math.min(.19, .50 / s.count);
  const r = .046 + Math.random() * .015;
  const base = clamp(anchor + (Math.random() * 2 - 1) * reach, .085, .915);
  // Give every lane two waves of its own color, then one rotated challenge wave.
  // Colors stay balanced across the screen even when the available space fills up.
  let owner = lane;
  if (s.challenge && wave % 3 === 2) {
    owner = (lane + 1 + Math.floor(wave / 3) % (s.count - 1)) % s.count;
  }
  const color = s.challenge ? s.assignments[owner].color : balloonColors[s.serial % balloonColors.length];
  s.serial++;
  s.targets.push({
    base, x: base, y: -r * 1.2, r, phase: Math.random() * tau,
    speed: .124 + Math.random() * .033 + .009 * s.age / duration,
    owner, color, touching: 0, lastNear: Array(s.count).fill(-Infinity), flashUntil: -1
  });
}

function showBalloon(ctx, x, y, r, angle, color) {
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(angle);
  ctx.lineWidth = Math.max(1.2,r*.045);
  ctx.beginPath();
  ctx.moveTo(0,r*1.05);
  ctx.bezierCurveTo(-r*.23,r*1.46,r*.37,r*1.51,r*.07,r*1.92);
  ctx.strokeStyle = 'rgba(39,68,70,.67)';
  ctx.stroke();
  polygon(ctx, [[0,r*.91],[-r*.13,r*1.13],[r*.15,r*1.13]],color,ink);
  ctx.beginPath();
  ctx.moveTo(0,r);
  ctx.bezierCurveTo(-r*.43,r*.9,-r,r*.32,-r,-r*.21);
  ctx.bezierCurveTo(-r,-r*1.49,r,-r*1.49,r,-r*.21);
  ctx.bezierCurveTo(r,r*.29,r*.44,r*.89,0,r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.stroke();
  ellipse(ctx,-r*.4,-r*.56,r*.14,r*.28,'rgba(255,255,255,.83)',null,.65);
  ellipse(ctx,-r*.57,-r*.23,r*.061,r*.07,'rgba(255,255,255,.78)');
  ctx.restore();
}

function showBubble(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  const film = ctx.createRadialGradient(-r * .2, -r * .24, r * .09, 0, 0, r);
  film.addColorStop(0, '#ffffff0b');
  film.addColorStop(.68, color + '25');
  film.addColorStop(.88, color + '75');
  film.addColorStop(1, '#ffffff95');
  ctx.lineWidth = Math.max(1.5, r * .12);
  ellipse(ctx, 0, 0, r, r, film, color);
  const rim = ctx.createLinearGradient(-r, -r, r, r);
  rim.addColorStop(0, '#fffaf3');
  rim.addColorStop(.23, '#a5f9ff');
  rim.addColorStop(.54, color);
  rim.addColorStop(.8, '#ffbee9');
  rim.addColorStop(1, '#fff5a7');
  ctx.lineWidth = Math.max(1, r * .047);
  ellipse(ctx, 0, 0, r * .91, r * .91, 'transparent', rim);
  ctx.beginPath();
  ctx.arc(0, 0, r * .76, Math.PI * 1.12, Math.PI * 1.43);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * .13);
  ctx.strokeStyle = '#fffffff0';
  ctx.stroke();
  ellipse(ctx, r * .48, r * .51, r * .16, r * .055, '#fff6e7bd', null, -.68);
  ctx.restore();
}

function wrongHit(s, target, id) {
  s.scores[id] -= 5;
  s.notes[id] = {at:s.age, text:'−5', color:'#ffd0ca'};
  target.flashUntil = s.age + .22;
  s.onSfx?.('wrong', id);
}

function burst(s, index, id) {
  const b = s.targets.splice(index,1)[0];
  if (!b) return;
  s.scores[id] += 10;
  s.notes[id] = {at:s.age,text:'+10',color:'#e4ffad'};
  for (let i = 0; i < 10; i++) {
    const a = tau*(i + Math.random()*.5)/10;
    const v = b.r * (2.4 + Math.random()*2.5);
    s.sparks.push({x:b.x,y:b.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,angle:a,color:i%3===0 ? paper:b.color,life:.52});
  }
  s.onSfx?.(s.skin === 'bubble' ? 'bubble' : 'balloon', id);
}

function nearBalloon(b, a, end, w, h) {
  const x = (b.x - a.x) * w, y = (b.y - a.y) * h;
  const dx = (end.x-a.x)*w, dy=(end.y-a.y)*h;
  const u = clamp((dx*x + dy*y)/(dx*dx + dy*dy || 1),0,1);
  return Math.hypot(x-u*dx,y-u*dy) / (Math.min(w,h)*b.r*1.23);
}

const limbs = ['leftHand','rightHand','leftFoot','rightFoot'];
function updateBalloonHands(s, frame) {
  const hands = [];
  for (const player of frame.players || []) {
    if (!Number.isInteger(player.id) || player.id < 0 || player.id >= s.count) continue;
    if (Number.isFinite(player.center?.x)) s.anchors[player.id] = player.center.x;
    for (const name of limbs.slice(0,s.points)) {
      const end = player[name];
      if (!end || end.score < .35 || !Number.isFinite(end.x) || !Number.isFinite(end.y)) continue;
      const key = player.id + name;
      const last = s.previous.get(key);
      const start = last && s.age-last.seen < .15 && Math.hypot(end.x-last.x,end.y-last.y) < .21 ? last : end;
      hands.push({id:player.id,start,end});
      s.previous.set(key,{x:end.x,y:end.y,seen:s.age});
    }
  }
  // A player's two hands or feet touching one target count as one contact.
  for (let i = s.targets.length-1; i>=0; i--) {
    const target = s.targets[i];
    let distance = 1, nearest = -1, hits = 0, near = 0, seen = 0;
    for (const hand of hands) {
      const bit = 1 << hand.id;
      const d = nearBalloon(target, hand.start, hand.end, frame.w, frame.h);
      seen |= bit;
      if (d < 1) hits |= bit;
      if (d < 1.20) near |= bit;
      if (d < distance) { distance = d; nearest = hand.id; }
    }
    if (!s.challenge) {
      if (nearest >= 0) burst(s, i, nearest);
      continue;
    }
    for (let id = 0; id < s.count; id++) {
      if (id === target.owner) continue;
      const bit = 1 << id;
      if ((hits & bit) && !(target.touching & bit)) {
        wrongHit(s, target, id);
        target.touching |= bit;
      }
      // A brief tracking loss or wobble at the rim must not charge a second time.
      if ((near & bit) || !(seen & bit)) target.lastNear[id] = s.age;
      else if (s.age - target.lastNear[id] >= .2) target.touching &= ~bit;
    }
    if (hits & (1 << target.owner)) burst(s, i, target.owner);
  }
}

function colorScoreStrip(ctx, w, h, s) {
  const size = clamp(Math.min(w, h) * .04, 12, 21);
  const gap = 5, height = size * 3.1;
  const cell = Math.min(size * 6.5, (w - gap * (s.count + 1)) / s.count);
  const left = (w - s.count * (cell + gap) + gap) / 2, y = h - height - gap;
  for (let id = 0; id < s.count; id++) {
    const x = left + id * (cell + gap), choice = s.assignments[id];
    const note = s.notes[id], recent = note && s.age - note.at < .75;
    ctx.lineWidth = 1.4;
    panel(ctx, x, y, cell, height, size * .64, recent ? note.color : paper, ink);
    ellipse(ctx, x + cell / 2 - size * 1.18, y + size * .89, size * .47, size * .47, choice.color, ink);
    label(ctx, id + 1, x + cell / 2 - size * 1.18, y + size * .91, size * .72, '#1c2331', 'center', 800);
    label(ctx, choice.name, x + cell / 2 + size * .45, y + size * .91, size * .86, ink, 'center');
    const score = s.scores[id] + '分';
    label(ctx, recent ? score + ' (' + note.text + ')' : score, x + cell / 2, y + size * 2.2,
      Math.min(size, cell / (recent ? 6.9 : 4)), ink, 'center');
  }
}

export const balloonGame = {
  start(options = {}) {
    balloons = Object.assign(newRound(options), {
      targets:[], sparks:[], previous:new Map(), anchors:[], next:.75, serial:0, w:1, h:1,
      skin: options.skin === 'bubble' ? 'bubble' : 'balloon'
    });
    balloons.challenge = balloons.count > 1 && options.colorChallenge === true;
    balloons.assignments = assignColors(balloons.count, options.playerColors);
    for (let i=0;i<balloons.count;i++) {
      balloons.anchors.push((i+.5)/balloons.count);
      spawnBalloon(balloons);
    }
  },
  update(frame) {
    const s = balloons;
    if (!s || s.finished) return;
    const dt = Math.max(0,frame.dt);
    s.age+=dt;
    if (s.age >= duration) { finish(s); return; }
    s.w=frame.w; s.h=frame.h;
    for (const b of s.targets) {
      b.y+=dt*b.speed;
      b.x=b.base+Math.sin(b.phase+s.age*1.6)*.023*Math.min(1,frame.h/frame.w);
    }
    s.targets = s.targets.filter(b=>b.y<1.15);
    updateBalloonHands(s,frame);
    s.next-=dt;
    if (s.next<=0) {
      const max = 3 + s.count * 2;
      if (s.targets.length < max) {
        spawnBalloon(s);
      }
      s.next=.98/Math.sqrt(s.count);
    }
    for (const p of s.sparks) {
      p.x+=p.vx*dt*Math.min(1,frame.h/frame.w);
      p.y+=p.vy*dt*Math.min(1,frame.w/frame.h);
      p.vy+=dt*.24;
      p.life-=dt;
    }
    s.sparks=s.sparks.filter(p=>p.life>0);
  },
  draw(ctx, {w,h,cameraVisible}) {
    const s=balloons;
    if (!s) return;
    ctx.save();
    if (!cameraVisible) fairground(ctx,w,h,s.age);
    const unit=Math.min(w,h);
    for (const b of s.targets) {
      const x = b.x * w, y = b.y * h, r = b.r * unit;
      if (s.skin === 'bubble') showBubble(ctx, x, y, r, b.color);
      else showBalloon(ctx, x, y, r, .1 * Math.sin(s.age * 1.7 + b.phase), b.color);
      if (s.challenge) {
        ctx.lineWidth = Math.max(1, r * .04);
        ellipse(ctx, x, y, r * .37, r * .37, '#fffdf2d9', ink);
        label(ctx, b.owner + 1, x, y + r * .02, r * .52, ink, 'center', 850);
        if (s.age < b.flashUntil) {
          ctx.lineWidth = Math.max(2, r * .08);
          ellipse(ctx, x, y, r * 1.17, r * 1.17, 'transparent', '#ad3449');
        }
      }
    }
    for (const p of s.sparks) {
      ctx.save(); ctx.globalAlpha=Math.min(1,p.life*3);
      ctx.translate(p.x*w,p.y*h); ctx.rotate(p.angle+p.life*5);
      ctx.fillStyle=p.color;
      if (s.skin === 'bubble') {
        ctx.lineWidth = Math.max(1, unit * .003);
        ellipse(ctx, 0, 0, unit * .009, unit * .009, '#ffffff38', p.color);
      } else ctx.fillRect(-unit*.007,-unit*.004,unit*.018,unit*.008);
      ctx.restore();
    }
    const size=clamp(unit*.046,16,26);
    const rules = s.challenge ? '碰对颜色 +10，碰错 −5' : '碰破' + (s.skin === 'bubble' ? '泡泡' : '气球') + '，得 10 分';
    const text=s.age<3 ? rules : `剩余 ${Math.max(0,Math.ceil(duration-s.age))} 秒`;
    ctx.font=font(size);
    const width=ctx.measureText(text).width+size*1.8;
    ctx.lineWidth=1.5;
    panel(ctx,(w-width)/2,Math.max(8,unit*.025),width,size*1.85,size,paper,ink);
    label(ctx,text,w/2,Math.max(8,unit*.025)+size*.925,size,s.age>duration-6?'#963327':ink,'center');
    if (s.challenge) colorScoreStrip(ctx, w, h, s);
    else scoreStrip(ctx,w,h,s);
    ctx.restore();
  },
  tap(x,y,id) {
    const s=balloons;
    if (!s || s.finished) return;
    const p={x,y};
    const owner = Number.isInteger(id) ? clamp(id,0,s.count-1) : clamp(Math.floor(x*s.count),0,s.count-1);
    let best=1, index=-1;
    s.targets.forEach((b,i)=>{
      const d=nearBalloon(b,p,p,s.w,s.h);
      if (d<best) {best=d; index=i;}
    });
    if (index >= 0) {
      const target = s.targets[index];
      if (s.challenge && target.owner !== owner) wrongHit(s, target, owner);
      else burst(s, index, owner);
    }
  },
  get scores() { return balloons?.scores.slice() || []; },
  stop() { balloons=null; }
};

export {runnerGame} from './runner.js';
