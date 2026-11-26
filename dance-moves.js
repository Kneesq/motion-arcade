const standingFeet = [[-.32, .95], [.32, .95]];

export const dynamicMoves = [
  {key:'swipe-left', name:'双手左滑', two:'双手放在右侧，一起向画面左侧划过', hands:[[-.94,-.27],[-.59,-.13]]},
  {key:'swipe-right', name:'双手右滑', two:'双手放在左侧，一起向画面右侧划过', hands:[[.59,-.13],[.94,-.27]]},
  {key:'hands-pump', name:'双手上下摆', two:'双手从腰边举过肩，再摆回腰边', hands:[[-.48,.24],[.48,.24]]},
  {key:'jump', name:'原地跳跃', two:'轻轻屈膝，跟拍跳起并落回原地', four:'双脚一起离地，轻轻落回原位', hands:[[-.48,.24],[.48,.24]]},
  {key:'squat', name:'深蹲弹起', two:'跟拍向下蹲低，再迅速站起', hands:[[-.62,.04],[.62,.04]]},
  {key:'wave-both', name:'头顶挥手', two:'双手举过头顶，左右大幅摇摆', hands:[[-.52,-1.02],[.52,-1.02]]},
  {key:'clap-beat', name:'胸前拍手', two:'双臂向两侧打开，跟拍在胸前合掌拍手', hands:[[-.08,-.18],[.08,-.18]]},
  {key:'alternate-pump', name:'交替出拳', two:'左右手交替向上挥拳、向下收回', hands:[[-.52,-.92],[.52,.22]]}
];

function portion(value, start, end) {
  return Math.max(0, Math.min(1, (value - start) / (end - start)));
}

function smooth(value, start, end) {
  const f = portion(value,start,end);
  return f * f * (3 - 2 * f);
}

// Coordinates use the guide's on-screen left/right. A move lands on its
// cue at progress .75. The surrounding interval shows preparation and follow-through.
export function sampleDanceMove(key, progress) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (key === 'swipe-left' || key === 'swipe-right') {
    const direction = key === 'swipe-left' ? -1 : 1;
    const sweep = smooth(p,.20,.75);
    const reach = smooth(p,0,.19) * (1 - smooth(p,.80,1));
    const x = direction * (sweep * 1.53 - .765);
    const arc = .075 * Math.sin(sweep * Math.PI);
    const turn = direction * (sweep * 2 - 1);
    const hands = [-1,1].map(side => {
      const rest = side * .48;
      const wristX = x + side * .175;
      const wristY = -.20 + arc - side * turn * .07;
      return [rest + (wristX - rest) * reach, .24 + (wristY - .24) * reach];
    });
    return {
      hands,
      feet:standingFeet, lift:0, squash:1
    };
  }
  if (key === 'hands-pump') {
    const raised = smooth(p,.11,.42) * (1 - smooth(p,.46,.75));
    const x = .48 - .05 * raised;
    const y = .24 - 1.23 * raised;
    return {hands:[[-x,y],[x,y]], feet:standingFeet, lift:0, squash:1};
  }
  if (key === 'jump') {
    const crouch = smooth(p,.07,.29) * (1 - smooth(p,.31,.48));
    const ascent = portion(p,.46,.73);
    const descent = portion(p,.73,.95);
    const flight = p < .73 ? ascent * (2 - ascent) : 1 - descent * descent;
    const landing = smooth(p,.87,.955) * (1 - smooth(p,.955,1));
    const handX = .48 + .14 * flight;
    const handY = .24 + .08 * crouch - .66 * flight;
    const toeX = .32 + .035 * flight;
    const toeY = .95 - .09 * flight;
    return {
      hands:[[-handX,handY],[handX,handY]], feet:[[-toeX,toeY],[toeX,toeY]],
      lift:.245 * flight, squash:1 - .15 * crouch - .075 * landing
    };
  }
  if (key === 'squat') {
    const down = smooth(p, .12, .56) * (1 - smooth(p, .62, .94));
    const handX = .48 + .26 * down;
    const handY = .24 - .24 * down;
    const footX = .32 + .14 * down;
    return {
      hands:[[-handX, handY], [handX, handY]],
      feet:[[-footX, .95], [footX, .95]],
      lift:0, squash:1 - .28 * down
    };
  }
  if (key === 'wave-both') {
    const sway = Math.sin(smooth(p, .08, .88) * Math.PI * 2);
    const liftHands = smooth(p, 0, .14) * (1 - smooth(p, .86, 1));
    const lx = -.48 + sway * .32;
    const rx = .48 + sway * .32;
    const y = .24 + (-1.04 - .24) * liftHands + Math.abs(sway) * .08;
    return {hands:[[lx, y], [rx, y]], feet:standingFeet, lift:0, squash:1 - .04 * Math.abs(sway)};
  }
  if (key === 'clap-beat') {
    const open = smooth(p, .06, .38) * (1 - smooth(p, .44, .75));
    const clap = smooth(p, .44, .75) * (1 - smooth(p, .82, 1));
    const x = .48 + .50 * open - .42 * clap;
    const y = .24 - .42 * Math.max(open, clap);
    return {hands:[[-x, y], [x, y]], feet:standingFeet, lift:0, squash:1 - .06 * clap};
  }
  if (key === 'alternate-pump') {
    const wave = Math.sin(smooth(p, .08, .86) * Math.PI * 2);
    const active = smooth(p, 0, .12) * (1 - smooth(p, .88, 1));
    const ly = .24 - (.62 + .54 * wave) * active;
    const ry = .24 - (.62 - .54 * wave) * active;
    return {hands:[[-.52, ly], [.52, ry]], feet:standingFeet, lift:.03 * Math.abs(wave), squash:1};
  }
  return {hands:[[-.48,.24],[.48,.24]], feet:standingFeet, lift:0, squash:1};
}

