
const API = "https://api.alquran.cloud/v1/surah";
let verses = [];
let playing = false, raf = null, lastTime = 0, scrollY = 0;
let speed = Number(localStorage.getItem("quran-speed") || 25);

const $ = id => document.getElementById(id);
const setup = $("setup"), reader = $("reader"), versesEl = $("verses");
const title = $("title"), counter = $("counter"), message = $("message");

function arabicDigits(n){
  return String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[d]);
}

function saveCurrent(){
  localStorage.setItem("quran-last", JSON.stringify({
    verses, title:title.textContent, scrollY
  }));
}

function restore(){
  try{
    const x=JSON.parse(localStorage.getItem("quran-last")||"null");
    if(x && Array.isArray(x.verses) && x.verses.length){
      verses=x.verses; title.textContent=x.title||"القرآن الكريم";
      render(); scrollY=Math.min(Number(x.scrollY)||0,maxScroll());
      versesEl.style.transform=`translate3d(0,${-scrollY}px,0)`;
      return true;
    }
  }catch(e){}
  return false;
}

function maxScroll(){
  return Math.max(0, versesEl.offsetHeight-reader.clientHeight+100);
}

function render(){
  versesEl.innerHTML=verses.map(v =>
    `<article class="verse">${escapeHtml(v.text)} <span class="ayah">﴿${v.number}﴾</span></article>`
  ).join("");
  if(verses.length){
    counter.textContent=`${arabicDigits(verses[0].number)}–${arabicDigits(verses[verses.length-1].number)}`;
  }else counter.textContent="—";
  scrollY=0; versesEl.style.transform="translate3d(0,0,0)";
  updateStatus();
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",
  '"':"&quot;","'":"&#39;"}[c]));
}

async function loadRange(){
  stop();
  const s=Number($("surahInput").value), start=Number($("startInput").value),
        end=Number($("endInput").value);
  if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(start)||start<1||
     !Number.isInteger(end)||end<start){
    message.textContent="أدخل أرقامًا صحيحة";
    return;
  }
  message.textContent="جارٍ التحميل…";
  try{
    const res=await fetch(`${API}/${s}/quran-uthmani`,{cache:"force-cache"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const data=await res.json();
    const all=data.data.ayahs||[];
    const selected=all.filter(v=>v.numberInSurah>=start && v.numberInSurah<=end);
    if(!selected.length) throw new Error("range");
    verses=selected.map(v=>({number:v.numberInSurah,text:v.text}));
    title.textContent=data.data.name || `سورة ${s}`;
    localStorage.setItem("quran-range",JSON.stringify({s,start,end}));
    saveCurrent(); render();
    message.textContent="تم التحميل — اضغط Enter للتشغيل";
    setup.style.display="none";
  }catch(e){
    message.textContent="تعذر التحميل. تأكد من اتصال النظارة بالإنترنت.";
  }
}

function loop(t){
  if(!playing)return;
  if(!lastTime)lastTime=t;
  const dt=Math.min(80,t-lastTime)/1000; lastTime=t;
  scrollY+=speed*dt;
  const m=maxScroll();
  if(scrollY>=m){scrollY=m;stop();return}
  versesEl.style.transform=`translate3d(0,${-scrollY}px,0)`;
  if(Math.floor(t/1000)%2===0)saveCurrent();
  raf=requestAnimationFrame(loop);
}
function playPause(){
  if(!verses.length)return;
  if(playing)stop(); else {playing=true;lastTime=0;raf=requestAnimationFrame(loop);updateStatus()}
}
function stop(){
  playing=false; if(raf)cancelAnimationFrame(raf); raf=null;lastTime=0;updateStatus();saveCurrent();
}
function restart(){
  stop();scrollY=0;versesEl.style.transform="translate3d(0,0,0)";
}
function updateStatus(){
  $("status").textContent=playing?"⏸":"▶";
  $("speed").textContent=`سرعة ${arabicDigits(speed)}`;
  localStorage.setItem("quran-speed",speed);
}
function speedUp(){speed=Math.min(80,speed+5);updateStatus()}
function speedDown(){speed=Math.max(5,speed-5);updateStatus()}

$("loadBtn").addEventListener("click",loadRange);
reader.addEventListener("click",playPause);

document.addEventListener("keydown",e=>{
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter","Escape"," "].includes(e.key))e.preventDefault();
  if(e.key==="Enter"||e.key===" ")playPause();
  else if(e.key==="ArrowUp")speedUp();
  else if(e.key==="ArrowDown")speedDown();
  else if(e.key==="Escape"){restart();setup.style.display="block";}
});

const savedRange=JSON.parse(localStorage.getItem("quran-range")||"null");
if(savedRange){
  $("surahInput").value=savedRange.s; $("startInput").value=savedRange.start; $("endInput").value=savedRange.end;
}
if(!restore()){
  verses=[{number:1,text:"اضغط تحميل لاختيار السورة والآيات"}];
  render();
}
updateStatus();
