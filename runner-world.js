import {ellipse, polygon, sky} from './canvas-shapes.js';

export const scenes = [
  {name:'云端天空', road:['#ebe4ff','#f6edff'], edge:['#b9c8ff','#d9d9ff'], line:'#d4c5f1', wood:'#826d99', accent:'#ef98af',
    animals:['swallow','cockatiel','hummingbird'], props:['cloud','balloon']},
  {name:'萤光森林', road:['#e7be84','#efca91'], edge:['#84ad79','#b1c98d'], line:'#d8a96f', wood:'#886044', accent:'#ed9670',
    animals:['rabbit','fox','deer'], props:['mushroom','pine']},
  {name:'珊瑚海底', road:['#efcf9c','#f6dbaa'], edge:['#96ceb8','#bce7cd'], line:'#d8b988', wood:'#8a7574', accent:'#e6a2ac',
    animals:['clownfish','turtle','jellyfish'], props:['coral','kelp']}
];

// Each roadside pair has one animal and one prop. Make their identities and
// positions once so they stay in place as the perspective camera passes them.
export function createScenery() {
  return Array.from({length: 64}, () => {
    const animalSide = Math.random() < .5 ? 0 : 1;
    return [0, 1].map(side => {
      const animal = side === animalSide;
      return {
        animal, kind: Math.floor(Math.random() * (animal ? 3 : 2)),
        offset: 1.17 + Math.random() * .31,
        size: .66 + Math.random() * .24,
        phase: Math.random() * Math.PI * 2
      };
    });
  });
}

const tau = Math.PI * 2;
const outlines = new Map();
function shape(ctx, data, fill, outline, width = 2.1) {
  let path = outlines.get(data);
  if (!path) {
    path = new Path2D(data);
    outlines.set(data, path);
  }
  ctx.lineCap = ctx.lineJoin = 'round';
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}

function eye(ctx, x, y, size = 2.4) {
  ellipse(ctx,x,y,size,size*1.2,'#413b47');
  ellipse(ctx,x-size*.27,y-size*.35,size*.30,size*.30,'#fff5dc');
}

function cloud(ctx, x, y, r, fill) {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(r,r);
  shape(ctx,'M-1 .22 Q-1 .01 -.78 .02 Q-.78 -.23 -.49 -.19 Q-.36 -.63 -.02 -.47 Q.2 -.71 .42 -.34 Q.77 -.4 .8 -.09 Q1 -.12 1 .1 Q1 .25 .8 .26 L-.83 .29 Q-1 .29 -1 .22Z', fill);
  ctx.restore();
}

function skyWorld(ctx,w,h,horizon,age) {
  sky(ctx,w,h,'#77caf8','#ffe5df',.9);
  const unit = Math.min(w,h);
  const sx = w*.79, sy = horizon*.46;
  ellipse(ctx,sx,sy,unit*.094,unit*.094,'#fff4c5');
  ellipse(ctx,sx,sy,unit*.073,unit*.073,'#ffe29b');
  // A rainbow rises from a bank of clouds, well behind the road.
  ctx.save();
  ctx.translate(w*.17,horizon*.93);
  ctx.scale(unit,unit);
  for (const [i,color] of ['#f6aab9','#ffe4a1','#b7e1d0','#babaec'].entries()) {
    ctx.beginPath();
    ctx.arc(0,0,.205-i*.023,Math.PI,tau);
    ctx.lineWidth=.025;
    ctx.strokeStyle=color;
    ctx.stroke();
  }
  ctx.restore();
  for (let i=0;i<4;i++) {
    const x=(((i*.34+age*.004)%1.38)-.15)*w;
    cloud(ctx,x,horizon*(.28+.09*(i%3)),unit*(.078+.011*(i%3)),'#fffaf2');
  }
  for (let i=-1;i<6;i++) {
    cloud(ctx,w*(i*.25+.08),horizon+h*.052,Math.min(w*.25,h*.25),'#becfe9');
    cloud(ctx,w*(i*.25),horizon+h*.067,Math.min(w*.25,h*.23),'#eff4ff');
  }
  for (let i=0;i<4;i++) {
    const x = (((i*.37-age*.006+2)%1.42)-.18)*w;
    cloud(ctx,x,h*(.72+.15*(i%2)),unit*(.16+i*.014),'#ffedf3');
  }
}

