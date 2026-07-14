import Matter from "matter-js";
import "./style.css";

const { Engine, Bodies, Body, Composite, Events, Runner } = Matter;

type Mode = "daily" | "endless";
type HareKind = "classic" | "long" | "heavy" | "spring" | "sleepy" | "tiny";
type HareDef = { name: string; color: string; accent: string; width: number; height: number; density: number; bounce: number; friction: number };

const HARES: Record<HareKind, HareDef> = {
  classic: { name: "Classic Hare", color: "#f3a66f", accent: "#d97452", width: 82, height: 56, density: .0014, bounce: .18, friction: .75 },
  long: { name: "Long Hare", color: "#e5c37d", accent: "#bc8f50", width: 112, height: 42, density: .0011, bounce: .12, friction: .82 },
  heavy: { name: "Heavy Hare", color: "#8a766d", accent: "#5e514d", width: 94, height: 66, density: .0042, bounce: .05, friction: .95 },
  spring: { name: "Spring Hare", color: "#e98a9e", accent: "#c45d78", width: 70, height: 56, density: .001, bounce: .72, friction: .6 },
  sleepy: { name: "Sleepy Hare", color: "#9eb3d4", accent: "#6f85ad", width: 91, height: 51, density: .0017, bounce: .04, friction: 1 },
  tiny: { name: "Tiny Hare", color: "#eee4d1", accent: "#bdb3a4", width: 55, height: 43, density: .0009, bounce: .22, friction: .7 },
};

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand" id="brand">
        <svg class="brand-mark" viewBox="0 0 70 70" aria-hidden="true"><path d="M30 32C19 16 23 3 29 4c8 1 7 19 8 23C42 10 51 5 55 10c5 7-7 18-13 24 9 3 14 9 13 18-2 13-18 16-30 11-13-5-15-20-7-27 3-3 7-4 12-4Z" fill="#ef744b" stroke="#27352b" stroke-width="4" stroke-linejoin="round"/><circle cx="41" cy="42" r="2.5" fill="#27352b"/><path d="M52 47c5 2 7 0 9-1M51 51c5 4 8 3 11 3" stroke="#27352b" stroke-width="2" stroke-linecap="round"/></svg>
        <span class="brand-name">hare<em>stack</em></span>
      </div>
      <div></div>
      <button class="icon-btn" id="soundBtn" aria-label="Toggle sound">♪</button>
    </header>
    <section class="game-wrap" id="gameWrap">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="stat"><div class="stat-label">Stack</div><div class="stat-value"><span id="stackCount">0</span><small>hares</small></div></div>
        <div class="stat"><div class="stat-label">Carrots</div><div class="stat-value">🥕 <span id="carrotCount">0</span></div></div>
      </div>
      <div class="next-card">
        <div class="next-label">On deck</div>
        <div class="next-hare" id="nextHare"></div>
        <div class="next-name" id="nextName"></div>
      </div>
      <div class="instruction" id="instruction"><span class="desktop-instruction">Move to aim · click to drop</span><span class="touch-instruction">Tap where you want to drop</span><span class="key">SPACE</span></div>
    </section>
    <div class="overlay open" id="startOverlay">
      <div class="panel">
        <svg class="start-hare" viewBox="0 0 180 140" aria-hidden="true"><ellipse cx="86" cy="94" rx="61" ry="35" fill="#f3a66f" stroke="#27352b" stroke-width="5"/><ellipse cx="127" cy="75" rx="32" ry="29" fill="#f3a66f" stroke="#27352b" stroke-width="5"/><path d="M116 54C98 24 100 4 111 5c13 1 14 32 14 44M132 51c5-30 22-45 30-37 9 10-9 31-20 42" fill="#f3a66f" stroke="#27352b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="137" cy="70" r="4" fill="#27352b"/><circle cx="157" cy="79" r="5" fill="#ef744b" stroke="#27352b" stroke-width="3"/><path d="M23 85c-17-12-27 9-15 20 7 6 18 1 22-6" fill="#eee4d1" stroke="#27352b" stroke-width="5"/><path d="M151 87c7 4 12 3 17 1M150 92c8 7 14 6 19 5" stroke="#27352b" stroke-width="2.5" stroke-linecap="round"/><path d="M51 119c-10 14 10 18 22 7M100 122c0 13 18 12 23 2" fill="none" stroke="#27352b" stroke-width="5" stroke-linecap="round"/></svg>
        <h1>Stack hares.<br/>Tempt fate.</h1>
        <p>Build high, collect carrots, and stop before it all goes spectacularly wrong.</p>
        <div class="button-row"><button class="btn btn-primary" id="dailyBtn">Today's stack</button><button class="btn btn-secondary" id="endlessBtn">Endless mode</button></div>
      </div>
    </div>
    <div class="overlay" id="resultOverlay"><div class="panel" id="resultPanel"></div></div>
    <div class="toast" id="toast">Copied to clipboard!</div>
  </main>`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const wrap = document.querySelector<HTMLDivElement>("#gameWrap")!;
const ctx = canvas.getContext("2d")!;
const engine = Engine.create({ gravity: { x: 0, y: 1, scale: .00115 } });
const runner = Runner.create();
Runner.run(runner, engine);

let width = 0, height = 0, dpr = 1;
let mode: Mode = "daily";
let playing = false, gameOver = false, settling = false, soundOn = true;
let score = 0, carrots = 0, turn = 0, aimX = 0, platformY = 0;
let nextKind: HareKind = "classic";
let seed = 1, rng = mulberry32(seed);
let platform: Matter.Body;
let hares: Matter.Body[] = [];
let carrot: {x:number;y:number;phase:number} | null = null;
let particles: {x:number;y:number;vx:number;vy:number;life:number;angle:number;spin:number}[] = [];
let audio: AudioContext | null = null;

function mulberry32(a: number) { return function() { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dailySeed() { const d = new Date(); return Number(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`); }
function rand() { return rng(); }
function chooseHare(): HareKind { const pool: HareKind[] = turn < 2 ? ["classic","long","tiny"] : ["classic","classic","long","heavy","spring","sleepy","tiny"]; return pool[Math.floor(rand()*pool.length)]; }

