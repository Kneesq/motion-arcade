import {polygon, ellipse, panel, sky} from './canvas-shapes.js';

// Camera gestures and touch input use the same player IDs and scoring windows.
const ink = '#343044';
const paper = '#fffdf3';
const playerColors = ['#d5f75a', '#ffac91', '#91d8ff', '#dcafff'];
const tau = 2 * Math.PI;
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
const font = (size, weight = 700) => `${weight} ${size}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;

function label(ctx, value, x, y, size, color = ink, align = 'left', weight = 700) {
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

const scenes = [
  {name:'蘑菇森林', sky:['#87e1f0','#fff0cc'], haze:'#b7e3b8', hill:'#91ca9d', grass:'#c0e693', road:['#f1c789','#f4cc93'], edge:['#ec8a74','#fff4ce'], line:'#fff0c1', wood:'#af6755', accent:'#ff807c'},
  {name:'布丁糖谷', sky:['#ffbba4','#ffebc4'], haze:'#f2bca8', hill:'#e2a08b', grass:'#f0ce9d', road:['#e9bda9','#edc7b2'], edge:['#eb8cac','#fff4d7'], line:'#fff3d7', wood:'#9f665a', accent:'#ef91ba'},
  {name:'月兔星城', sky:['#494779','#b6a5dc'], haze:'#9a8fc1', hill:'#827bb0', grass:'#aaa2c9', road:['#8281a7','#8988b1'], edge:['#e9bbcc','#fbe6be'], line:'#ece3f5', wood:'#66557e', accent:'#ae95e1'}
];
const actionLabels = {left:'向左移', right:'向右移', jump:'跳起来', duck:'蹲下来'};
const gateOrders = [
  ['jump','left','duck','right','duck','right','jump','left','left','duck','right','jump'],
  ['right','duck','left','jump','left','jump','right','duck','duck','right','jump','left']
];
const rounds = 12;
let game;

function newPlayer(id) {
  return {id, score:0, gates:0, coins:0, stars:0, note:null,
    moves:{left:-Infinity, right:-Infinity, jump:-Infinity, duck:-Infinity}};
}

function makeCourse(ids, variant) {
  const course = {ids, variant, index:0, cleared:0, stage:0, lean:0, head:0, done:false};
  nextEvents(course, 0);
  return course;
}

function nextEvents(c, start) {
  const slot = c.index % 4;
  const timing = [0,.24,-.17,.08][(slot + 2*c.variant) % 4];
  c.stage = Math.floor(c.index / 4);
  c.scene = (c.stage + c.variant) % scenes.length;
  c.start = start;
  c.gateAt = start + 4.65 - .2*c.stage + timing;
  c.pickAt = start + 2.02 + .12*c.variant + .45*timing;
  c.kind = gateOrders[c.variant][c.index];
  const star = (c.index + c.variant) % 2 === 1;
  const right = (Math.floor(c.index / 2) + c.variant) % 2 === 1;
  c.pick = {star, move:star ? 'jump' : right ? 'right' : 'left', lane:star ? 0 : right ? 1 : -1};
  c.pickResult = null;
  c.gateResult = null;
}

function active(player, move, age) {
  return age - player.moves[move] < (move === 'jump' ? .85 : .72);
}

function lane(player, age) {
  const left = active(player,'left',age), right = active(player,'right',age);
  if (left && right) return Math.sign(player.moves.right - player.moves.left);
  return Number(right) - Number(left);
}

function matches(player, move, age) {
  if (move === 'left') return lane(player,age) === -1;
  if (move === 'right') return lane(player,age) === 1;
  return active(player,move,age);
}

function scoreEvent(s, c, pickup) {
  const move = pickup ? c.pick.move : c.kind;
  const points = pickup ? (c.pick.star ? 10 : 5) : 15;
  const amountKey = pickup ? (c.pick.star ? 'stars' : 'coins') : 'gates';
  const winners = [];
  for (const id of c.ids) {
    const player = s.players[id];
    const inLane = !pickup || !c.pick.star || lane(player,s.age) === 0;
    if (inLane && matches(player,move,s.age)) {
      player.score += points;
      player[amountKey]++;
      player.note = {at:s.age, label:'+' + points, yes:true};
      winners.push(id);
    } else {
      player.note = {at:s.age, label:'错过', yes:false};
    }
  }
  const event = {at:s.age, winners};
  if (pickup) {
    c.pickResult = event;
  } else {
    c.gateResult = event;
    if (winners.length) c.cleared++;
  }
  if (winners.length) s.onSfx?.(pickup ? c.pick.star ? 'star' : 'coin' : 'clear');
  else if (!pickup) s.onSfx?.('miss');
}

function progressCourse(s,c,dt) {
  if (c.done) return;
  const player = s.players[c.ids[0]];
  const steer = c.ids.length === 1;
  const blend = 1 - Math.exp(-dt * 8);
  const targetLane = steer ? lane(player,s.age) : 0;
  const targetHead = steer ? Number(active(player,'duck',s.age))-Number(active(player,'jump',s.age)) : 0;
  c.lean += (targetLane-c.lean)*blend;
  c.head += (targetHead-c.head)*blend;
  if (!c.pickResult && s.age >= c.pickAt+.12) scoreEvent(s,c,true);
  if (!c.gateResult && s.age >= c.gateAt+.12) scoreEvent(s,c,false);
  const lastInScene = c.index % 4 === 3;
  if (!c.gateResult || s.age < c.gateAt + (lastInScene ? 1.3 : .85)) return;
  if (c.index === rounds-1 || (!s.versus && lastInScene && c.cleared < 2)) {
    c.done = true;
    return;
  }
  c.index++;
  if (lastInScene) c.cleared = 0;
  nextEvents(c,s.age);
}

function finish(s) {
  s.finished = true;
  const scores = s.players.map(p=>p.score);
  const stats = s.players.map(({score,gates,coins,stars})=>({score,gates,coins,stars}));
  const track = s.courses[0];
  const tie = s.versus && scores[0] === scores[1];
  s.onSfx?.('finish');
  s.onFinish?.(scores, {
    mode:s.versus ? 'versus' : 'coop', completed:s.versus || track.cleared >= 2,
    stageName:scenes[track.stage].name, cleared:track.cleared, stats,
    winner:s.versus && !tie ? Number(scores[1]>scores[0]) : null, tie
  });
}

function stroke(ctx, coordinates, width, color) {
  ctx.lineWidth=width;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.strokeStyle=color;
  ctx.beginPath();
  ctx.moveTo(...coordinates[0]);
  for (const point of coordinates.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
}

function smile(ctx,x,y,size, sleepy=false) {
  if (size < 4) return;
  for (const sign of [-1,1]) {
    const ex=x+sign*size*.29;
    if (sleepy) stroke(ctx,[[ex-size*.07,y],[ex,y+size*.035],[ex+size*.07,y]],size*.045,'#624b5b');
    else ellipse(ctx,ex,y,size*.054,size*.09,'#624b5b');
    ellipse(ctx,x+sign*size*.44,y+size*.13,size*.09,size*.044,'#ed9f9e');
  }
  ctx.beginPath();
  ctx.moveTo(x-size*.095,y+size*.14);
  ctx.quadraticCurveTo(x,y+size*.25,x+size*.095,y+size*.14);
  ctx.lineWidth=Math.max(.8,size*.044);ctx.strokeStyle='#775361';ctx.stroke();
}

function starShape(ctx,x,y,r,fill,outline,angle=0) {
  const vertices=[];
  for (let i=0;i<10;i++) {
    const a=-Math.PI/2+i*Math.PI/5+angle;
    const size=r*(i%2===0 ? 1 : .53);
    vertices.push([x+Math.cos(a)*size,y+Math.sin(a)*size]);
  }
  ctx.lineJoin='round';
  polygon(ctx,vertices,fill,outline);
}

function puff(ctx,x,y,r,color) {
  ellipse(ctx,x-r*.49,y+r*.1,r*.59,r*.32,color);
  ellipse(ctx,x-r*.01,y-r*.09,r*.52,r*.48,color);
  ellipse(ctx,x+r*.48,y+r*.05,r*.48,r*.36,color);
  ellipse(ctx,x,y+r*.2,r*.8,r*.2,color);
}

function horizonScene(ctx,w,h,c,age,horizon) {
  const theme=scenes[c.scene], unit=Math.min(w,h);
  sky(ctx,w,h,...theme.sky,horizon/h);
  if (c.scene===2) {
    for (let i=0;i<20;i++) {
      const x=((i*.618+.05)%1)*w, y=((i*.372+.17)%1)*horizon*.84;
      starShape(ctx,x,y,unit*(.004+(i%3)*.002),'#fff2cc');
    }
  } else {
    for (let i=0;i<3;i++) {
      const x=(((i*.41+age*.003+c.variant*.19)%1.28)-.11)*w;
      puff(ctx,x,horizon*(.32+.15*(i%2)),unit*(.07+i*.013),'#fffbed');
    }
  }
  const sx=w*(c.variant ? .25 : .76),sy=horizon*.56,sr=unit*.076;
  ellipse(ctx,sx,sy,sr,sr,c.scene===2?'#ffe7a8':'#ffeb9b');
  smile(ctx,sx,sy+sr*.05,sr*.87,c.scene===2);
  for (let level=0;level<2;level++) {
    const width=w*(level ? .32 : .42);
    for (let i=-1;i<6;i++) {
      const x=width*(i+(level ? .62 : .13)), base=horizon+h*.055;
      const rise=h*(.082+Math.abs(Math.sin(i*1.73+level))*.07);
      if(c.scene===2) {
        const bw=width*.65;
        panel(ctx,x-bw/2,base-rise,bw,rise+bw*.1,bw*.13,level?theme.hill:theme.haze);
        polygon(ctx,[[x-bw*.55,base-rise],[x,base-rise-bw*.37],[x+bw*.55,base-rise]],level?'#ab8fbb':'#c6aacf');
        for(const side of [-1,1]) ellipse(ctx,x+side*bw*.21,base-rise*.67,bw*.055,bw*.08,'#ffe7b3');
      } else {
        ellipse(ctx,x,base,width*.68,rise,level?theme.hill:theme.haze);
        if (c.scene===1 && level===0) {
          ellipse(ctx,x,base-rise*.83,width*.39,rise*.25,'#f8ceb4');
          ellipse(ctx,x+width*.07,base-rise*1.07,rise*.09,rise*.09,'#eb9a91');
        }
      }
    }
  }
  ctx.fillStyle=theme.grass;
  ctx.fillRect(0,horizon,w,h-horizon);
}

// Roadside toys are drawn once. Each race view can reuse these small sprites.
const toySprites = new Map();
function paintToy(ctx,kind) {
  const shade='#805e61';
  ctx.lineWidth=2.4;
  if (kind===0) {
    panel(ctx,-23,-58,46,58,18,'#fff1d1',shade);
    smile(ctx,0,-24,27);
    ctx.beginPath();ctx.moveTo(-43,-48);
    ctx.bezierCurveTo(-45,-62,-23,-98,2,-97);
    ctx.bezierCurveTo(24,-96,43,-67,45,-51);
    ctx.bezierCurveTo(44,-36,-42,-35,-43,-48);
    ctx.fillStyle='#f5877c';ctx.fill();ctx.strokeStyle=shade;ctx.stroke();
    for (const [x,y,r] of [[-24,-60,8],[2,-82,7],[26,-58,6],[-8,-48,4]]) {
      ellipse(ctx,x,y,r,r*.69,'#fff2cc');
    }
  } else if(kind===1) {
    panel(ctx,-6,-60,12,61,5,'#b78764',shade);
    ellipse(ctx,0,-66,30,31,'#82b9a0',shade);
    ellipse(ctx,-19,-49,21,24,'#a5d6ad');
    ellipse(ctx,17,-49,23,25,'#a5d6ad');
    ellipse(ctx,0,-64,26,27,'#b1dfae');
    smile(ctx,0,-52,29);
    ellipse(ctx,-13,-78,8,4,'#dbefc2',null,-.4);
  } else if(kind===2 || kind===8) {
    const bunny=kind===2;
    const fill=bunny?'#fff1cf':'#ccbbef';
    for(const side of [-1,1]) {
      if(bunny) {
        ellipse(ctx,side*14,-66,8,23,fill,shade,side*.14);
        ellipse(ctx,side*14,-68,3.5,14,'#f4b5b2',null,side*.14);
      } else {
        polygon(ctx,[[side*30,-42],[side*25,-79],[side*6,-62]],fill,shade);
        polygon(ctx,[[side*24,-53],[side*23,-69],[side*14,-61]],'#eeadc5');
      }
    }
    ellipse(ctx,0,-32,32,31,fill,shade);
    ellipse(ctx,-16,-7,13,6,fill,shade);ellipse(ctx,16,-7,13,6,fill,shade);
    smile(ctx,0,-36,32);
    if(!bunny) starShape(ctx,0,-51,5,'#fff0ad');
  } else if(kind===3) {
    polygon(ctx,[[-20,-47],[2,-1],[23,-47]],'#eab87c',shade);
    stroke(ctx,[[-12,-39],[6,-19]],2,'#c59662');
    stroke(ctx,[[12,-38],[-3,-23]],2,'#c59662');
    ellipse(ctx,1,-55,31,31,'#f6aec6',shade);
    for(const x of [-23,-8,8,23]) ellipse(ctx,x,-39,8,7,'#f6aec6');
    smile(ctx,0,-56,28);
    ellipse(ctx,6,-83,7,7,'#f3837e',shade);
    stroke(ctx,[[7,-89],[10,-95]],2.6,'#879567');
  } else if(kind===4) {
    panel(ctx,-4,-65,8,66,4,'#fff1ca',shade);
    ellipse(ctx,0,-65,32,32,'#fff1d8',shade);
    ctx.beginPath();
    for(let i=0;i<=60;i++) {
      const f=i/60, a=f*2.6*tau, r=1+f*27;
      const x=Math.cos(a)*r, y=-65+Math.sin(a)*r;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.lineWidth=6;ctx.strokeStyle='#ef90a6';ctx.lineCap='round';ctx.stroke();
    polygon(ctx,[[-1,-27],[-14,-34],[-16,-19]],'#8fc9be',shade);
    polygon(ctx,[[1,-27],[14,-34],[16,-19]],'#8fc9be',shade);
  } else if(kind===5) {
    panel(ctx,-29,-60,58,58,19,'#db966f',shade);
    panel(ctx,-22,-53,44,42,14,'#eab78c');
    ellipse(ctx,-18,-63,10,10,'#e6b18a',shade);
    ellipse(ctx,18,-63,10,10,'#e6b18a',shade);
    smile(ctx,0,-34,31);
    for(const [x,y] of [[-20,-46],[6,-44],[21,-23],[-11,-15]]) ellipse(ctx,x,y,2.5,2.2,'#b87f62');
  } else if(kind===6) {
    panel(ctx,-4,-68,8,68,3,'#a48eb4',shade);
    stroke(ctx,[[0,-54],[13,-77],[24,-77]],3,'#c7accc');
    starShape(ctx,24,-64,16,'#ffe8a1',shade,.1);
    panel(ctx,-12,-9,24,8,4,'#d4bfd7',shade);
  } else {
    panel(ctx,-25,-65,50,65,10,'#c6b5e2',shade);
    polygon(ctx,[[-33,-60],[0,-95],[33,-60]],'#eaafcd',shade);
    ellipse(ctx,0,-94,5.5,5.5,'#ffe6ab',shade);
    panel(ctx,-8,-19,16,20,6,'#9d8cb7');
    for(const x of [-11,11]) panel(ctx,x-4,-49,8,13,4,'#ffedb5');
  }
}

function toySprite(kind) {
  if (toySprites.has(kind)) return toySprites.get(kind);
  const tile=document.createElement('canvas');
  tile.width=150;tile.height=150;
  const ctx=tile.getContext('2d');
  ctx.translate(75,145);ctx.scale(1.37,1.37);
  paintToy(ctx,kind);
  toySprites.set(kind,tile);
  return tile;
}

function projection(w,h,c,age) {
  const horizon=h*(.44+Math.sin(age*8.5+c.variant)*.002);
  const halfRoad=w*.71;
  const bend=Math.sin(age*.32+c.variant*2.4)*w*.068;
  const eyeHeight=1-c.head*.37;
  const project=(z,offset=0)=>{
    const scale=1/(1+Math.max(-.42,z)*1.04);
    return {
      x:w*.5+scale*halfRoad*(offset-c.lean*.64)+bend*(1-Math.min(1,scale))**2,
      y:horizon+scale*(h-horizon)*1.09*eyeHeight,
      scale
    };
  };
  return {horizon,project,vanishingX:w*.5+bend};
}

function band(ctx,project,a,b,left,right,color) {
  const p=project(a,left),q=project(a,right),r=project(b,right),t=project(b,left);
  polygon(ctx,[[p.x,p.y],[q.x,q.y],[r.x,r.y],[t.x,t.y]],color);
}

function road(ctx,w,h,c,age,view) {
  const theme=scenes[c.scene],unit=Math.min(w,h),project=view.project;
  const baseLeft=project(29,-1),baseRight=project(29,1);
  polygon(ctx,[[view.vanishingX,view.horizon],[baseRight.x,baseRight.y],[baseLeft.x,baseLeft.y]],theme.road[0]);
  const distance=age*(4.6+c.stage*.2)+c.variant*1.6;
  const phase=distance%1;
  for(let i=30;i>=-1;i--) {
    const a=Math.max(-.42,i-phase), b=i+1-phase;
    if(b<=a) continue;
    const index=Math.floor(distance)+i;
    const shade=Math.abs(index%2);
    band(ctx,project,a,b,-1,1,theme.road[shade]);
    for(const sign of [-1,1]) {
      band(ctx,project,a,b,sign*.97,sign*1.04,theme.edge[shade]);
      if(index%3!==0) band(ctx,project,a,b,sign*.324,sign*.344,theme.line);
    }
  }
  for(let i=8;i>=0;i--) {
    const z=i*3.15-distance%3.15;
    if(z<-.3) continue;
    for (const sign of [-1,1]) {
      const number=Math.floor(distance/3.15)+i+(sign===1?2:0);
      const pos=project(z,sign*(1.2+Math.abs(Math.sin(number*5.83))*.34));
      const size=unit*pos.scale*(.75+.1*(number%3));
      if(pos.x+size*.48<0 || pos.x-size*.48>w) continue;
      ellipse(ctx,pos.x,pos.y,size*.29,Math.max(.5,size*.042),'rgba(92,64,74,.15)');
      ctx.drawImage(toySprite(c.scene*3+number%3),pos.x-size*.5,pos.y-size*145/150,size,size);
    }
  }
}

function toyRail(ctx,x,y,w,h,theme) {
  ctx.lineWidth=Math.max(1,h*.055);
  panel(ctx,x,y,w,h,h*.38,theme.wood);
  panel(ctx,x,y,w,h*.86,h*.36,theme.accent);
  for(let i=1;i<8;i++) {
    ellipse(ctx,x+i*w/8,y+h*.40,h*.19,h*.18,i%2?'#fff0b9':'#fff4e8');
  }
  panel(ctx,x+w*.045,y+h*.12,w*.19,h*.12,h*.06,'#fff1d5');
}

function gate(ctx,w,h,c,view,age) {
  const remain=c.gateAt-age;
  if (remain<-.15) return;
  const z=remain*2.25, unit=Math.min(w,h),theme=scenes[c.scene];
  const bounds=c.kind==='left'?[-.30,.96]:c.kind==='right'?[-.96,.30]:[-.96,.96];
  const l=view.project(z,bounds[0]),r=view.project(z,bounds[1]);
  const scale=l.scale, width=r.x-l.x;
  let height=unit*(c.kind==='jump' ? .19 : .44);
  if(c.kind==='duck') height=Math.max(unit*.75,h*.54);
  height*=scale;
  const thickness=Math.max(2,unit*scale*(c.kind==='duck' ? .112 : .083));
  ellipse(ctx,(l.x+r.x)/2,l.y,width*.53,Math.max(.6,unit*.023*scale),'rgba(83,65,77,.2)');
  for (const x of [l.x+thickness*.21,r.x-thickness*.65]) {
    panel(ctx,x,l.y-height,thickness*.45,height,thickness*.2,theme.wood);
    panel(ctx,x+thickness*.10,l.y-height*.85,thickness*.09,height*.76,thickness*.04,'#f3c9a1');
  }
  toyRail(ctx,l.x,l.y-height,width,thickness,theme);
  if(c.kind==='left' || c.kind==='right') {
    toyRail(ctx,l.x,l.y-height*.53,width,thickness*.8,theme);
    const block=Math.min(height*.69,width*.31);
    const center=(l.x+r.x)/2;
    panel(ctx,center-block*.53,l.y-height*.87,block*1.06,block*.72,block*.13,'#ffe3b7',theme.wood);
    smile(ctx,center,l.y-height*.87+block*.32,block*.64);
  }
}

function pickup(ctx,w,h,c,view,age) {
  if(c.pickResult) return;
  const seconds=c.pickAt-age;
  const point=view.project(seconds*1.82,c.pick.lane*.64);
  const radius=Math.min(w,h)*.13*point.scale;
  const y=point.y-Math.min(w,h)*point.scale*(c.pick.star ? .63 : .27);
  const tilt=Math.sin(age*4.5)*.09;
  ellipse(ctx,point.x,point.y,radius*.80,radius*.17,'rgba(114,80,63,.18)');
  ctx.lineWidth=Math.max(1.1,radius*.085);
  if(c.pick.star) {
    starShape(ctx,point.x,y+radius*.10,radius*1.11,'#e6a54a','#ac703b',tilt);
    starShape(ctx,point.x,y,radius*1.11,'#ffe17c','#bd823d',tilt);
    smile(ctx,point.x,y,radius*.87);
  } else {
    const half=radius*(.70+.14*Math.cos(age*5));
    ellipse(ctx,point.x+radius*.15,y,half,radius,'#e3a044','#bb793a');
    ellipse(ctx,point.x,y,half,radius,'#ffdd65','#bb793a');
    ctx.lineWidth=Math.max(.7,radius*.055);
    ellipse(ctx,point.x,y,half*.73,radius*.76,'#ffd153','#ecae45');
    starShape(ctx,point.x,y,radius*.45,'#fff4b3');
  }
  for (const sign of [-1,1]) {
    const factor=.17+.04*Math.sin(age*8+sign);
    starShape(ctx,point.x+sign*radius*1.35,y+sign*radius*.52,radius*factor,'#fff8c3');
  }
}

function pickupBurst(ctx,w,h,c,age) {
  if (!c.pickResult?.winners.length) return;
  const t=(age-c.pickResult.at)/.68;
  if(t<0 || t>1) return;
  const unit=Math.min(w,h);
  const x=w*(.5+.18*c.pick.lane),y=h*.57;
  ctx.save();
  ctx.globalAlpha=1-t;
  for(let i=0;i<9;i++) {
    const angle=tau*i/9, radius=unit*(.03+t*.16);
    starShape(ctx,x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,
      unit*(.019-.008*t),i%2 ? '#fff4aa' : '#ffd062',null,angle+t);
  }
  label(ctx,c.pick.star?'星星 +10':'金币 +5',x,y-unit*t*.06,clamp(unit*.054,15,27),ink,'center',850);
  ctx.restore();
}

function displayCue(c,age,versus) {
  if (c.done) return {message:'到达终点',instruction:'等待另一条赛道',progress:1,color:'#dcf4ae'};
  if (c.gateResult) {
    const success=c.gateResult.winners.length>0;
    const check=c.index%4===3 && !versus;
    const clear=check ? c.cleared>=2 : success;
    const message=check ? (clear?'顺利过关':'本关未通过') : success?'成功避开':'碰到障碍';
    return {message,instruction:check?'本关结果':'障碍判定',progress:1,color:clear?'#ddf5a5':'#ffd1bf'};
  }
  if(c.pickResult && age-c.pickResult.at<.57) {
    const found=c.pickResult.winners.length>0;
    const name=c.pick.star?'星星':'金币';
    return {message:found?name+(c.pick.star?' +10':' +5'):'错过'+name,
      instruction:'道具判定', progress:1, color:found?'#ffed9d':paper};
  }
  const isPickup=!c.pickResult;
  const arrival=isPickup?c.pickAt:c.gateAt;
  const start=isPickup?c.start:c.pickAt+.69;
  const now=arrival-age<.64;
  let instruction;
  if (isPickup) instruction=c.pick.star?'星星 · 回到中路':'金币 · 换到指定跑道';
  else instruction='前方障碍';
  const move=isPickup?c.pick.move:c.kind;
  return {
    message:(now?'现在':'准备')+' · '+actionLabels[move],
    instruction, progress:clamp((age-start)/(arrival-start),0,1),
    color:now?'#e2f8a3':isPickup?'#fff0ba':paper
  };
}

function drawScores(ctx,w,h,s,c) {
  const unit=Math.min(w,h);
  const fontSize=clamp(unit*.044,12,22);
  const gap=clamp(unit*.015,4,8);
  const width=Math.min((w-gap*(c.ids.length+1))/c.ids.length,c.ids.length===1?fontSize*15:fontSize*9.6);
  const height=fontSize*(c.ids.length===1?2.05:2.88);
  const start=(w-width*c.ids.length-gap*(c.ids.length-1))*.5;
  for(let i=0;i<c.ids.length;i++) {
    const id=c.ids[i],p=s.players[id],x=start+i*(width+gap),y=h-height-gap;
    const recent=p.note && s.age-p.note.at<.72;
    const bg=recent ? p.note.yes?'#e0f4a9':'#ffe4d6' : paper;
    ctx.lineWidth=1.25;
    panel(ctx,x,y,width,height,Math.min(height*.38,13),bg,ink);
    const single=c.ids.length===1;
    const cy=y+fontSize*(single?1.02:.92),r=fontSize*.61;
    const cx=x+fontSize*1.00;
    ellipse(ctx,cx,cy,r,r,playerColors[id],ink);
    label(ctx,id+1,cx,cy,fontSize*.94,ink,'center',800);
    const score=recent?p.note.label:p.score+'分';
    label(ctx,score,single?x+width-fontSize*.6:x+width*.60,cy,fontSize,ink,single?'right':'center',800);
    const left=single?cx+r+fontSize*.63:x+width*.50-fontSize*1.87;
    const row=single?cy:y+fontSize*2.11;
    const scale=single?fontSize:fontSize*.93;
    ellipse(ctx,left+scale*.35,row,scale*.32,scale*.40,'#ffd560','#a97638');
    label(ctx,p.coins,left+scale*.92,row,scale*.94,ink,'left');
    starShape(ctx,left+scale*2.76,row,scale*.47,'#ffe38c','#a97638');
    label(ctx,p.stars,left+scale*3.35,row,scale*.94,ink,'left');
  }
}

function hud(ctx,w,h,c,s) {
  const unit=Math.min(w,h), margin=clamp(unit*.026,5,16);
  const size=clamp(unit*.045,12,22);
  const player=s.versus?'P'+(c.ids[0]+1)+' · ':'';
  const title=player+scenes[c.scene].name;
  const status=s.versus ? (c.index+1)+' / 12' : (c.index+1)+'/12 · 本关 '+c.cleared+'/2';
  ctx.font=font(size,800);
  const headerW=Math.min(w-margin*2,ctx.measureText(title+'   '+status).width+size*1.55);
  const headerH=size*1.85;
  ctx.lineWidth=1.4;
  panel(ctx,margin,margin,headerW,headerH,headerH*.44,s.versus?playerColors[c.ids[0]]:paper,ink);
  label(ctx,title,margin+size*.7,margin+headerH*.5,size,ink,'left',800);
  label(ctx,status,margin+headerW-size*.65,margin+headerH*.5,size*.90,ink,'right',750);
  const cue=displayCue(c,s.age,s.versus);
  const cueSize=clamp(unit*.055,14,29),cueH=cueSize*3.02,cueW=cueSize*8.0;
  const x=(w-cueW)*.5,y=margin+headerH+margin*.6;
  panel(ctx,x,y,cueW,cueH,cueSize*.8,cue.color,ink);
  label(ctx,cue.instruction,w*.5,y+cueSize*.65,Math.max(11,cueSize*.68),ink,'center');
  label(ctx,cue.message,w*.5,y+cueSize*1.69,cueSize,ink,'center',850);
  const bx=x+cueSize*.72,by=y+cueH-cueSize*.49,bw=cueW-cueSize*1.44,bh=cueSize*.17;
  panel(ctx,bx,by,bw,bh,bh*.5,'#cfd4c0');
  panel(ctx,bx,by,Math.max(bh,bw*cue.progress),bh,bh*.5,ink);
  drawScores(ctx,w,h,s,c);
}

function drawView(ctx,x,y,w,h,c,s) {
  const view=projection(w,h,c,s.age);
  ctx.save();ctx.translate(x,y);
  ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
  horizonScene(ctx,w,h,c,s.age,view.horizon);
  road(ctx,w,h,c,s.age,view);
  gate(ctx,w,h,c,view,s.age);
  pickup(ctx,w,h,c,view,s.age);
  pickupBurst(ctx,w,h,c,s.age);
  hud(ctx,w,h,c,s);
  ctx.restore();
}

export const runnerGame = {
  start(options={}) {
    const count=clamp(Math.floor(options.players)||1,1,4);
    const versus=options.runnerMode==='versus' && count===2;
    const players=Array.from({length:count},(_,id)=>newPlayer(id));
    game={
      players,versus,age:0,finished:false,onFinish:options.onFinish,onSfx:options.onSfx,
      courses:versus ? [makeCourse([0],0),makeCourse([1],1)] : [makeCourse(players.map(p=>p.id),0)]
    };
  },
  update({dt,players=[]}) {
    const s=game;
    if(!s || s.finished) return;
    const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;
    s.age+=elapsed;
    for(const tracked of players) {
      const player=s.players[tracked.id];
      if(!player || !Number.isInteger(tracked.id) || !tracked.gestures) continue;
      for(const move of Object.keys(actionLabels)) {
        if(tracked.gestures[move]) player.moves[move]=s.age;
      }
    }
    for(const course of s.courses) progressCourse(s,course,elapsed);
    if(s.courses.every(c=>c.done)) finish(s);
  },
  draw(ctx,{w,h}) {
    const s=game;
    if(!s || w<=0 || h<=0) return;
    if(!s.versus) {
      drawView(ctx,0,0,w,h,s.courses[0],s);
      return;
    }
    const horizontal=w/h>=1.18;
    const gap=clamp(Math.min(w,h)*.013,3,8);
    const width=horizontal?(w-gap)/2:w;
    const height=horizontal?h:(h-gap)/2;
    ctx.fillStyle=ink;
    ctx.fillRect(0,0,w,h);
    drawView(ctx,0,0,width,height,s.courses[0],s);
    drawView(ctx,horizontal?width+gap:0,horizontal?0:height+gap,width,height,s.courses[1],s);
  },
  action(id,move) {
    const s=game;
    if(!s || s.finished || !Number.isInteger(id) || !s.players[id]) return;
    if(Object.hasOwn(actionLabels,move)) s.players[id].moves[move]=s.age;
  },
  get scores() {return game?.players.map(p=>p.score) || [];},
  stop() {game=null;}
};
