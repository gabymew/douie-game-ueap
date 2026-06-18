// A Jornada de Douie - protótipo HTML5 Canvas
// Controles: A/D ou setas para mover; W, seta para cima ou espaço para pular; R reinicia.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

const W = canvas.width, H = canvas.height;
const world = { width: 2600, height: 720 };
const assets = {};
const imageList = {
  bg:'assets/background.jpg',
  celestia:'assets/celestia.png',
  diamond:'assets/diamond.png',
  douie0:'assets/douie_0.png', douie1:'assets/douie_1.png', douie2:'assets/douie_2.png', douie3:'assets/douie_3.png',
  douie4:'assets/douie_4.png', douie5:'assets/douie_5.png', douie6:'assets/douie_6.png', douie7:'assets/douie_7.png',
  bug0:'assets/bug_0.png', bug1:'assets/bug_1.png', fly0:'assets/fly_0.png', fly1:'assets/fly_1.png'
};
let loaded = 0, total = Object.keys(imageList).length;
for (const [k,src] of Object.entries(imageList)) {
  const im = new Image(); im.src = src; assets[k] = im;
  im.onload = () => { loaded++; if (loaded===total) init(); };
  im.onerror = () => { loaded++; if (loaded===total) init(); };
}

const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

let camera = 0, last = 0, state;
const GRAVITY = 1850;
const MOVE = 390;
const JUMP = 760;

const platforms = [
  {x:0, y:628, w:520, h:92},
  {x:620, y:545, w:270, h:40},
  {x:1000, y:470, w:250, h:40},
  {x:1360, y:535, w:260, h:40},
  {x:1740, y:450, w:250, h:40},
  // Penúltima plataforma: móvel, funcionando como elevador.
  {x:2100, y:585, w:250, h:34, moving:true, minY:450, maxY:585, vy:-75, prevY:585},
  // Última plataforma: fixa, em formato de pedaço de terra.
  {x:2380, y:450, w:220, h:46, type:'sanctuary'}
];

function makeState(){
  return {
    started:false, won:false, lost:false, msgTimer:0,
    player:{x:150,y:360,w:95,h:164,vx:0,vy:0,onGround:false,dir:1,anim:0,hasFinal:false,inv:0},
    celestia:{x:32,y:432,w:112,h:175},
    enemies:[
      {type:'bug',x:690,y:480,w:82,h:55,vx:70,min:640,max:850,alive:true,anim:0},
      {type:'bug',x:1420,y:470,w:82,h:55,vx:-80,min:1370,max:1590,alive:true,anim:0},
      {type:'fly',x:1130,y:360,w:76,h:58,vx:60,min:1040,max:1230,alive:true,anim:0,baseY:360,t:0},
      {type:'bug',x:2430,y:395,w:82,h:55,vx:-80,min:2390,max:2520,alive:true,anim:0}
    ],
    gems:[
      {x:720,y:490,w:42,h:42,got:false},
      {x:1090,y:415,w:42,h:42,got:false},
      {x:1485,y:480,w:42,h:42,got:false},
      {x:1835,y:395,w:42,h:42,got:false}
    ],
    altar:{x:2440,y:305,w:110,h:145},
    finalGem:{x:2457,y:350,w:80,h:80,got:false},
    score:0
  };
}

function init(){ state = makeState(); requestAnimationFrame(loop); }
function reset(){ state = makeState(); camera = 0; }

