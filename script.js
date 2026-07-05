const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");
const app = document.getElementById("app");
const extractor = document.getElementById("extractor");
const percentText = document.getElementById("percent");
const progress = document.getElementById("progress");
const statusText = document.getElementById("status");
const finish = document.getElementById("finish");

const dirty = new Image();
dirty.src = "До.jpg";

let drawing = false;
let cleaned = new Set();
let done = false;
let lastFoam = 0;
let shown25 = false, shown50 = false, shown75 = false;

function resizeCanvas(){
  const rect = stage.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  if(dirty.complete){
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(dirty,0,0,canvas.width,canvas.height);
  }
}
dirty.onload = resizeCanvas;
window.addEventListener("resize", resizeCanvas);

function pos(e){
  const rect = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return {x:p.clientX-rect.left, y:p.clientY-rect.top};
}

function brush(x,y){
  const size = canvas.width * 0.10;
  const g = ctx.createRadialGradient(x,y,size*.12,x,y,size);
  g.addColorStop(0,"rgba(0,0,0,1)");
  g.addColorStop(.58,"rgba(0,0,0,.74)");
  g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x,y,size*1.45,size*.68,-0.18,0,Math.PI*2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function foam(x,y){
  const now = Date.now();
  if(now-lastFoam<55) return;
  lastFoam = now;
  const ar = app.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();

  for(let i=0;i<7;i++){
    const dot = document.createElement("div");
    dot.className = "foam";
    const s = 8 + Math.random()*22;
    dot.style.width = s+"px";
    dot.style.height = s+"px";
    dot.style.left = (x + sr.left - ar.left + Math.random()*66-33) + "px";
    dot.style.top = (y + sr.top - ar.top + Math.random()*56-28) + "px";
    app.appendChild(dot);
    setTimeout(()=>dot.remove(),950);
  }

  if(Math.random()>.55){
    const sp = document.createElement("div");
    sp.className = "spark";
    sp.style.left = (x + sr.left - ar.left + Math.random()*60-30) + "px";
    sp.style.top = (y + sr.top - ar.top + Math.random()*50-25) + "px";
    app.appendChild(sp);
    setTimeout(()=>sp.remove(),800);
  }
}

function moveExtractor(x,y){
  extractor.style.display = "flex";
  extractor.style.left = x + "px";
  extractor.style.top = y + "px";
}

function update(x,y){
  const cell = 34;
  const cx = Math.floor(x/cell);
  const cy = Math.floor(y/cell);
  for(let dx=-1;dx<=1;dx++){
    for(let dy=-1;dy<=1;dy++){
      cleaned.add((cx+dx)+"-"+(cy+dy));
    }
  }
  const total = Math.ceil(canvas.width/cell) * Math.ceil(canvas.height/cell);
  const percent = Math.min(100, Math.floor((cleaned.size/total)*138));
  percentText.textContent = percent;
  progress.style.width = percent + "%";

  if(percent>=25 && !shown25){
    shown25=true;
    statusText.innerHTML = "✨ Уже видно настоящий цвет ковра — <span id='percent'>"+percent+"</span>%";
  }
  if(percent>=50 && !shown50){
    shown50=true;
    statusText.innerHTML = "🫧 Пена работает! Половина пути — <span id='percent'>"+percent+"</span>%";
  }
  if(percent>=75 && !shown75){
    shown75=true;
    statusText.innerHTML = "💎 Почти готово! Ковёр заметно свежее — <span id='percent'>"+percent+"</span>%";
  }
  if(percent<25){
    statusText.innerHTML = "🧼 Очищено: <span id='percent'>"+percent+"</span>%";
  }
  if(percent>=100 && !done) complete();
}

function clean(e){
  if(!drawing || done) return;
  e.preventDefault();
  const p = pos(e);
  brush(p.x,p.y);
  foam(p.x,p.y);
  moveExtractor(p.x,p.y);
  update(p.x,p.y);
}

function complete(){
  done = true;
  extractor.style.display = "none";
  statusText.innerHTML = "🏆 Ковёр спасён: <span id='percent'>100</span>%";
  progress.style.width = "100%";
  finish.style.display = "block";
  confetti();
  setTimeout(()=>finish.scrollIntoView({behavior:"smooth", block:"nearest"}),250);
}

function confetti(){
  const colors = ["#1477ff","#57b6ff","#ffd166","#ef476f","#06d6a0"];
  for(let i=0;i<90;i++){
    const p = document.createElement("div");
    p.className = "confetti";
    p.style.left = Math.random()*100 + "%";
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDelay = Math.random()*0.75 + "s";
    p.style.animationDuration = (1.2 + Math.random()*1.4) + "s";
    app.appendChild(p);
    setTimeout(()=>p.remove(),2800);
  }
}

canvas.addEventListener("mousedown", e => {drawing=true; clean(e)});
canvas.addEventListener("mousemove", clean);
canvas.addEventListener("mouseup", () => {drawing=false; extractor.style.display="none"});
canvas.addEventListener("mouseleave", () => {drawing=false; extractor.style.display="none"});

canvas.addEventListener("touchstart", e => {drawing=true; clean(e)}, {passive:false});
canvas.addEventListener("touchmove", clean, {passive:false});
canvas.addEventListener("touchend", () => {drawing=false; extractor.style.display="none"});
