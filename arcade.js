// Both games use the same normalized, display-oriented coordinates as the tracker.
const ink = '#19282a';
const paper = '#fffdf3';
const playerColors = ['#d5f75a', '#ffb094', '#9adfff', '#dabaff'];
const balloonColors = ['#ff706c', '#fed34e', '#a091ff', '#4cd6bd', '#f58bcd', '#7ab7fa'];
const tau = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;

function label(ctx, value, x, y, size, color = ink, align = 'left', weight = 700) {
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function polygon(ctx, points, color, border) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.stroke();
  }
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), angle, 0, tau);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function panel(ctx, x, y, w, h, r, fill, stroke) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function sky(ctx, w, h, top, bottom, stop = 1) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h * stop);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
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

function scoreStrip(ctx, w, h, s, poised = []) {
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
    const color = active ? note.color : poised[id] ? '#e4ffad' : paper;
    panel(ctx, x, y, width, height, height / 2, color, ink);
    const r = height * .34;
    ellipse(ctx, x + height / 2, y + height / 2, r, r, playerColors[id], ink);
    label(ctx, id + 1, x + height / 2, y + height / 2, size * .9, ink, 'center', 850);
    const text = active ? note.text : poised[id] ? '就位' : s.scores[id] + '分';
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

function spawnBalloon(s, owner, initialY = .99) {
  const anchor = s.anchors[owner];
  const reach = s.count === 1 ? .28 : Math.min(.21, .72/s.count);
  const r = .046 + Math.random() * .015;
  const base = clamp(anchor + (Math.random() * 2 - 1) * reach, .085, .915);
  s.targets.push({
    base, x: base, y: initialY, r, phase: Math.random()*tau, speed: .092 + Math.random()*.042 + .009*s.age/duration,
    color: balloonColors[(s.serial++) % balloonColors.length]
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
  s.onSfx?.('pop');
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
  // Award overlapping contacts to the closest limb, regardless of tracker iteration order.
  for (let i = s.targets.length-1; i>=0; i--) {
    let distance = 1, id = -1;
    for (const hand of hands) {
      const d = nearBalloon(s.targets[i],hand.start,hand.end,frame.w,frame.h);
      if (d < distance) { distance=d; id=hand.id; }
    }
    if (id>=0) burst(s,i,id);
  }
}

export const balloonGame = {
  start(options = {}) {
    balloons = Object.assign(newRound(options), {
      targets:[], sparks:[], previous:new Map(), anchors:[], next:0, serial:0, w:1, h:1
    });
    for (let i=0;i<balloons.count;i++) {
      balloons.anchors.push((i+.5)/balloons.count);
      spawnBalloon(balloons,i,.45+Math.random()*.25);
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
      b.y-=dt*b.speed;
      b.x=b.base+Math.sin(b.phase+s.age*1.6)*.023*Math.min(1,frame.h/frame.w);
    }
    s.targets = s.targets.filter(b=>b.y>-.14);
    updateBalloonHands(s,frame);
    s.next-=dt;
    if (s.next<=0) {
      const max = 3 + s.count * 2;
      if (s.targets.length < max) {
        spawnBalloon(s,s.ownerNext || 0);
        s.ownerNext = ((s.ownerNext || 0)+1)%s.count;
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
  draw(ctx, {w,h}) {
    const s=balloons;
    if (!s) return;
    ctx.save();
    fairground(ctx,w,h,s.age);
    const unit=Math.min(w,h);
    for (const b of s.targets) showBalloon(ctx,b.x*w,b.y*h,b.r*unit,.1*Math.sin(s.age*1.7+b.phase),b.color);
    for (const p of s.sparks) {
      ctx.save(); ctx.globalAlpha=Math.min(1,p.life*3);
      ctx.translate(p.x*w,p.y*h); ctx.rotate(p.angle+p.life*5);
      ctx.fillStyle=p.color;
      ctx.fillRect(-unit*.007,-unit*.004,unit*.018,unit*.008);
      ctx.restore();
    }
    const size=clamp(unit*.046,16,26);
    const text=s.age<3 ? '碰到气球，得 10 分' : `剩余 ${Math.max(0,Math.ceil(duration-s.age))} 秒`;
    ctx.font=font(size);
    const width=ctx.measureText(text).width+size*1.8;
    ctx.lineWidth=1.5;
    panel(ctx,(w-width)/2,Math.max(8,unit*.025),width,size*1.85,size,paper,ink);
    label(ctx,text,w/2,Math.max(8,unit*.025)+size*.925,size,s.age>duration-6?'#963327':ink,'center');
    scoreStrip(ctx,w,h,s);
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
    if (index>=0) burst(s,index,owner);
  },
  get scores() { return balloons?.scores.slice() || []; },
  stop() { balloons=null; }
};

const stages = [
  {name:'松林晨跑',sky:['#77d7ef','#fff2ca'],sun:'#fff6bb',far:'#a4c7bc',near:'#69988d',ground:'#b5d995',edge:'#78a67d',road:['#c5b699','#c9bba0'],stripe:'#fff6cb',actions:['jump','left','duck','right']},
  {name:'落日峡谷',sky:['#ffac8d','#ffe6a9'],sun:'#fff295',far:'#dc9d84',near:'#bd775d',ground:'#e7bb80',edge:'#c18d62',road:['#b98e72','#c19678'],stripe:'#fff0bd',actions:['duck','right','jump','left']},
  {name:'星光之城',sky:['#293668','#9a96d2'],sun:'#fff2ce',far:'#7b7daf',near:'#555f8c',ground:'#666a8d',edge:'#8e88b5',road:['#4f536e','#555971'],stripe:'#dcd1f4',actions:['left','duck','right','jump']}
];
const actionNames = {jump:'跳起来',duck:'蹲下来',left:'向左移',right:'向右移'};
const pointValue = 15;
const totalGates=stages.reduce((n,s)=>n+s.actions.length,0);
const moveNames = Object.keys(actionNames);
let run;

function gateInterval(stage) { return [3.9,3.6,3.3][stage]; }

function prepareGate(s) {
  const stageIndex = Math.floor(s.index/4);
  s.stage = stageIndex;
  s.kind = stages[stageIndex].actions[s.index%4];
  s.interval = gateInterval(stageIndex);
  s.impact = s.age + s.interval;
  s.judged = false;
}

function stamp(s, id, name) {
  if (id >= 0 && id < s.count && moveNames.includes(name)) s.moves[id][name] = s.age;
}

function ready(s,id) {
  const elapsed = s.age - s.moves[id][s.kind];
  return elapsed < (s.kind === 'jump' ? .82 : .65);
}

function judgeGate(s) {
  s.judged = true;
  let successes=0;
  for (let id=0;id<s.count;id++) {
    if (ready(s,id)) {
      s.scores[id]+=pointValue;
      s.notes[id]={at:s.age,text:'+15',color:'#daff9c'};
      successes++;
    } else {
      s.notes[id]={at:s.age,text:'错过',color:'#ffc2ad'};
    }
  }
  s.lastResult={at:s.age,success:successes>0};
  if (successes) s.cleared++;
  s.onSfx?.(successes ? 'clear':'miss');
}

function drawPine(ctx,x,y,size) {
  ctx.fillStyle='#486d65';
  ctx.fillRect(x-size*.045,y-size*.25,size*.09,size*.25);
  for (let i=0;i<3;i++) {
    const base=y-size*(.13+i*.19), half=size*(.32-i*.067);
    polygon(ctx,[[x-half,base],[x,base-size*.5],[x+half,base]],['#487c6f','#568a76','#719d7f'][i]);
  }
}

function drawCactus(ctx,x,y,size,flip) {
  ctx.save(); ctx.translate(x,y); ctx.scale(flip*size,size);
  ctx.strokeStyle='#54846d'; ctx.lineWidth=.12; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-.88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-.35); ctx.lineTo(-.18,-.40); ctx.lineTo(-.18,-.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-.52); ctx.lineTo(.18,-.58); ctx.lineTo(.18,-.76); ctx.stroke();
  ctx.lineWidth=.022; ctx.strokeStyle='#a8c791';
  ctx.beginPath(); ctx.moveTo(-.018,-.07); ctx.lineTo(-.018,-.85); ctx.stroke();
  ctx.restore();
}

function skyline(ctx,w,h,horizon) {
  const step=Math.max(20,w/22);
  for (let level=0;level<2;level++) {
    for (let i=-1;i<=Math.ceil(w/step)+1;i++) {
      const x=i*step+(level===0?0:step*.45);
      const v=(Math.sin(i*155.31+level*74.3)*438.78)%1;
      const height=h*(.035+Math.abs(v)*(.14-level*.04));
      ctx.fillStyle=level===0?'#717aa9':'#4d5a82';
      ctx.fillRect(x,horizon-height,step*.86,height+2);
      if (i%3===0) {
        ctx.fillRect(x+step*.36,horizon-height-h*.015,step*.12,h*.02);
      }
      if (level===1) {
        ctx.fillStyle='#eba893';
        for (let j=1;j<4;j++) {
          for (let k=1; k<=Math.min(9,Math.floor(height/8)); k++) {
            if ((i+2*j+k)%3===0) continue;
            ctx.fillRect(x+step*.17*j,horizon-height+k*7,Math.max(1.4,step*.055),2);
          }
        }
      }
    }
  }
}

function landscape(ctx,w,h,s,horizon) {
  const theme=stages[s.stage], unit=Math.min(w,h);
  sky(ctx,w,h,...theme.sky,horizon/h);
  if (s.stage===2) {
    for (let i=0;i<30;i++) {
      const x=((i*.61803+.12)%1)*w, y=((i*.371+.13)%1)*horizon*.84;
      ellipse(ctx,x,y,unit*.002,unit*.002,'#f3e5ef');
    }
  }
  const sunY=horizon-h*(s.stage===1 ? .085:.15);
  ellipse(ctx,w*.76,sunY,unit*.076,unit*.076,theme.sun);
  if (s.stage===2) {
    skyline(ctx,w,h,horizon);
  } else if (s.stage===0) {
    for(let level=0;level<2;level++) {
      const base=horizon+h*.02;
      const width=w*(level ? .41:.34);
      for (let i=-1;i<5;i++) {
        const x=width*(i+(level?.52:.1));
        const rise=h*((level?.078:.14)+Math.sin(i*3.3+.5)*.043);
        polygon(ctx,[[x-width*.58,base],[x,base-rise],[x+width*.63,base]],level?theme.near:theme.far);
        if (!level) {
          polygon(ctx,[[x-width*.11,base-rise*.81],[x,base-rise],[x+width*.13,base-rise*.79],[x+width*.045,base-rise*.86],[x-width*.01,base-rise*.81],[x-width*.05,base-rise*.86]],'#f0f2d9');
        }
      }
    }
  } else {
    for (let level=0;level<2;level++) {
      const width=w*(level ? .48:.36);
      for(let i=-1;i<5;i++) {
        const x=width*(i+(level?.35:.14)), base=horizon+1;
        const rise=h*(.055+Math.abs(Math.sin(i*2.17+level))*(level?.073:.13));
        polygon(ctx,[[x-width*.6,base],[x-width*.37,base-rise*.3],[x-width*.24,base-rise*.35],[x-width*.18,base-rise],[x+width*.12,base-rise],[x+width*.19,base-rise*.55],[x+width*.31,base-rise*.54],[x+width*.52,base]],level?theme.near:theme.far);
      }
    }
  }
  ctx.fillStyle=theme.ground;
  ctx.fillRect(0,horizon,w,h-horizon);
}

function roadGeometry(w,h,s) {
  const horizon=h*(.405+Math.sin(s.age*8.7)*.002);
  const eyeHeight=1-s.head*.37;
  const span = Math.max(w*.83, Math.min(w,h)*1.14);
  const project=(z,offset=0)=>{
    const p=1/(1+Math.max(-.4,z)*1.05);
    return {
      x:w*.5+p*span*(offset-s.lean*.66),
      y:horizon+p*(h-horizon)*1.08*eyeHeight,
      scale:p
    };
  };
  return {horizon,project,span};
}

function roadSegment(ctx,project,a,b,left,right,color) {
  const p=project(a,left), q=project(a,right), r=project(b,right), v=project(b,left);
  polygon(ctx,[[p.x,p.y],[q.x,q.y],[r.x,r.y],[v.x,v.y]],color);
}

function drawCourse(ctx,w,h,s,g) {
  const {project,horizon}=g;
  const theme=stages[s.stage], unit=Math.min(w,h);
  const roadLeft=project(-.35,-1),roadRight=project(-.35,1);
  polygon(ctx,[[w*.5,horizon],[roadRight.x,roadRight.y],[roadLeft.x,roadLeft.y]],theme.road[0]);
  const phase=(s.age*5.8)%1;
  for(let i=45;i>=0;i--) {
    const a=Math.max(-.35,i-phase), b=i+1-phase;
    if (b<=-.35) continue;
    const band=i+Math.floor(s.age*5.8);
    if (band%2===0) {
      roadSegment(ctx,project,a,b,-1,1,theme.road[1]);
      roadSegment(ctx,project,a,b,-1.052,-1,theme.edge);
      roadSegment(ctx,project,a,b,1,1.052,theme.edge);
    }
    if (band%3!==0) {
      for (const x of [-1/3,1/3]) roadSegment(ctx,project,a,b,x-.008,x+.008,theme.stripe);
    }
  }
  for(let i=12;i>=0;i--) {
    const z=i*3.6-((s.age*5.8)%3.6);
    if (z<-.25) continue;
    for(const sign of [-1,1]) {
      const seq=i+Math.floor(s.age*5.8/3.6)+(sign===1?2:0);
      const v=Math.sin(seq*94.7)*.5+.5;
      const pos=project(z,sign*(1.22+v*.52));
      const size=unit*pos.scale*(.83+v*.32);
      if(pos.x+size*.5<0 || pos.x-size*.5>w) continue;
      ellipse(ctx,pos.x,pos.y,size*.24,Math.max(.4,size*.034),'rgba(42,54,60,.16)');
      if(s.stage===0) drawPine(ctx,pos.x,pos.y,size);
      else if(s.stage===1) drawCactus(ctx,pos.x,pos.y,size*.85,sign);
      else {
        ctx.strokeStyle='#39405c'; ctx.lineWidth=Math.max(.75,size*.035);
        ctx.beginPath(); ctx.moveTo(pos.x,pos.y);ctx.lineTo(pos.x,pos.y-size*.88);
        ctx.lineTo(pos.x-sign*size*.16,pos.y-size*.99);ctx.lineTo(pos.x-sign*size*.29,pos.y-size*.99);ctx.stroke();
        ellipse(ctx,pos.x-sign*size*.29,pos.y-size*.974,size*.079,size*.018,'#ffdf9e');
      }
    }
  }
}

function barrier(ctx,x,y,width,height) {
  ctx.fillStyle='#faac51'; ctx.fillRect(x,y,width,height);
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,width,height); ctx.clip();
  for(let stripe=x-height; stripe<x+width; stripe+=height*2.5) {
    polygon(ctx,[[stripe,y+height],[stripe+height*.9,y],[stripe+height*1.7,y],[stripe+height*.8,y+height]],'#38434a');
  }
  ctx.restore();
  ctx.strokeStyle='#344244'; ctx.lineWidth=Math.max(.8,Math.min(3,height*.09));
  ctx.strokeRect(x,y,width,height);
}

function drawGate(ctx,w,h,s,g) {
  const remaining=s.impact-s.age;
  if (remaining<-.15) return;
  const z=remaining*2.8;
  const size=Math.min(w,h);
  const bounds=s.kind==='left'?[-.32,.94]:s.kind==='right'?[-.94,.32]:[-.96,.96];
  const lo=g.project(z,bounds[0]), hi=g.project(z,bounds[1]);
  const scale=lo.scale, width=hi.x-lo.x, base=lo.y;
  ellipse(ctx,(lo.x+hi.x)/2,base,width*.54,Math.max(.7,size*.019*scale),'rgba(32,44,47,.22)');
  const tall=s.kind==='duck';
  const height=scale*(tall?Math.max(size*.84,h*.56):size*(s.kind==='jump'?.17:.44));
  const post=Math.max(1.1,scale*size*.026);
  for (const x of [lo.x+post,hi.x-post*2]) {
    ctx.fillStyle='#3a4948'; ctx.fillRect(x,base-height,post,height);
    ctx.fillStyle='#e6dabe'; ctx.fillRect(x+post*.2,base-height,post*.25,height);
  }
  const barHeight=Math.max(1.5,scale*size*(tall?.105:.078));
  barrier(ctx,lo.x,base-height,width,barHeight);
  if(s.kind==='left' || s.kind==='right') {
    barrier(ctx,lo.x,base-height*.54,width,barHeight*.72);
    const clear=g.project(z,s.kind==='left'?-.65:.65);
    ellipse(ctx,clear.x,base-height*.1,width*.19,barHeight*.26,'rgba(183,255,103,.78)');
  }
}

function moveIcon(ctx,x,y,size,kind) {
  const rotation={left:-Math.PI/2,right:Math.PI/2,jump:0,duck:Math.PI}[kind];
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(size,size);
  ctx.lineWidth=.13; ctx.lineCap='round'; ctx.lineJoin='round';ctx.strokeStyle=ink;
  ctx.beginPath();ctx.moveTo(0,.36);ctx.lineTo(0,-.32);ctx.moveTo(-.29,-.05);ctx.lineTo(0,-.34);ctx.lineTo(.29,-.05);ctx.stroke();
  ctx.restore();
}

function runHud(ctx,w,h,s) {
  const unit=Math.min(w,h), size=clamp(unit*.042,14,24);
  const margin=Math.max(9,unit*.029), barWidth=Math.max(size*10.1,Math.min(w*.55,290));
  ctx.lineWidth=1.4;
  panel(ctx,margin,margin,barWidth,size*2.95,size*.64,paper,ink);
  label(ctx,stages[s.stage].name,margin+size*.8,margin+size*.95,size,ink);
  label(ctx,`${s.index+1} / ${totalGates}`,margin+barWidth-size*.72,margin+size*.95,size*.94,ink,'right');
  label(ctx,`本关已过 ${s.cleared} 道 · 需过 2 道`,margin+size*.8,margin+size*2.12,size*.88,ink);
  const pulse=clamp(1-(s.impact-s.age)/s.interval,0,1);
  const cueSize=clamp(unit*.07,23,44), cueW=cueSize*5.5, cueH=cueSize*2.18;
  const x=(w-cueW)/2, y=margin+size*3.36;
  const made=s.judged && s.lastResult;
  const sceneOver = made && s.index%4 === 3;
  const text=sceneOver ? (s.cleared>=2?'过关':'闯关失败') : made ? (made.success?'通过':'错过') : actionNames[s.kind];
  const actNow=s.impact-s.age<.64;
  const success=sceneOver ? s.cleared>=2 : made?.success;
  const cueColor=made?(success?'#daff9c':'#ffd1bc'):actNow?'#e1f98e':paper;
  panel(ctx,x,y,cueW,cueH,cueSize*.48,cueColor,ink);
  moveIcon(ctx,x+cueSize*.86,y+cueSize*.95,cueSize*.87,s.kind);
  const timing=made ? (sceneOver ? '本关结果' : '动作判定') : actNow ? '现在做！' : '准备动作';
  label(ctx,timing,x+cueSize*1.62,y+cueSize*.49,Math.max(11,cueSize*.45),ink);
  label(ctx,text,x+cueSize*1.62,y+cueSize*1.24,cueSize*.78,ink,'left',800);
  const bx=x+cueSize*.51, by=y+cueH-cueSize*.39, bw=cueW-cueSize*1.02, bh=cueSize*.13;
  panel(ctx,bx,by,bw,bh,bh/2,'#d6d9cc');
  panel(ctx,bx,by,Math.max(bh,bw*pulse),bh,bh/2,ink);
  const poised = s.moves.map((_,id)=>!s.judged && actNow && ready(s,id));
  scoreStrip(ctx,w,h,s,poised);
}

export const runnerGame = {
  start(options = {}) {
    const s=newRound(options);
    run=Object.assign(s,{index:0,stage:0,cleared:0,moves:[],lean:0,head:0,lastResult:null});
    for(let id=0;id<s.count;id++) s.moves.push({left:-Infinity,right:-Infinity,jump:-Infinity,duck:-Infinity});
    prepareGate(s);
  },
  update(frame) {
    const s=run;
    if(!s || s.finished) return;
    const dt=Math.max(0,frame.dt);
    s.age+=dt;
    for(const p of frame.players || []) {
      if(!Number.isInteger(p.id) || !p.gestures) continue;
      for(const name of moveNames) if(p.gestures[name]) stamp(s,p.id,name);
    }
    const first=s.moves[0];
    const active=name=>s.age-first[name]<(name==='jump'?.62:.48);
    const factor=1-Math.exp(-dt*8);
    const lean=s.count===1 ? Number(active('right'))-Number(active('left')):0;
    const head=s.count===1 ? Number(active('duck'))-Number(active('jump')):0;
    s.lean=lerp(s.lean,lean,factor); s.head=lerp(s.head,head,factor);
    if(!s.judged && s.age >= s.impact+.10) judgeGate(s);
    const endOfScene = s.index%4 === 3;
    const resultSeconds = endOfScene ? 1.55 : .83;
    if(s.judged && s.age>=s.impact+resultSeconds) {
      if (endOfScene && (s.cleared<2 || s.index+1===totalGates)) {
        finish(s,{completed:s.cleared>=2,stageName:stages[s.stage].name,cleared:s.cleared});
        return;
      }
      s.index++;
      if (endOfScene) s.cleared=0;
      prepareGate(s);
    }
  },
  draw(ctx,{w,h}) {
    const s=run;
    if(!s) return;
    ctx.save();
    const g=roadGeometry(w,h,s);
    landscape(ctx,w,h,s,g.horizon);drawCourse(ctx,w,h,s,g);drawGate(ctx,w,h,s,g);runHud(ctx,w,h,s);
    ctx.restore();
  },
  action(id,name) {
    if(!run || run.finished || !Number.isInteger(id)) return;
    stamp(run,id,name);
  },
  get scores() { return run?.scores.slice() || []; },
  stop() { run=null; }
};