function forestWorld(ctx,w,h,horizon,age) {
  sky(ctx,w,h,'#7bd2c3','#fff3ba',.68);
  const unit = Math.min(w,h);
  ellipse(ctx,w*.74,horizon*.52,unit*.075,unit*.075,'#fff4bb');
  for (let layer=0;layer<2;layer++) {
    const base=horizon+layer*h*.027, step=w*(layer?.13:.18);
    for (let i=-1;i<Math.ceil(w/step)+1;i++) {
      const x=(i+.31*layer)*step;
      const height=h*(.09+layer*.035+.09*Math.abs(Math.sin(i*2.7+layer*2.1)));
      polygon(ctx,[[x-step*.82,base],[x,base-height],[x+step*.82,base]], layer?'#78b5a2':'#a7cbb0');
    }
  }
  const ground=ctx.createLinearGradient(0,horizon,0,h);
  ground.addColorStop(0,'#b7db9b'); ground.addColorStop(1,'#7db695');
  ctx.fillStyle=ground;ctx.fillRect(0,horizon,w,h-horizon);
  for (let i=0;i<12;i++) {
    const x=((i*.618+Math.sin(age*.32+i)*.013+1)%1)*w;
    const y=horizon*(.5+.49*((i*.716)%1)) + Math.sin(age+i)*3;
    ellipse(ctx,x,y,unit*.008,unit*.008,'rgba(255,245,170,.3)');
    ellipse(ctx,x,y,unit*.003,unit*.003,'#fff4ad');
  }
}

function oceanWorld(ctx,w,h,horizon,age) {
  const unit=Math.min(w,h);
  sky(ctx,w,h,'#65dcd7','#317eac',.71);
  for(let i=0;i<4;i++) {
    const x=w*(i*.30-.16+Math.sin(age*.19+i)*.018);
    polygon(ctx,[[x,0],[x+w*.07,0],[x+w*.32,horizon*1.1],[x+w*.17,horizon*1.1]],'rgba(194,255,235,.16)');
  }
  // The rippled surface above and rolling sand below frame a submerged trail.
  ctx.strokeStyle='#b8eee0';ctx.lineWidth=Math.max(1,unit*.006);
  ctx.beginPath();
  for (let i=-1;i<9;i++) {
    const x=w*(i*.15+Math.sin(age*.25)*.018);
    ctx.moveTo(x,2);
    ctx.quadraticCurveTo(x+w*.047,unit*.027,x+w*.1,1);
  }
  ctx.stroke();
  for(let i=-1;i<8;i++) {
    const x=w*(i*.17+.03);
    ellipse(ctx,x,horizon,w*.14,h*(.032+.034*Math.abs(Math.cos(i*2.13))),'#558eaa');
  }
  const sand=ctx.createLinearGradient(0,horizon,0,h);
  sand.addColorStop(0,'#8bc8be');sand.addColorStop(1,'#cfdfbe');
  ctx.fillStyle=sand;ctx.fillRect(0,horizon,w,h-horizon);
  for(let i=0;i<15;i++) {
    const x=((i*.618+.023*Math.sin(age*.48+i)+1)%1)*w;
    const y=(1-((i*.412+age*(.035+i%3*.008))%1))*h*.93;
    const radius=unit*(.006+.003*(i%3));
    ctx.lineWidth=Math.max(.65,radius*.16);
    ellipse(ctx,x,y,radius,radius,'rgba(196,252,252,.08)','rgba(209,255,248,.62)');
    ellipse(ctx,x-radius*.32,y-radius*.4,radius*.2,radius*.12,'#d3f6e8',null,-.7);
  }
}

