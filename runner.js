import {polygon, ellipse, panel} from './canvas-shapes.js';
import {scenes, createScenery, horizonScene, drawRoadside, updateAmbientAnimals, drawAmbientAnimals} from './runner-world.js';

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

const actionLabels = {left:'向左移', right:'向右移', jump:'跳起来', duck:'蹲下来'};
const envIndex = {sky:0, forest:1, ocean:2};
const gateOrders = [
  ['jump','duck','jump','duck','duck','jump','jump','duck','duck','jump','duck','jump'],
  ['duck','jump','duck','jump','jump','duck','duck','jump','jump','duck','jump','duck']
];
const rounds = 12;
let game;

function newPlayer(id) {
  return {id, score:0, gates:0, coins:0, stars:0, note:null, lean:0, head:0,
    moves:{left:-Infinity, right:-Infinity, jump:-Infinity, duck:-Infinity}};
}

function makeCourse(ids, variant, scene) {
  const course = {ids, variant, scene, index:0, cleared:0, stage:0, scenery:createScenery(), done:false};
  nextEvents(course, 0);
  return course;
}

function nextEvents(c, start) {
  const slot = c.index % 4;
  const timing = [0,.24,-.17,.08][(slot + 2*c.variant) % 4];
  c.stage = Math.floor(c.index / 4);
  c.start = start;
  c.gateAt = start + 4.55 - .18*c.stage + timing;
  c.pickAt = start + 2.02 + .12*c.variant + .45*timing;
  c.kind = gateOrders[c.variant][c.index];
  const star = (c.index + c.variant) % 2 === 1;
  c.pick = {star, move:star ? 'jump' : null, lane:0};
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
  if (!move) return true;
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
      if (pickup) s.onSfx?.(c.pick.star ? 'star' : 'coin', id);
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
  if (!pickup) s.onSfx?.(winners.length ? 'clear' : 'miss');
}