// Keep the trail beside the guide, clear of the face, hands and player badge.
export function drawDanceMotionCue(ctx,{key,x,y,size,progress,accent}) {
  if (!(size > 0)) return;
  const p = Number.isFinite(progress) ? progress : 0;
  let tailX, tailY, headX, headY, fraction;
  if (key === 'swipe-left' || key === 'swipe-right') {
    const sign = key === 'swipe-left' ? -1 : 1;
    tailX = sign * .50; headX = sign * 1.05;
    tailY = headY = .18;
    fraction = smooth(p,.20,.75);
  } else if (key === 'hands-pump') {
    const rising = p < .455;
    tailX = headX = .86;
    tailY = rising ? .13 : -.40;
    headY = rising ? -.40 : .13;
    fraction = rising ? smooth(p,.11,.42) : smooth(p,.46,.75);
  } else if (key === 'jump') {
    tailX = headX = .75; tailY = .77; headY = .23;
    fraction = smooth(p,.35,.73);
  } else if (key === 'squat') {
    tailX = headX = .78; tailY = .18; headY = .74;
    fraction = smooth(p,.12,.56);
  } else if (key === 'wave-both') {
    const right = p < .5;
    tailX = right ? -.45 : .45; headX = right ? .45 : -.45;
    tailY = headY = -1.18;
    fraction = right ? smooth(p,.08,.48) : smooth(p,.48,.88);
  } else if (key === 'clap-beat') {
    tailX = .98; headX = .36; tailY = headY = -.18;
    fraction = smooth(p,.44,.75);
  } else if (key === 'alternate-pump') {
    const leftUp = p < .5;
    tailX = headX = leftUp ? -.88 : .88;
    tailY = .22; headY = -.52;
    fraction = leftUp ? smooth(p,.08,.48) : smooth(p,.48,.86);
  } else return;

  ctx.save();
  ctx.translate(x,y);
  ctx.scale(size,size);
  const dx = headX - tailX, dy = headY - tailY;
  ctx.translate(tailX,tailY);
  ctx.rotate(Math.atan2(dy,dx));
  const length = Math.hypot(dx,dy), tip = length * (.69 + .31 * fraction);
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = accent;
  ctx.lineWidth = .035;
  ctx.globalAlpha *= .72;
  ctx.beginPath();
  ctx.moveTo(.075,0);
  ctx.lineTo(tip,0);
  ctx.moveTo(tip-.12,-.085);
  ctx.lineTo(tip,0);
  ctx.lineTo(tip-.12,.085);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(-.025,0,.025,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}