const backgrounds = [skyWorld, forestWorld, oceanWorld];
export function horizonScene(ctx,w,h,c,age,horizon) {
  backgrounds[c.scene](ctx,w,h,horizon,age);
}

function drawBird(ctx,kind) {
  const cockatiel=kind==='cockatiel', tiny=kind==='hummingbird';
  const edge=cockatiel?'#907651':tiny?'#458276':'#526e91';
  const back=cockatiel?'#f4d57c':tiny?'#53bfa1':'#6e99c9';
  const belly=cockatiel?'#fff1b9':tiny?'#a0e3ca':'#f5f2df';
  shape(ctx,'M-7 -21 L-45 -38 L-39 -23 L-48 -26 L-35 -13 L-7 -9Z',back,edge);
  shape(ctx,'M-28 -20 Q-27 -38 -10 -40 Q1 -42 12 -53 Q32 -62 39 -46 Q46 -25 24 -11 Q-4 6 -22 -8 Q-29 -13 -28 -20Z',back,edge);
  shape(ctx,'M-18 -10 Q-3 -9 12 -22 Q26 -35 38 -33 Q34 -20 23 -12 Q1 4 -18 -10Z',belly);
  if(cockatiel) shape(ctx,'M15 -50 Q11 -64 4 -70 Q19 -68 24 -54 Q23 -65 19 -69 Q32 -65 30 -52Z','#f6d075',edge,1.6);
  shape(ctx,'M-13 -26 Q-24 -45 -35 -52 Q-16 -52 -5 -38 Q-13 -51 -12 -58 Q3 -48 10 -34 Q12 -24 2 -21 Q-6 -18 -13 -26Z',cockatiel?'#f0c55e':tiny?'#63d2b8':'#96b8da',edge);
  shape(ctx,'M-18 -39 Q-9 -31 -3 -29',null,belly,2);
  polygon(ctx,tiny?[[37,-43],[59,-47],[37,-39]]:[[37,-44],[49,-40],[38,-36]],tiny?'#555d67':'#e99e58');
  eye(ctx,30,-44,2.5);
  ellipse(ctx,29,-37,cockatiel?5.4:3.5,cockatiel?4.2:2,'#e99a8d');
}

function drawGroundAnimal(ctx,kind) {
  const rabbit=kind==='rabbit', deer=kind==='deer';
  const fill=rabbit?'#fff0db':deer?'#dba77c':'#eaa16e';
  const edge=rabbit?'#927a78':'#886052';
  if(!rabbit && !deer) {
    shape(ctx,'M13 -15 Q36 -5 42 -34 Q52 -17 40 -7 Q30 4 10 -5Z','#e09a67',edge);
    shape(ctx,'M39 -15 Q42 -23 42 -33 Q50 -23 44 -15 L42 -17Z','#fff2d8');
  }
  ellipse(ctx,11,-20,22,20,fill,edge);
  if(rabbit) {
    ellipse(ctx,-27,-58,7,20,fill,edge,-.20);ellipse(ctx,-12,-59,7,21,fill,edge,.18);
    ellipse(ctx,-27,-59,3,13,'#e8b5b2',null,-.2);ellipse(ctx,-12,-60,3,13,'#e8b5b2',null,.18);
    ellipse(ctx,32,-20,8.6,8,'#fff9ec',edge);
  } else {
    if(deer) {
      shape(ctx,'M-11 -47 Q-22 -58 -17 -69 M-20 -59 L-25 -62 M-17 -65 L-11 -66 M-2 -47 Q7 -58 4 -67 M4 -59 L12 -61',null,edge,3.7);
    }
    shape(ctx,'M-31 -35 L-36 -55 Q-21 -55 -16 -42 M-11 -43 Q-2 -55 9 -55 L3 -35Z',fill,edge);
    shape(ctx,'M-30 -43 L-32 -51 L-22 -46 M-5 -44 L4 -50 L0 -42Z','#e5a694');
  }
  ellipse(ctx,-14,-36,23,20,fill,edge);
  if(!deer) shape(ctx,'M-36 -36 Q-28 -37 -17 -29 Q-13 -24 -8 -29 Q1 -35 7 -32 Q5 -19 -12 -16 Q-29 -15 -36 -36Z','#fff4df');
  eye(ctx,-23,-37);eye(ctx,-6,-37);
  ellipse(ctx,-15,-30,2.4,1.7,'#5d4f55');
  ellipse(ctx,-27,-32,3.4,1.6,'#e5a299');
  if(deer) for(const [x,y] of [[12,-27],[21,-30],[18,-22],[25,-24]]) ellipse(ctx,x,y,2,2,'#fff3db');
  ellipse(ctx,-1,-4,8.6,4.1,fill,edge);ellipse(ctx,19,-4,8.7,4.1,fill,edge);
}