function resize() {
  const oldWidth = width, oldPlatformY = platformY;
  const rect = wrap.getBoundingClientRect(); width = rect.width; height = rect.height; dpr = Math.min(devicePixelRatio, 2);
  canvas.width = width*dpr; canvas.height = height*dpr; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; ctx.setTransform(dpr,0,0,dpr,0,0);
  platformY = height - Math.max(72, height*.11);
  if (platform) {
    const oldPlatformWidth = Math.min(390, oldWidth*.58);
    const platformWidth = Math.min(390, width*.58);
    Body.scale(platform, platformWidth / oldPlatformWidth, 1);
    Body.setPosition(platform, {x:width/2,y:platformY+22});

    // Keep an in-progress stack attached to the platform across rotations and
    // browser chrome changes instead of leaving it off-screen.
    const xScale = width / oldWidth;
    const yOffset = platformY - oldPlatformY;
    hares.forEach(hare => Body.setPosition(hare, {
      x: Math.max(24, Math.min(width - 24, hare.position.x * xScale)),
      y: hare.position.y + yOffset,
    }));
    if (carrot) {
      carrot.x = Math.max(24, Math.min(width - 24, carrot.x * xScale));
      carrot.y += yOffset;
    }
    aimX = Math.max(45, Math.min(width - 45, aimX * xScale));
  }
}
window.addEventListener("resize", resize); resize();
window.visualViewport?.addEventListener("resize", resize);

function resetWorld() {
  Composite.clear(engine.world, false); hares = []; particles = []; score = carrots = turn = 0; gameOver = settling = false;
  seed = mode === "daily" ? dailySeed() : Date.now(); rng = mulberry32(seed); aimX = width/2;
  platform = Bodies.rectangle(width/2, platformY+22, Math.min(390,width*.58), 44, {isStatic:true, chamfer:{radius:12}, label:"platform", friction:1});
  Composite.add(engine.world, platform);
  nextKind = chooseHare(); updateHud();
}

function start(which: Mode) {
  mode = which; playing = true; document.querySelector("#startOverlay")!.classList.remove("open");
  document.querySelector("#resultOverlay")!.classList.remove("open");
  resetWorld(); tone(320,.08,"sine",.05);
}

