if (window.vkBridge) {
  vkBridge.send("VKWebAppInit").catch(() => {});
  vkBridge.send("VKWebAppSetViewSettings", {
    status_bar_style: "dark",
    action_bar_color: "#eef7ff",
    navigation_bar_color: "#eef7ff"
  }).catch(() => {});
}

const canvas=document.getElementById("canvas");
const ctx=canvas.getContext("2d");
const stage=document.getElementById("stage");
const app=document.getElementById("app");
const brushEl=document.getElementById("brush");
const percentText=document.getElementById("percent");
const progress=document.getElementById("progress");
const statusText=document.getElementById("status");
const note=document.getElementById("note");
const finish=document.getElementById("finish");
const orderBtn=document.getElementById("orderBtn");

const dirty=new Image();
dirty.src="До.jpg";

let drawing=false, finished=false, cols=0, rows=0, lastFoam=0;
let cleaned=new Set();
let shown25=false, shown50=false, shown75=false;
const cell=14;

let audioCtx=null, noiseNode=null, noiseGain=null;

orderBtn.addEventListener("click",()=>{
  const url="https://vk.com/club225727068";
  if(window.vkBridge){
    vkBridge.send("VKWebAppOpenLink",{url}).catch(()=>{window.location.href=url});
  } else {
    window.open(url,"_blank");
  }
});

function initAudio(){
  if(audioCtx)return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
}

function startSound(){
  initAudio();
  if(noiseNode)return;
  const bufferSize=audioCtx.sampleRate;
  const buffer=audioCtx.createBuffer(1,bufferSize,audioCtx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1)*0.32;
  noiseNode=audioCtx.createBufferSource();
  noiseNode.buffer=buffer;
  noiseNode.loop=true;
  const filter=audioCtx.createBiquadFilter();
  filter.type="bandpass";
  filter.frequency.value=760;
  filter.Q.value=0.85;
  noiseGain=audioCtx.createGain();
  noiseGain.gain.value=0.035;
  noiseNode.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseNode.start();
}

function stopSound(){
  if(noiseGain&&audioCtx) noiseGain.gain.setTargetAtTime(0,audioCtx.currentTime,0.04);
  setTimeout(()=>{
    if(noiseNode){
      try{noiseNode.stop()}catch(e){}
      noiseNode.disconnect();
      noiseNode=null;
      noiseGain=null;
    }
  },170);
}

function successSound(){
  initAudio();
  const now=audioCtx.currentTime;
  [523.25,659.25,783.99].forEach((freq,i)=>{
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    osc.type="sine";
    osc.frequency.value=freq;
    gain.gain.setValueAtTime(0.001,now+i*.09);
    gain.gain.linearRampToValueAtTime(.08,now+i*.09+.02);
    gain.gain.exponentialRampToValueAtTime(.001,now+i*.09+.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now+i*.09);
    osc.stop(now+i*.09+.32);
  });
}

function resizeCanvas(){
  const r=stage.getBoundingClientRect();
  canvas.width=r.width;
  canvas.height=r.height;
  cols=Math.ceil(canvas.width/cell);
  rows=Math.ceil(canvas.height/cell);
  cleaned=new Set();
  if(dirty.complete){
    ctx.globalCompositeOperation="source-over";
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(dirty,0,0,canvas.width,canvas.height);
  }
  percentText.textContent="0";
  progress.style.width="0%";
}

dirty.onload=resizeCanvas;
window.addEventListener("resize",resizeCanvas);

function getPos(e){
  const r=canvas.getBoundingClientRect();
  const p=e.touches?e.touches[0]:e;
  return {x:p.clientX-r.left,y:p.clientY-r.top};
}

function cleanAt(x,y){
  const brush=Math.max(58,canvas.width*0.14);
  const g=ctx.createRadialGradient(x,y,brush*.08,x,y,brush);
  g.addColorStop(0,"rgba(0,0,0,1)");
  g.addColorStop(.70,"rgba(0,0,0,.94)");
  g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.globalCompositeOperation="destination-out";
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.ellipse(x,y,brush*1.25,brush*.86,-.18,0,Math.PI*2);
  ctx.fill();
  ctx.globalCompositeOperation="source-over";
  markCleaned(x,y,brush);
  effects(x,y);
}