function drawSeaAnimal(ctx,kind) {
  if(kind==='jellyfish') {
    shape(ctx,'M-21 -32 Q-29 -15 -18 -15 T-19 -3 M-2 -31 Q-10 -20 -1 -14 T-1 0 M16 -31 Q9 -18 17 -11 T16 -4',null,'#c3a3d3',4.5);
    shape(ctx,'M-29 -31 Q-31 -59 -8 -63 Q17 -71 28 -46 Q34 -31 27 -28 Q20 -25 15 -31 Q7 -22 0 -30 Q-8 -22 -15 -29 Q-22 -23 -29 -31Z','#edb2db','#a07eab');
    shape(ctx,'M-18 -47 Q-14 -56 -7 -56',null,'#ffe2ef',4);
    eye(ctx,-8,-40,2.2);eye(ctx,8,-40,2.2);
    ellipse(ctx,-14,-35,3.5,1.7,'#e591b7');ellipse(ctx,15,-35,3.5,1.7,'#e591b7');
  } else if(kind==='turtle') {
    shape(ctx,'M-16 -19 Q-39 -14 -39 -4 Q-31 -1 -11 -11 M4 -18 Q-2 -3 6 -1 Q14 -2 17 -16Z','#82baa0','#5e897c');
    ellipse(ctx,22,-26,13,10,'#b6d6a5','#608a79');
    shape(ctx,'M-37 -21 Q-31 -51 -7 -50 Q13 -52 22 -27 Q20 -19 8 -16 L-22 -15Z','#739e7c','#54816d');
    shape(ctx,'M-25 -25 L-17 -37 L-5 -40 L6 -31 L2 -22 L-12 -19Z','#a0bf85','#6d997a',1.4);
    eye(ctx,27,-28,2.2);ellipse(ctx,29,-23,2.9,1.3,'#dbab99');
  } else {
    shape(ctx,'M-18 -28 L-42 -43 Q-47 -31 -42 -11 L-21 -20Z','#ee945b','#9c6957');
    shape(ctx,'M-7 -37 Q-7 -53 4 -48 L17 -37Z','#f0a16a','#9c6957');
    ellipse(ctx,0,-27,31,19,'#f49861','#9c6957');
    shape(ctx,'M-19 -41 Q-23 -28 -18 -12 L-11 -9 Q-17 -29 -11 -44Z','#fff5d9','#ad795f',1);
    shape(ctx,'M6 -46 Q-1 -30 8 -9 L15 -11 Q8 -30 13 -44Z','#fff5d9','#ad795f',1);
    eye(ctx,21,-31,3);ellipse(ctx,24,-24,3.5,1.8,'#e28774');
  }
}