function drop() {
  if (!playing || gameOver || settling) return;
  const def = HARES[nextKind], y = Math.max(125, 155 - Math.min(score,8)*3);
  const body = Bodies.rectangle(aimX, y, def.width, def.height, { density:def.density, restitution:def.bounce, friction:def.friction, frictionStatic:1, chamfer:{radius:Math.min(20,def.height*.35)}, label:`hare:${nextKind}` });
  body.plugin = { kind: nextKind, born: performance.now(), sleeping: nextKind === "sleepy" };
  Body.setAngle(body, (rand()-.5)*.09); Composite.add(engine.world, body); hares.push(body);
  score++; turn++; settling = true; nextKind = chooseHare(); updateHud(); tone(nextKind === "heavy" ? 150 : 260,.08,"triangle",.05);
  if (!carrot && score > 1) spawnCarrot();
  setTimeout(() => { if (!gameOver) { settling=false; checkStack(); } }, nextKind === "spring" ? 1450 : 950);
}

function checkStack() {
  const fallen = hares.some(h => h.position.y > platformY+75 || h.position.x < -80 || h.position.x > width+80);
  if (fallen) endGame();
}

function spawnCarrot() {
  const platformWidth = Math.min(390,width*.58);
  carrot = {
    x: width/2 + (rand()-.5) * platformWidth*.72,
    y: Math.max(245, platformY - 145 - Math.min(score,7)*22),
    phase: rand()*Math.PI*2,
  };
}

function collectCarrot() {
  if (!carrot) return;
  carrots++; burst(carrot.x,carrot.y); carrot=null; updateHud(); tone(620,.09,"sine",.04);
}

function endGame() {
  if (gameOver) return; gameOver = true; playing = false; tone(90,.45,"sawtooth",.06);
  setTimeout(showResult, 900);
}

function showResult() {
  const best = Number(localStorage.getItem("harestack-best")||0); if(score>best) localStorage.setItem("harestack-best",String(score));
  document.querySelector("#resultPanel")!.innerHTML = `<div class="result-score">${score}</div><div class="result-stats"><div class="result-badge"><strong>🥕 ${carrots}</strong><span>carrots</span></div><div class="result-badge"><strong>★ ${Math.max(best,score)}</strong><span>personal best</span></div></div><div class="button-row"><button class="btn btn-primary" id="againBtn">Stack again</button><button class="btn btn-secondary" id="shareBtn">Share result</button></div>`;
  document.querySelector("#resultOverlay")!.classList.add("open");
  document.querySelector("#againBtn")!.addEventListener("click",()=>start(mode));
  document.querySelector("#shareBtn")!.addEventListener("click",shareResult);
}

async function shareResult() {
  const tower = Array.from({length:Math.min(score,8)},(_,i)=>" ".repeat(Math.max(0,7-i))+"🐇".repeat(Math.min(i+1,4))).join("\n");
  const text = `HARESTACK ${mode === "daily" ? new Date().toISOString().slice(0,10) : "ENDLESS"}\n\n${tower}\n\n${score} hares · ${carrots} carrots\nharestack.app`;
  try { if(navigator.share) await navigator.share({title:"My Harestack",text}); else { await navigator.clipboard.writeText(text); toast(); } } catch { /* cancelled */ }
}

function updateHud() {
  document.querySelector("#stackCount")!.textContent=String(score); document.querySelector("#carrotCount")!.textContent=String(carrots);
  const def=HARES[nextKind]; document.querySelector("#nextName")!.textContent=def.name;
  document.querySelector("#nextHare")!.innerHTML=miniHare(def);
}

function miniHare(d:HareDef) { return `<svg class="mini-hare" viewBox="0 0 100 80"><ellipse cx="45" cy="50" rx="34" ry="22" fill="${d.color}" stroke="#27352b" stroke-width="4"/><circle cx="72" cy="40" r="18" fill="${d.color}" stroke="#27352b" stroke-width="4"/><path d="M66 26C57 7 62 2 68 6l7 20M76 25C79 7 89 4 91 11l-8 18" fill="${d.color}" stroke="#27352b" stroke-width="4" stroke-linecap="round"/><circle cx="77" cy="38" r="2.5" fill="#27352b"/><circle cx="90" cy="44" r="3" fill="${d.accent}"/><circle cx="10" cy="45" r="10" fill="#f6eee0" stroke="#27352b" stroke-width="3"/></svg>`; }