function markCleaned(x,y,brush){
  const minX=Math.max(0,Math.floor((x-brush*1.25)/cell));
  const maxX=Math.min(cols-1,Math.floor((x+brush*1.25)/cell));
  const minY=Math.max(0,Math.floor((y-brush)/cell));
  const maxY=Math.min(rows-1,Math.floor((y+brush)/cell));
  for(let gy=minY;gy<=maxY;gy++){
    for(let gx=minX;gx<=maxX;gx++){
      const cx=gx*cell+cell/2;
      const cy=gy*cell+cell/2;
      const dx=(cx-x)/(brush*1.25);
      const dy=(cy-y)/(brush*.86);
      if(dx*dx+dy*dy<1) cleaned.add(gx+"-"+gy);
    }
  }
  updateProgress();
}

function updateProgress(){
  const ratio=cleaned.size/(cols*rows);
  let percent=Math.floor(ratio*100);
  if(ratio<0.90&&percent>98) percent=98;
  percentText.textContent=percent;
  progress.style.width=percent+"%";
  if(percent>=25&&!shown25){shown25=true;note.textContent="✨ Уже видно настоящий цвет ковра"}
  if(percent>=50&&!shown50){shown50=true;note.textContent="🫧 Пена работает — половина пути пройдена"}
  if(percent>=75&&!shown75){shown75=true;note.textContent="💎 Почти готово — ковёр заметно свежее"}
  if(ratio>=0.90&&!finished) finishCleaning();
}

function effects(x,y){
  const now=Date.now();
  if(now-lastFoam<45)return;
  lastFoam=now;
  const ar=app.getBoundingClientRect();
  const sr=stage.getBoundingClientRect();
  for(let i=0;i<8;i++){
    const f=document.createElement("div");
    f.className="foam";
    const s=8+Math.random()*22;
    f.style.width=s+"px";
    f.style.height=s+"px";
    f.style.left=(x+sr.left-ar.left+Math.random()*74-37)+"px";
    f.style.top=(y+sr.top-ar.top+Math.random()*60-30)+"px";
    app.appendChild(f);
    setTimeout(()=>f.remove(),950);
  }
  for(let i=0;i<4;i++){
    const sp=document.createElement("div");
    sp.className="spray";
    sp.style.left=(x+sr.left-ar.left+Math.random()*42-21)+"px";
    sp.style.top=(y+sr.top-ar.top+Math.random()*42-21)+"px";
    sp.style.setProperty("--dx",(Math.random()*72-36)+"px");
    sp.style.setProperty("--dy",(Math.random()*-58-8)+"px");
    app.appendChild(sp);
    setTimeout(()=>sp.remove(),700);
  }
}

function moveBrush(x,y){
  brushEl.style.display="block";
  brushEl.style.left=x+"px";
  brushEl.style.top=y+"px";
  brushEl.style.transform="translate(-50%,-50%) rotate("+(-17+Math.sin(Date.now()/105)*8)+"deg)";
}

function finishCleaning(){
  if(finished)return;
  finished=true;
  stopSound();
  ctx.globalCompositeOperation="destination-out";
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation="source-over";
  percentText.textContent="100";
  progress.style.width="100%";
  statusText.innerHTML="🏆 Ковёр спасён: <span id='percent'>100</span>%";
  note.textContent="Вот так выглядит профессиональная чистка";
  brushEl.style.display="none";
  finish.style.display="block";
  successSound();
  confetti();
  setTimeout(()=>finish.scrollIntoView({behavior:"smooth",block:"nearest"}),250);
}

function confetti(){
  const colors=["#1477ff","#57b6ff","#ffd166","#ef476f","#06d6a0"];
  for(let i=0;i<95;i++){
    const c=document.createElement("div");
    c.className="confetti";
    c.style.left=Math.random()*100+"%";
    c.style.background=colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDelay=Math.random()*.8+"s";
    c.style.animationDuration=(1.2+Math.random()*1.5)+"s";
    app.appendChild(c);
    setTimeout(()=>c.remove(),3000);
  }
}

function move(e){
  if(!drawing||finished)return;
  e.preventDefault();
  const p=getPos(e);
  startSound();
  cleanAt(p.x,p.y);
  moveBrush(p.x,p.y);
}

canvas.addEventListener("mousedown",e=>{drawing=true;move(e)});
canvas.addEventListener("mousemove",move);
canvas.addEventListener("mouseup",()=>{drawing=false;brushEl.style.display="none";stopSound()});
canvas.addEventListener("mouseleave",()=>{drawing=false;brushEl.style.display="none";stopSound()});
canvas.addEventListener("touchstart",e=>{drawing=true;move(e)},{passive:false});
canvas.addEventListener("touchmove",move,{passive:false});
canvas.addEventListener("touchend",()=>{drawing=false;brushEl.style.display="none";stopSound()});