function drawProp(ctx,kind) {
  if(kind==='cloud') {
    cloud(ctx,0,-24,42,'#b9cbe6');cloud(ctx,0,-26,42,'#fcfdff');
    for(const side of [-1,1]) {
      eye(ctx,side*8,-25,1.5);ellipse(ctx,side*14,-21,3.7,1.4,'#efd6e1');
    }
  } else if(kind==='balloon') {
    shape(ctx,'M-15 -40 L-6 -14 M15 -40 L6 -14',null,'#917f93',2);
    shape(ctx,'M-8 -14 L8 -14 L6 -4 Q0 0 -6 -4Z','#d1a379','#987961',1.6);
    shape(ctx,'M-15 -39 Q-44 -69 -21 -90 Q4 -108 25 -87 Q43 -65 15 -39Z','#f5a8ad','#ac8594');
    shape(ctx,'M-4 -40 Q-17 -68 -5 -96 Q6 -101 12 -91 Q19 -67 5 -40Z','#ffe4b1');
  } else if(kind==='pine') {
    shape(ctx,'M-5 -41 L5 -41 L5 -1 L-5 -1Z','#b18d65','#78846a',1.6);
    shape(ctx,'M0 -103 Q6 -88 18 -74 L10 -75 Q17 -61 29 -48 L19 -49 Q27 -31 38 -21 Q2 -11 -35 -19 Q-23 -35 -18 -48 L-29 -46 Q-16 -63 -10 -75 L-19 -73Z','#70ab91','#538c7c');
    shape(ctx,'M1 -94 L6 -77 L3 -79 L13 -61 Q3 -65 -1 -62Z','#a5cd9c');
  } else if(kind==='mushroom') {
    shape(ctx,'M-8 -32 Q-10 -21 -11 -4 Q1 1 11 -4 L6 -31Z','#fff0cc','#aa8e70');
    shape(ctx,'M-34 -29 Q-20 -67 -2 -67 Q15 -69 34 -33 Q39 -23 3 -22 Q-32 -19 -34 -29Z','#e98b75','#a77462');
    for(const [x,y,r] of [[-15,-40,5],[0,-57,4],[17,-36,5]]) ellipse(ctx,x,y,r,r*.61,'#fff1cf');
  } else if(kind==='coral') {
    const twigs='M0 -3 Q-4 -27 -3 -61 M-3 -25 Q-24 -28 -22 -48 M-3 -38 Q17 -41 16 -60 M-19 -36 Q-32 -37 -32 -45 M16 -50 Q27 -51 27 -62 M-3 -51 Q-11 -52 -12 -66';
    shape(ctx,twigs,null,'#b57480',8);shape(ctx,twigs,null,'#edaa9d',5.4);
  } else {
    shape(ctx,'M-6 -2 Q-25 -28 -16 -46 Q-23 -33 -14 -29 Q-8 -23 -4 -13 Q-11 -38 1 -61 Q-5 -40 4 -34 Q9 -25 3 -10 Q23 -29 18 -45 Q33 -24 10 -2Z','#70bca0','#4d9f90');
  }
}

const sprites = new Map();
function sprite(kind) {
  if(sprites.has(kind)) return sprites.get(kind);
  const tile=document.createElement('canvas');
  tile.width=tile.height=176;
  const ctx=tile.getContext('2d');
  ctx.translate(87,164);ctx.scale(1.52,1.52);ctx.lineWidth=2.1;
  if(scenes[0].animals.includes(kind)) drawBird(ctx,kind);
  else if(scenes[1].animals.includes(kind)) drawGroundAnimal(ctx,kind);
  else if(scenes[2].animals.includes(kind)) drawSeaAnimal(ctx,kind);
  else drawProp(ctx,kind);
  sprites.set(kind,tile);
  return tile;
}