function draw() {
  ctx.clearRect(0,0,width,height); drawBackground();
  const wind = Math.min(.000018, score*.0000017);
  if(playing && score>4 && Math.sin(performance.now()/650)>0) hares.forEach(h=>Body.applyForce(h,h.position,{x:wind,y:0}));
  if(playing && !settling) drawGuide();
  if(carrot) drawCarrot(carrot.x,carrot.y + Math.sin(performance.now()/420+carrot.phase)*5,1);
  drawPlatform(); hares.forEach(drawHare); checkCarrotCollection(); drawParticles();
  if(playing && hares.some(h=>h.position.y>height+40)) endGame();
  requestAnimationFrame(draw);
}

function drawBackground() {
  ctx.fillStyle="#a9d9da"; ctx.fillRect(0,0,width,height);
  ctx.fillStyle="#8fc8b0"; ctx.beginPath(); ctx.moveTo(0,platformY-35); for(let x=0;x<=width;x+=50) ctx.quadraticCurveTo(x+25,platformY-80-Math.sin(x*.02)*20,x+50,platformY-35); ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.fill();
  ctx.fillStyle="#6fa37b"; ctx.beginPath(); ctx.moveTo(0,platformY+10); for(let x=0;x<=width;x+=35) ctx.quadraticCurveTo(x+18,platformY-20-randVisual(x)*18,x+35,platformY+10);ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.fill();
}
function randVisual(x:number){return (Math.sin(x*12.9898)*43758.5453)%1;}

function drawGuide() {
  const d=HARES[nextKind]; ctx.save(); ctx.globalAlpha=.42; ctx.setLineDash([6,7]);ctx.strokeStyle="#27352b";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(aimX,105);ctx.lineTo(aimX,platformY-20);ctx.stroke();ctx.setLineDash([]); drawHareShape(aimX,112,d.width,d.height,0,d,false);ctx.restore();
}

function drawPlatform() {
  const w=Math.min(390,width*.58), x=width/2; ctx.save();ctx.translate(x,platformY);
  ctx.fillStyle="#3d6545";roundRect(-w/2+7,7,w,37,12);ctx.fill();ctx.fillStyle="#f0d18d";roundRect(-w/2,0,w,34,12);ctx.fill();ctx.strokeStyle="#27352b";ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle="#b47b52";ctx.fillRect(-w*.32,32,24,height-platformY);ctx.fillRect(w*.32-24,32,24,height-platformY);ctx.restore();
}