function rects(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function update(dt){
  if (keys['r']) reset();
  const p = state.player;
  if (state.won || state.lost) return;

  // Atualiza plataformas móveis antes da física da personagem.
  for (const pl of platforms) {
    pl.prevY = pl.y;
    if (pl.moving) {
      pl.y += pl.vy * dt;
      if (pl.y <= pl.minY) { pl.y = pl.minY; pl.vy = Math.abs(pl.vy); }
      if (pl.y >= pl.maxY) { pl.y = pl.maxY; pl.vy = -Math.abs(pl.vy); }
    }
  }

  let left = keys['arrowleft'] || keys['a'];
  let right = keys['arrowright'] || keys['d'];
  let jump = keys[' '] || keys['arrowup'] || keys['w'];
  p.vx = 0;
  if (left && !right) { p.vx = -MOVE; p.dir = -1; state.started=true; }
  if (right && !left) { p.vx = MOVE; p.dir = 1; state.started=true; }
  if (jump && p.onGround) { p.vy = -JUMP; p.onGround = false; state.started=true; }

  p.vy += GRAVITY * dt;
  let oldY = p.y;
  p.x += p.vx * dt;
  p.x = clamp(p.x, 0, world.width - p.w);
  p.y += p.vy * dt;
  p.onGround = false;

  for (const pl of platforms) {
    const prevTop = (pl.prevY !== undefined) ? pl.prevY : pl.y;
    if (p.x+p.w > pl.x && p.x < pl.x+pl.w && oldY+p.h <= prevTop + 10 && p.y+p.h >= pl.y) {
      p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
    }
  }
  if (p.y > H+200) { state.lost = true; }

  if (Math.abs(p.vx)>1 && p.onGround) p.anim += dt*10; else p.anim = 0;

  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.anim += dt*8;
    e.x += e.vx * dt;
    if (e.x < e.min || e.x > e.max) e.vx *= -1;
    if (e.type==='fly') { e.t += dt; e.y = e.baseY + Math.sin(e.t*3)*26; }
    if (rects(p,e)) {
      const stomp = p.vy > 120 && (p.y + p.h - e.y) < 38;
      if (stomp) { e.alive = false; p.vy = -480; state.score += 50; }
      else if (p.inv <= 0) { state.lost = true; }
    }
  }

  for (const g of state.gems) {
    if (!g.got && rects(p,g)) { g.got = true; state.score += 10; }
  }
  if (!state.finalGem.got && rects(p,state.finalGem)) {
    state.finalGem.got = true; p.hasFinal = true; state.msgTimer = 3.2; state.score += 100;
  }
  if (p.hasFinal && rects(p, state.celestia)) {
    state.won = true;
  }

  camera = clamp(p.x + p.w/2 - W/2, 0, world.width-W);
  if (state.msgTimer>0) state.msgTimer -= dt;
}

function drawBackground(){
  const bg = assets.bg;
  const scale = H / bg.height;
  const bw = bg.width * scale;
  const par = camera * 0.26;
  let start = - (par % bw);
  for (let x=start-bw; x<W+bw; x+=bw) ctx.drawImage(bg, x, 0, bw, H);
  // distant haze
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(0,0,W,H);
}

function drawPlatform(pl){
  const x = Math.round(pl.x-camera), y=pl.y;
  ctx.fillStyle = '#3b7f37'; ctx.fillRect(x,y,pl.w,14);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x,y+14,pl.w,pl.h-14);
  ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=2; ctx.strokeRect(x,y,pl.w,pl.h);
}

function drawImageEntity(img, ent, flip=false){
  const x = Math.round(ent.x-camera), y=Math.round(ent.y);
  ctx.save();
  if (flip) { ctx.translate(x+ent.w, y); ctx.scale(-1,1); ctx.drawImage(img,0,0,ent.w,ent.h); }
  else ctx.drawImage(img,x,y,ent.w,ent.h);
  ctx.restore();
}