export function drawRoadside(ctx,w,h,c,age,view,distance) {
  const spacing=4.25, theme=scenes[c.scene], unit=Math.min(w,h);
  const first=Math.floor(distance/spacing);
  for(let row=7;row>=0;row--) {
    const depth=row*spacing-distance%spacing;
    if(depth<-.30) continue;
    const pair=c.scenery[(first+row)%c.scenery.length];
    for(let side=0;side<2;side++) {
      const sign=side*2-1, item=pair[side];
      const point=view.project(depth,sign*item.offset);
      const size=unit*point.scale*item.size;
      if(point.x+size*.5<0 || point.x-size*.5>w) continue;
      const kind=theme.props[item.kind % theme.props.length];
      const swing=Math.sin(age*(c.scene===1?3.6:2.5)+item.phase);
      const airborne=c.scene===0;
      const y=point.y-size*(airborne ? .26+.055*swing : 0);
      if(!airborne) ellipse(ctx,point.x,point.y,size*.22,Math.max(.5,size*.031),'rgba(55,87,83,.14)');
      ctx.save();
      ctx.translate(point.x,y);
      ctx.drawImage(sprite(kind),-size*87/176,-size*164/176,size,size);
      ctx.restore();
    }
  }
}

export function updateAmbientAnimals(c, dt, speed) {
  if (!c.passers) {
    c.passers = [];
    c.nextPasserAt = 1.2 + Math.random() * 1.8;
  }
  c.passerClock = (c.passerClock || 0) + dt;
  if (c.passerClock >= c.nextPasserAt && c.passers.length < 3) {
    c.nextPasserAt = c.passerClock + 2.1 + Math.random() * 3.2;
    const theme = scenes[c.scene];
    const side = Math.random() < .5 ? -1 : 1;
    const cross = Math.random() < .45;
    c.passers.push({
      kind: theme.animals[Math.floor(Math.random() * theme.animals.length)],
      side,
      z: cross ? 5.5 + Math.random() * 5.5 : 13 + Math.random() * 4,
      offset: cross ? side * (2.6 + Math.random() * .7) : side * (1.22 + Math.random() * .65),
      vz: cross ? -(speed * .62 + Math.random() * 1.4) : -(speed + 1.6 + Math.random() * 2.2),
      vx: cross ? -side * (.68 + Math.random() * .42) : side * (.08 - Math.random() * .16),
      size: .68 + Math.random() * .26,
      phase: Math.random() * tau,
      cross
    });
  }
  for (let i = c.passers.length - 1; i >= 0; i--) {
    const a = c.passers[i];
    a.z += a.vz * dt;
    a.offset += a.vx * dt;
    // Keep ambient animals beside the track so they never block the player.
    if (Math.abs(a.offset) < 1.12) a.offset = Math.sign(a.offset || a.side) * 1.12;
    if (a.z < -0.42 || Math.abs(a.offset) > 3.6) c.passers.splice(i, 1);
  }
}

export function drawAmbientAnimals(ctx, w, h, c, age, view) {
  if (!c.passers?.length) return;
  const unit = Math.min(w, h);
  const sorted = [...c.passers].sort((a, b) => b.z - a.z);
  for (const a of sorted) {
    if (a.z < -0.35) continue;
    const hop = Math.abs(Math.sin(age * (c.scene === 1 ? 8.5 : 4.2) + a.phase));
    const worldY = c.scene === 0 ? .55 + Math.sin(age * 3.5 + a.phase) * .22
      : c.scene === 2 ? .32 + Math.sin(age * 2.6 + a.phase) * .16
      : hop * .14;
    const point = view.project(a.z, a.offset, worldY);
    const size = unit * point.scale * a.size;
    if (point.x + size < 0 || point.x - size > w) continue;
    if (c.scene === 1) {
      const ground = view.project(a.z, a.offset, 0);
      ellipse(ctx, ground.x, ground.y, size * .22, Math.max(.5, size * .032), 'rgba(55,87,83,.16)');
    }
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.sin(age * 6 + a.phase) * (c.scene === 1 ? .06 : .08));
    const movingRight = a.cross ? a.vx > 0 : a.side < 0;
    const mirror = a.kind !== 'jellyfish' && (c.scene === 1 ? movingRight : !movingRight);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(sprite(a.kind), -size * 87 / 176, -size * 164 / 176, size, size);
    ctx.restore();
  }
}