function drawHare(body:Matter.Body) {
  const kind=(body.plugin as {kind:HareKind}).kind, d=HARES[kind]; drawHareShape(body.position.x,body.position.y,d.width,d.height,body.angle,d,true);
}
function drawHareShape(x:number,y:number,w:number,h:number,angle:number,d:HareDef,details:boolean) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.lineWidth=3;ctx.strokeStyle="#27352b";ctx.lineJoin="round";
  ctx.fillStyle="rgba(39,53,43,.15)";ctx.beginPath();ctx.ellipse(3,h*.42,w*.43,h*.18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=d.color;roundRect(-w/2,-h/2,w,h,Math.min(18,h*.35));ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(w*.18,-h*.43);ctx.quadraticCurveTo(w*.08,-h*1.2,w*.22,-h*1.18);ctx.quadraticCurveTo(w*.36,-h*1.02,w*.32,-h*.42);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(w*.31,-h*.42);ctx.quadraticCurveTo(w*.39,-h*1.03,w*.51,-h*.94);ctx.quadraticCurveTo(w*.62,-h*.76,w*.43,-h*.32);ctx.fill();ctx.stroke();
  ctx.fillStyle="#f8f0dc";ctx.beginPath();ctx.arc(-w*.5,-h*.02,Math.min(11,h*.2),0,Math.PI*2);ctx.fill();ctx.stroke();
  if(details){ctx.fillStyle="#27352b";ctx.beginPath();ctx.arc(w*.28,-h*.1,2.8,0,Math.PI*2);ctx.fill();ctx.fillStyle=d.accent;ctx.beginPath();ctx.arc(w*.49,h*.02,4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(w*.48,h*.1);ctx.lineTo(w*.67,h*.16);ctx.moveTo(w*.47,h*.15);ctx.lineTo(w*.65,h*.27);ctx.stroke();}
  ctx.restore();
}
function roundRect(x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

function drawCarrot(x:number,y:number,scale:number,angle=.12) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale);
  ctx.strokeStyle="#27352b"; ctx.lineJoin="round"; ctx.lineCap="round";

  // Three broad leaves make the silhouette read clearly even at particle size.
  ctx.lineWidth=2.4; ctx.fillStyle="#4f8a55";
  ctx.beginPath(); ctx.moveTo(-5,-8); ctx.quadraticCurveTo(-20,-22,-13,-31); ctx.quadraticCurveTo(-2,-27,1,-10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle="#68a85f";
  ctx.beginPath(); ctx.moveTo(-1,-9); ctx.quadraticCurveTo(-5,-30,4,-35); ctx.quadraticCurveTo(13,-27,5,-8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle="#3f784c";
  ctx.beginPath(); ctx.moveTo(3,-8); ctx.quadraticCurveTo(18,-25,23,-17); ctx.quadraticCurveTo(22,-8,7,-4); ctx.closePath(); ctx.fill(); ctx.stroke();

  // A plump shoulder and clean central point give it a classic carrot shape.
  ctx.fillStyle="#f28a3d"; ctx.lineWidth=2.6;
  ctx.beginPath(); ctx.moveTo(-13,-8); ctx.quadraticCurveTo(0,-14,13,-8); ctx.quadraticCurveTo(12,8,1,31); ctx.quadraticCurveTo(-2,35,-5,27); ctx.quadraticCurveTo(-14,7,-13,-8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle="#c95f2e"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-8,2); ctx.lineTo(-1,4); ctx.moveTo(4,10); ctx.lineTo(9,8); ctx.moveTo(-4,17); ctx.lineTo(1,19); ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-6,-2,2.2,5,-.35,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function checkCarrotCollection() {
  if (!carrot || !playing) return;
  const caught = hares.some(h => Math.abs(h.position.x-carrot!.x) < 42 && Math.abs(h.position.y-carrot!.y) < 34);
  if (caught) collectCarrot();
}

function burst(x:number,y:number){for(let i=0;i<14;i++)particles.push({x,y,vx:(Math.random()-.5)*5.5,vy:-Math.random()*5-1,life:1,angle:(Math.random()-.5)*1.2,spin:(Math.random()-.5)*.18});}
function drawParticles(){particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=.025;p.angle+=p.spin;ctx.globalAlpha=Math.max(0,p.life);drawCarrot(p.x,p.y,.38,p.angle);});ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);}

function tone(freq:number,duration:number,type:OscillatorType,volume:number){if(!soundOn)return;audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
function toast(){const el=document.querySelector("#toast")!;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1600);}

function updateAim(e: PointerEvent) { const r=canvas.getBoundingClientRect(); aimX=Math.max(45,Math.min(width-45,e.clientX-r.left)); }
canvas.addEventListener("pointermove",updateAim);
canvas.addEventListener("pointerdown",e=>{e.preventDefault();updateAim(e);drop();document.querySelector("#instruction")!.classList.add("hidden");});
window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();drop();}});
document.querySelector("#dailyBtn")!.addEventListener("click",()=>start("daily"));
document.querySelector("#endlessBtn")!.addEventListener("click",()=>start("endless"));
document.querySelector("#brand")!.addEventListener("click",()=>{playing=false;document.querySelector("#startOverlay")!.classList.add("open");});
document.querySelector("#soundBtn")!.addEventListener("click",()=>{soundOn=!soundOn;document.querySelector("#soundBtn")!.textContent=soundOn?"♪":"×";});
Events.on(engine,"collisionStart",event=>{if(!playing)return;event.pairs.forEach(pair=>{if(pair.bodyA.label.startsWith("hare")||pair.bodyB.label.startsWith("hare"))tone(100+Math.random()*80,.04,"sine",.018);});});
requestAnimationFrame(draw);