function progressCourse(s,c) {
  if (c.done) return;
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

function projection(w,h,c,age,player) {
  const head=player?.head ?? 0;
  const jumpAmt=Math.max(0,-head);
  const duckAmt=Math.max(0,head);
  const stride=age*9.2+c.variant*1.4;
  const bobY=Math.sin(stride)*.042*(1-jumpAmt*.7);
  const bobX=Math.cos(stride*.5)*.024*(1-jumpAmt*.5);
  const horizon=h*(.43+jumpAmt*.055-duckAmt*.055+bobY*.16);
  const halfRoad=w*.72;
  const bend=Math.sin(age*.32+c.variant*2.4)*w*.068;
  const camY=1.0+bobY+jumpAmt*.65-duckAmt*.42;
  const lean=player?.lean ?? 0;
  const project=(z,offset=0,worldY=0)=>{
    const scale=1/(1+Math.max(-.42,z)*1.04);
    return {
      x:w*.5+scale*halfRoad*(offset-lean*.64-bobX)+bend*(1-Math.min(1,scale))**2,
      y:horizon+scale*(h-horizon)*1.09*(camY-worldY),
      scale
    };
  };
  return {horizon,project,vanishingX:w*.5+bend,camY,jumpAmt,duckAmt};
}

function band(ctx,project,a,b,left,right,color) {
  const p=project(a,left),q=project(a,right),r=project(b,right),t=project(b,left);
  polygon(ctx,[[p.x,p.y],[q.x,q.y],[r.x,r.y],[t.x,t.y]],color);
}

function road(ctx,w,h,c,age,view) {
  const theme=scenes[c.scene],project=view.project;
  const surface=theme.road;
  const baseLeft=project(29,-1),baseRight=project(29,1);
  polygon(ctx,[[view.vanishingX,view.horizon],[baseRight.x,baseRight.y],[baseLeft.x,baseLeft.y]],surface[0]);
  const distance=age*(4.6+c.stage*.2)+c.variant*1.6;
  const phase=distance%1;
  for(let i=30;i>=-1;i--) {
    const a=Math.max(-.42,i-phase), b=i+1-phase;
    if(b<=a) continue;
    const index=Math.floor(distance)+i;
    const shade=Math.abs(index%2);
    band(ctx,project,a,b,-1,1,surface[shade]);
    for(const sign of [-1,1]) {
      band(ctx,project,a,b,sign*.97,sign*1.04,theme.edge[shade]);
      if(c.scene===0) band(ctx,project,a,b,sign*1.04,sign*1.07,theme.edge[1-shade]);
    }
  }
  drawRoadside(ctx,w,h,c,age,view,distance);
  drawAmbientAnimals(ctx,w,h,c,age,view);
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
  if (remain<-.18) return;
  const z=remain*2.25, unit=Math.min(w,h), theme=scenes[c.scene];
  const bounds=c.kind==='left'?[-.30,.96]:c.kind==='right'?[-.96,.30]:[-.96,.96];
  const topY=c.kind==='jump' ? .52 : 1.38;
  const l=view.project(z,bounds[0],0), r=view.project(z,bounds[1],0);
  const lt=view.project(z,bounds[0],topY);
  const scale=l.scale, width=r.x-l.x;
  const height=Math.max(4,l.y-lt.y);
  const thickness=Math.max(3,unit*scale*(c.kind==='duck' ? .145 : .09));
  ellipse(ctx,(l.x+r.x)/2,l.y,width*.53,Math.max(.6,unit*.023*scale),'rgba(83,65,77,.2)');
  for (const x of [l.x+thickness*.16,r.x-thickness*.56]) {
    panel(ctx,x,lt.y,thickness*.42,height,thickness*.18,theme.wood);
    panel(ctx,x+thickness*.09,lt.y+height*.06,thickness*.09,height*.84,thickness*.04,'#f3c9a1');
  }
  toyRail(ctx,l.x,lt.y,width,thickness,theme);
  if (c.kind==='duck') {
    const mid=view.project(z,0,.84);
    const barH=Math.max(thickness,mid.y-lt.y);
    toyRail(ctx,l.x,mid.y-thickness*.6,width,thickness*.95,theme);
    const badgeW=Math.min(width*.36,barH*1.4);
    const badgeH=Math.max(10,thickness*.95);
    panel(ctx,(l.x+r.x-badgeW)*.5,lt.y+barH*.2,badgeW,badgeH,badgeH*.35,'#fff4cf',theme.wood);
    label(ctx,'↓ 蹲下', (l.x+r.x)*.5, lt.y+barH*.2+badgeH*.5, Math.max(8,badgeH*.62), ink, 'center', 850);
  } else if (c.kind==='jump') {
    const mid=view.project(z,0,.26);
    toyRail(ctx,l.x,mid.y,width,thickness*.75,theme);
    const badgeW=Math.min(width*.32,height*.95);
    const badgeH=Math.max(9,thickness*.85);
    panel(ctx,(l.x+r.x-badgeW)*.5,lt.y-badgeH*.35,badgeW,badgeH,badgeH*.35,'#e9f9b8',theme.wood);
    label(ctx,'↑ 跳起', (l.x+r.x)*.5, lt.y-badgeH*.35+badgeH*.5, Math.max(8,badgeH*.62), ink, 'center', 850);
  }
}

function pickup(ctx,w,h,c,view,age) {
  if(c.pickResult) return;
  const seconds=c.pickAt-age;
  const worldY=c.pick.star ? 1.05 : .38;
  const ground=view.project(seconds*1.82,c.pick.lane*.64,0);
  const point=view.project(seconds*1.82,c.pick.lane*.64,worldY);
  const radius=Math.min(w,h)*.13*point.scale;
  const y=point.y;
  const tilt=Math.sin(age*4.5)*.09;
  ellipse(ctx,ground.x,ground.y,radius*.80,radius*.17,'rgba(114,80,63,.18)');
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

function eventWon(event, player) {
  if (!event) return false;
  return player ? event.winners.includes(player.id) : event.winners.length > 0;
}

function pickupBurst(ctx,w,h,c,age,player) {
  if (!eventWon(c.pickResult, player)) return;
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

function displayCue(c,age,versus,player) {
  if (c.done) return {message:'到达终点',instruction:'等待另一条赛道',progress:1,color:'#dcf4ae'};
  if (c.gateResult) {
    const success=eventWon(c.gateResult, player);
    const check=c.index%4===3 && !versus;
    const clear=check ? c.cleared>=2 : success;
    const message=check ? (clear?'顺利过关':'本关未通过') : success?'成功避开':'碰到障碍';
    return {message,instruction:check?'本关结果':'障碍判定',progress:1,color:clear?'#ddf5a5':'#ffd1bf'};
  }
  if(c.pickResult && age-c.pickResult.at<.57) {
    const found=eventWon(c.pickResult, player);
    const name=c.pick.star?'星星':'金币';
    return {message:found?name+(c.pick.star?' +10':' +5'):'错过'+name,
      instruction:'道具判定', progress:1, color:found?'#ffed9d':paper};
  }
  const isPickup=!c.pickResult;
  const arrival=isPickup?c.pickAt:c.gateAt;
  const start=isPickup?c.start:c.pickAt+.69;
  const now=arrival-age<.64;
  let instruction;
  if (isPickup) instruction=c.pick.star?'前方星星 · 跳起来':'前方金币 · 跑过收集';
  else instruction='前方障碍';
  const move=isPickup?c.pick.move:c.kind;
  const timing=now?'现在':'准备';
  const actionText=move ? actionLabels[move] : '保持奔跑';
  const target=isPickup ? c.pick.star?'星星':'金币' : '障碍';
  return {
    message:move ? timing+' · '+actionText : actionText,
    shortText:target+' · '+(move ? timing+actionText : actionText),
    instruction, progress:clamp((age-start)/(arrival-start),0,1),
    color:now && move?'#e2f8a3':isPickup?'#fff0ba':paper
  };
}

function drawScores(ctx,w,h,s,ids,cameraVisible) {
  const unit=Math.min(w,h);
  const fontSize=clamp(unit*.044,12,22);
  const gap=clamp(unit*.015,4,8);
  const single=ids.length===1;
  const singleWidth=cameraVisible ? 10.3 : 15;
  const width=Math.min((w-gap*(ids.length+1))/ids.length,fontSize*(single?singleWidth:9.6));
  const height=fontSize*(single?2.05:2.88);
  const start=(w-width*ids.length-gap*(ids.length-1))*.5;
  const y=h-height-gap;
  for(let i=0;i<ids.length;i++) {
    const id=ids[i],p=s.players[id],x=start+i*(width+gap);
    const recent=p.note && s.age-p.note.at<.72;
    const bg=recent ? p.note.yes?'#e0f4a9':'#ffe4d6' : paper;
    ctx.lineWidth=1.25;
    panel(ctx,x,y,width,height,Math.min(height*.38,13),bg,ink);
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

function hud(ctx,w,h,c,s,player,cameraVisible) {
  const unit=Math.min(w,h), margin=clamp(unit*.026,5,16);
  const size=clamp(unit*.045,12,22);
  const split=s.players.length===2;
  const title=(split?'P'+(player.id+1)+' · ':'')+scenes[c.scene].name;
  const stageLabel=w<180 ? '' : c.ids.length>1?'团队 ':'本关 ';
  const status=s.versus ? (c.index+1)+' / 12' : (c.index+1)+'/12 · '+stageLabel+c.cleared+'/4';
  ctx.font=font(size,800);
  const headerW=Math.min(w-margin*2,ctx.measureText(title+'   '+status).width+size*1.55);
  const headerH=size*1.85;
  ctx.lineWidth=1.4;
  panel(ctx,margin,margin,headerW,headerH,headerH*.44,split?playerColors[player.id]:paper,ink);
  label(ctx,title,margin+size*.7,margin+headerH*.5,size,ink,'left',800);
  label(ctx,status,margin+headerW-size*.65,margin+headerH*.5,size*.90,ink,'right',750);
  const cue=displayCue(c,s.age,s.versus,player);
  const cueSize=clamp(unit*(cameraVisible ? .045 : .055),14,cameraVisible ? 22 : 29);
  // Short phone viewports need one cue line to keep faces and obstacles visible.
  const compact=cameraVisible && h<270;
  const prompt=cue.shortText || cue.message;
  ctx.font=font(cueSize*.9,800);
  const cueW=compact ? Math.min(w-margin*2,ctx.measureText(prompt).width+cueSize*1.2) : cueSize*8.0;
  const cueH=cueSize*(compact ? 1.85 : cameraVisible ? 2.8 : 3.02);
  const sameRow=cameraVisible && w>=headerW+cueW+margin*3;
  const x=cameraVisible ? (sameRow ? w-cueW-margin : margin) : (w-cueW)*.5;
  const y=sameRow ? margin : margin+headerH+margin*.6;
  panel(ctx,x,y,cueW,cueH,cueSize*.8,cue.color,ink);
  if(compact) label(ctx,prompt,x+cueW*.5,y+cueSize*.77,cueSize*.9,ink,'center',800);
  else {
    label(ctx,cue.instruction,x+cueW*.5,y+cueSize*.65,Math.max(11,cueSize*.68),ink,'center');
    label(ctx,cue.message,x+cueW*.5,y+cueSize*1.69,cueSize,ink,'center',850);
  }
  const bx=x+cueSize*.72,by=y+cueH-cueSize*(compact ? .36 : .49),bw=cueW-cueSize*1.44,bh=cueSize*.17;
  panel(ctx,bx,by,bw,bh,bh*.5,'#cfd4c0');
  panel(ctx,bx,by,Math.max(bh,bw*cue.progress),bh,bh*.5,ink);
  drawScores(ctx,w,h,s,player?[player.id]:c.ids,cameraVisible);
}

function speedLines(ctx, w, h, age, view) {
  const boost = view.jumpAmt * 0.55 + view.duckAmt * 0.45;
  const alpha = 0.08 + boost * 0.16;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 253, 243, ${alpha.toFixed(3)})`;
  ctx.lineCap = 'round';
  const cx = view.vanishingX, cy = view.horizon;
  for (let i = 0; i < 10; i++) {
    const angle = (i < 5 ? -0.36 + i * 0.18 : Math.PI - 0.36 + (i - 5) * 0.18) + Math.sin(i * 3.1) * 0.05;
    const cycle = (age * (2.6 + boost * 1.8) + i * 0.37) % 1;
    const r0 = Math.max(w, h) * (0.28 + cycle * 0.36);
    const r1 = r0 + Math.max(w, h) * (0.06 + boost * 0.08);
    ctx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.004 * (0.6 + cycle));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRunner(ctx, w, h, c, age, view, player, slotOffset = 0, showTag = false) {
  const runnerZ = 0.42;
  const lean = player?.lean ?? 0;
  const head = player?.head ?? 0;
  const jumpAmt = Math.max(0, -head);
  const duckAmt = Math.max(0, head);
  const stride = age * 9.2 + c.variant * 1.4 + (player?.id ?? 0) * 0.9;
  const bounce = Math.abs(Math.sin(stride * 0.5)) * 0.03 * (1 - jumpAmt * 0.8) * (1 - duckAmt * 0.6);
  const worldY = jumpAmt * 0.55 + bounce;
  const foot = view.project(runnerZ, slotOffset + lean * 0.35, worldY);
  const unit = Math.min(w, h) * foot.scale;
  const s = unit * 0.17;
  const swing = Math.sin(stride) * (1 - jumpAmt * 0.65) * (1 - duckAmt * 0.5);
  const crouch = 1 - duckAmt * 0.46;
  const silhouette = '#2b2d38';

  ctx.save();
  ctx.globalAlpha = 0.40;
  ctx.translate(foot.x, foot.y);
  ctx.rotate(lean * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Half-body silhouette (waist up)
  const waistY = -s * 0.15;
  const shoulderY = waistY - s * 0.88 * crouch;
  const torsoW = s * 0.78;
  const torsoH = s * 0.92 * crouch;
  panel(ctx, -torsoW * 0.5, shoulderY, torsoW, torsoH, s * 0.28, silhouette);

  // Swinging arms
  for (const side of [-1, 1]) {
    const armPhase = -side * swing;
    const shoulderX = side * (torsoW * 0.50);
    const armY = shoulderY + s * 0.14 * crouch;
    const handX = shoulderX + side * s * 0.18 + armPhase * s * 0.05;
    const handY = armY + (jumpAmt > 0.2 ? -s * 0.42 * jumpAmt : s * 0.46 * crouch + armPhase * s * 0.18);
    stroke(ctx, [[shoulderX, armY], [handX, handY]], Math.max(2, s * 0.20), silhouette);
  }

  // Head
  const headR = s * 0.34;
  const headY = shoulderY - headR * 0.92;
  ellipse(ctx, 0, headY, headR, headR * 0.98, silhouette);
  if (showTag && player) {
    ctx.globalAlpha = 0.78;
    label(ctx, 'P' + (player.id + 1), 0, shoulderY + torsoH * 0.48, Math.max(9, s * 0.34), '#fffdf3', 'center', 800);
  }
  ctx.restore();
}

function drawView(ctx,x,y,w,h,c,s,player) {
  const view=projection(w,h,c,s.age,player);
  const runnerZ = 0.42;
  const gateZ = (c.gateAt - s.age) * 2.25;
  const pickZ = (c.pickAt - s.age) * 1.82;
  const runners = player ? [player] : c.ids.map(id => s.players[id]);
  const span = Math.min(1.05, 0.46 * (runners.length - 1));
  ctx.save();ctx.translate(x,y);
  ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
  horizonScene(ctx,w,h,c,s.age,view.horizon);
  road(ctx,w,h,c,s.age,view);
  if (gateZ >= runnerZ) gate(ctx,w,h,c,view,s.age);
  if (pickZ >= runnerZ) pickup(ctx,w,h,c,view,s.age);
  runners.forEach((p, idx) => {
    const slotOffset = runners.length === 1 ? 0 : ((idx / (runners.length - 1)) - 0.5) * span;
    drawRunner(ctx, w, h, c, s.age, view, p, slotOffset, runners.length > 1);
  });
  if (gateZ < runnerZ) gate(ctx,w,h,c,view,s.age);
  if (pickZ < runnerZ) pickup(ctx,w,h,c,view,s.age);
  speedLines(ctx,w,h,s.age,view);
  pickupBurst(ctx,w,h,c,s.age,player);
  hud(ctx,w,h,c,s,player,false);
  ctx.restore();
}

export const runnerGame = {
  start(options={}) {
    const count=clamp(Math.floor(options.players)||1,1,4);
    const versus=options.runnerMode==='versus' && count===2;
    const scene=envIndex[options.runnerEnv] ?? 0;
    const players=Array.from({length:count},(_,id)=>newPlayer(id));
    game={
      players,versus,age:0,finished:false,onFinish:options.onFinish,onSfx:options.onSfx,
      courses:versus ? [makeCourse([0],0,scene),makeCourse([1],1,scene)] : [makeCourse(players.map(p=>p.id),0,scene)]
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
    const blend = 1 - Math.exp(-elapsed * 10);
    for (const player of s.players) {
      const head = Number(active(player,'duck',s.age))-Number(active(player,'jump',s.age));
      player.lean += (lane(player,s.age)-player.lean)*blend;
      player.head += (head-player.head)*blend;
    }
    for(const course of s.courses) {
      progressCourse(s,course);
      updateAmbientAnimals(course, elapsed, 4.6 + course.stage * .2);
    }
    if(s.courses.every(c=>c.done)) finish(s);
  },
  draw(ctx,{w,h}) {
    const s=game;
    if(!s || w<=0 || h<=0) return;
    if(!s.versus) {
      const player=s.players.length===1?s.players[0]:null;
      drawView(ctx,0,0,w,h,s.courses[0],s,player);
      return;
    }
    const horizontal=w/h>=1.18;
    const gap=clamp(Math.min(w,h)*.013,3,8);
    const width=horizontal?(w-gap)/2:w;
    const height=horizontal?h:(h-gap)/2;
    ctx.fillStyle=ink;
    if(horizontal) ctx.fillRect(width,0,gap,h);
    else ctx.fillRect(0,height,w,gap);
    drawView(ctx,0,0,width,height,s.courses[0],s,s.players[0]);
    drawView(ctx,horizontal?width+gap:0,horizontal?0:height+gap,width,height,s.versus?s.courses[1]:s.courses[0],s,s.players[1]);
  },
  action(id,move) {
    const s=game;
    if(!s || s.finished || !Number.isInteger(id) || !s.players[id]) return;
    if(Object.hasOwn(actionLabels,move)) s.players[id].moves[move]=s.age;
  },
  get scores() {return game?.players.map(p=>p.score) || [];},
  stop() {game=null;}
};