function drawFinalSanctuary(){
  const pl = platforms[platforms.length-1];
  const x = Math.round(pl.x-camera), y = pl.y;

  // base do pedaço de terra
  ctx.save();
  ctx.fillStyle = '#7d4c29';
  ctx.beginPath();
  ctx.moveTo(x+12, y+12);
  ctx.quadraticCurveTo(x+pl.w*0.15, y+pl.h+14, x+pl.w*0.36, y+pl.h+24);
  ctx.quadraticCurveTo(x+pl.w*0.50, y+pl.h+36, x+pl.w*0.68, y+pl.h+22);
  ctx.quadraticCurveTo(x+pl.w*0.84, y+pl.h+18, x+pl.w-8, y+10);
  ctx.lineTo(x+pl.w-8, y+8);
  ctx.lineTo(x+12, y+8);
  ctx.closePath();
  ctx.fill();

  // topo gramado
  ctx.fillStyle = '#3f8d3b';
  ctx.beginPath();
  ctx.moveTo(x+6, y+14);
  for(let i=0;i<pl.w;i+=16){
    const px = x + i;
    ctx.lineTo(px+6, y + 8 + Math.sin((px+camera)*0.08)*3);
    ctx.lineTo(px+12, y + 13 + Math.cos((px+camera)*0.07)*2);
  }
  ctx.lineTo(x+pl.w-6, y+14);
  ctx.lineTo(x+pl.w-6, y+4);
  ctx.lineTo(x+6, y+4);
  ctx.closePath();
  ctx.fill();

  // raízes decorativas
  ctx.strokeStyle = 'rgba(80,45,18,.95)';
  ctx.lineWidth = 4;
  [0.18,0.42,0.70].forEach(r=>{
    const rx = x + pl.w*r;
    ctx.beginPath();
    ctx.moveTo(rx, y+pl.h-4);
    ctx.bezierCurveTo(rx-10, y+pl.h+12, rx+6, y+pl.h+26, rx-6, y+pl.h+40);
    ctx.stroke();
  });

  const a = state.altar;
  const ax = Math.round(a.x-camera), ay = a.y, aw = a.w, ah = a.h;

  // brilho do santuário
  const grad = ctx.createRadialGradient(ax+aw/2, ay+40, 10, ax+aw/2, ay+55, 120);
  grad.addColorStop(0,'rgba(162,244,255,.22)');
  grad.addColorStop(0.5,'rgba(146,227,255,.10)');
  grad.addColorStop(1,'rgba(146,227,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(ax+aw/2, ay+62, 125, 95, 0, 0, Math.PI*2);
  ctx.fill();

  // altar de pedra
  ctx.fillStyle = '#b7b4bb';
  ctx.beginPath();
  ctx.moveTo(ax+18, ay+ah);
  ctx.lineTo(ax+aw-18, ay+ah);
  ctx.lineTo(ax+aw-26, ay+95);
  ctx.lineTo(ax+26, ay+95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d3d0d6';
  ctx.beginPath();
  ctx.moveTo(ax+14, ay+95);
  ctx.lineTo(ax+aw-14, ay+95);
  ctx.lineTo(ax+aw-28, ay+76);
  ctx.lineTo(ax+28, ay+76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ece8ef';
  ctx.beginPath();
  ctx.moveTo(ax+28, ay+76);
  ctx.lineTo(ax+aw-28, ay+76);
  ctx.lineTo(ax+aw/2+20, ay+50);
  ctx.lineTo(ax+aw/2-20, ay+50);
  ctx.closePath();
  ctx.fill();

  // ornamento atrás do diamante
  ctx.strokeStyle = 'rgba(230,247,255,.75)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ax+aw/2, ay+36, 28, Math.PI*1.02, Math.PI*1.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax+aw/2, ay+10);
  ctx.lineTo(ax+aw/2, ay+44);
  ctx.moveTo(ax+aw/2-18, ay+28);
  ctx.lineTo(ax+aw/2+18, ay+28);
  ctx.stroke();

  // folhagens amazônicas laterais
  function leaf(cx, cy, s, flip=1){
    ctx.save();
    ctx.translate(cx,cy); ctx.scale(flip,1);
    ctx.fillStyle = '#2c8a57';
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(12*s,-10*s, 18*s,-34*s);
    ctx.quadraticCurveTo(4*s,-26*s, -8*s,-6*s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  leaf(ax+20, ay+92, 1.1, 1);
  leaf(ax+28, ay+112, 0.9, 1);
  leaf(ax+aw-20, ay+92, 1.1, -1);
  leaf(ax+aw-28, ay+112, 0.9, -1);
  ctx.restore();
}

function drawDiamond(x,y,w,h, final=false){
  ctx.save();
  ctx.translate(Math.round(x-camera+w/2), Math.round(y+h/2));
  const bob = Math.sin(performance.now()/250 + x)*5;
  ctx.translate(0,bob);
  const img = assets.diamond;
  ctx.drawImage(img,-w/2,-h/2,w,h);
  if(final){
    ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,w*.63,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawUI(){
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.48)';
  roundRect(18,18,470,92,16); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 22px Arial';
  ctx.fillText('A Jornada de Douie', 38, 50);
  ctx.font='17px Arial';
  let objective = state.player.hasFinal ? 'Volte para Celestia com o diamante final.' : 'Chegue ao fim da fase e pegue o diamante final.';
  ctx.fillText(objective, 38, 80);
  ctx.fillText('Pontos: '+state.score, 38, 108);
  ctx.fillStyle='rgba(0,0,0,.42)'; roundRect(W-392,18,374,54,14); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='16px Arial'; ctx.fillText('Mover: A/D ou setas  |  Pular: espaço/W', W-372, 52);
  if (!state.started) centerMessage('Leve Douie até o diamante final e volte para Celestia.');
  if (state.msgTimer>0) centerMessage('Diamante final capturado. Agora volte para Celestia!');
  if (state.won) creditsScreen();
  if (state.lost) endScreen('Tente novamente', 'Pule sobre os insetos para eliminá-los. Pressione R para reiniciar.');
  ctx.restore();
}
function centerMessage(text){
  ctx.save(); ctx.fillStyle='rgba(0,0,0,.55)'; roundRect(W/2-335,H/2-45,670,90,18); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 22px Arial'; ctx.fillText(text,W/2,H/2+8); ctx.restore();
}

function creditsScreen(){
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.82)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.font='bold 54px Arial';
  ctx.fillText('CREDITS', W/2, 92);

  ctx.font='bold 22px Arial';
  ctx.fillText('TRABALHO PARA A DISCIPLINA DE ESTÁGIO', W/2, 148);
  ctx.font='20px Arial';
  wrapText('DO CURSO TECNOLOGIA EM DESIGN PELA UEAP, DESENVOLVIDO PELOS DISCENTES ISAURA FURTADO DOS SANTOS E NICOLAS FIGUEIREDO DO VALE, E A DOCENTE PROF. DRA. GABRIELLY DEL CARLO RICHENE.', W/2, 184, 980, 30);

  ctx.font='bold 22px Arial';
  ctx.fillText('ENGLISH TRANSLATION', W/2, 330);
  ctx.font='20px Arial';
  wrapText('PROJECT FOR THE INTERNSHIP COURSE OF THE TECHNOLOGY IN DESIGN PROGRAM AT UEAP, DEVELOPED BY THE STUDENTS ISAURA FURTADO DOS SANTOS AND NICOLAS FIGUEIREDO DO VALE, AND BY THE PROFESSOR PROF. DR. GABRIELLY DEL CARLO RICHENE.', W/2, 366, 980, 30);

  ctx.font='bold 26px Arial';
  ctx.fillText('AGRADECEMOS POR TER JOGADO E ESPERAMOS QUE TENHA GOSTADO =)', W/2, 548);
  ctx.font='22px Arial';
  ctx.fillText('THANK YOU FOR PLAYING, AND WE HOPE YOU ENJOYED IT =)', W/2, 588);
  ctx.font='18px Arial';
  ctx.fillText('Pressione R para reiniciar | Press R to restart', W/2, 650);
  ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight){
  const words = text.split(' ');
  let line = '';
  for (let n=0; n<words.length; n++){
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0){
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function endScreen(title, sub){
  ctx.save(); ctx.fillStyle='rgba(0,0,0,.70)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 54px Arial'; ctx.fillText(title,W/2,H/2-25);
  ctx.font='24px Arial'; ctx.fillText(sub,W/2,H/2+25); ctx.restore();
}
function roundRect(x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function render(){
  ctx.clearRect(0,0,W,H);
  drawBackground();
  platforms.forEach((pl, idx) => { if (idx !== platforms.length-1) drawPlatform(pl); });
  drawFinalSanctuary();
  // Celestia no início da fase
  drawImageEntity(assets.celestia, state.celestia, false);
  ctx.save(); ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='bold 18px Arial'; ctx.textAlign='center'; ctx.fillText('Celestia', state.celestia.x-camera+state.celestia.w/2, state.celestia.y-12); ctx.restore();

  for (const g of state.gems) if(!g.got) drawDiamond(g.x,g.y,g.w,g.h,false);
  if(!state.finalGem.got) drawDiamond(state.finalGem.x,state.finalGem.y,state.finalGem.w,state.finalGem.h,true);

  for (const e of state.enemies) {
    if(!e.alive) continue;
    const frame = Math.floor(e.anim)%2;
    if(e.type==='bug') drawImageEntity(assets['bug'+frame], e, e.vx<0);
    else drawImageEntity(assets['fly'+frame], e, e.vx<0);
  }

  const p=state.player;
  let frame=0;
  if (!p.onGround) frame=3;
  else if(Math.abs(p.vx)>1) frame = Math.floor(p.anim)%4;
  drawImageEntity(assets['douie'+frame], p, p.dir<0);
  drawUI();
}

function loop(t){
  let dt = Math.min(0.033, (t-last)/1000 || 0.016); last=t;
  update(dt); render(); requestAnimationFrame(loop);
}
