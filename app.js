
const API = "https://api.alquran.cloud/v1/surah";
let verses = [];
let playing = false, raf = null, lastTime = 0, scrollY = 0;
let speed = Number(localStorage.getItem("quran-speed") || 25);

const $ = id => document.getElementById(id);
const setup = $("setup"), reader = $("reader"), versesEl = $("verses");
const title = $("title"), counter = $("counter"), message = $("message");
const surahInput=$("surahInput"), startInput=$("startInput"), endInput=$("endInput");
const rangeInputs=[surahInput,startInput,endInput];
let committedSurah=17;
let composing=false;
const chapters=new Map();
// Verse counts from Al Quran Cloud, indexed by Surah number minus one.
const verseCounts=[7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

async function getChapter(s){
  if(chapters.has(s))return chapters.get(s);
  const res=await fetch(`${API}/${s}/quran-uthmani`,{cache:"force-cache"});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const data=(await res.json()).data;
  if(!Array.isArray(data?.ayahs)||!data.ayahs.length)throw new Error("chapter");
  chapters.set(s,data);
  return data;
}

function updateRangeSummary(){
  $("rangeSummary").textContent=`السورة ${surahInput.value} · من ${startInput.value} · إلى ${endInput.value}`;
}

function commitSurah(){
  const n=Number(surahInput.value);
  if(Number.isInteger(n)&&n>=1&&n<=114&&n!==committedSurah){
    committedSurah=n;
    startInput.value="1";
    endInput.value=String(verseCounts[n-1]);
  }
  updateRangeSummary();
}

function showSetup(){
  restart();
  setup.style.display="block";
  surahInput.focus();
}

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
  commitSurah();
  const s=Number(surahInput.value), start=Number(startInput.value), end=Number(endInput.value);
  if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(start)||start<1||
     !Number.isInteger(end)||end<start||end>verseCounts[s-1]){
    message.textContent="أدخل أرقامًا صحيحة";
    return;
  }
  message.textContent="جارٍ التحميل…";
  try{
    const data=await getChapter(s);
    const all=data.ayahs;
    const selected=all.filter(v=>v.numberInSurah>=start && v.numberInSurah<=end);
    if(!selected.length) throw new Error("range");
    verses=selected.map(v=>({number:v.numberInSurah,text:v.text}));
    title.textContent=data.name || `سورة ${s}`;
    localStorage.setItem("quran-range",JSON.stringify({s,start,end}));
    saveCurrent(); render();
    message.textContent="تم التحميل — اضغط Enter للتشغيل";
    setup.style.display="none";
    reader.focus();
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
function scrollPage(direction){
  stop();
  scrollY=Math.max(0,Math.min(maxScroll(),scrollY+direction*reader.clientHeight*0.75));
  versesEl.style.transform=`translate3d(0,${-scrollY}px,0)`;
  saveCurrent();
}

// Each permanent input owns its value. Input events never move focus or
// rewrite another field; only a committed Surah change resets verse defaults.
for(const input of rangeInputs){
  input.addEventListener("input",updateRangeSummary);
  input.addEventListener("change",input===surahInput?commitSurah:updateRangeSummary);
  input.addEventListener("compositionstart",()=>{composing=true});
  input.addEventListener("compositionend",()=>{composing=false});
}
for(const [input,key] of [[surahInput,"surah"],[startInput,"start"],[endInput,"end"]]){
  for(const [suffix,delta] of [["Minus",-1],["Plus",1]]){
    $(key+suffix).addEventListener("click",()=>{
      const limit=input===surahInput?114:verseCounts[Number(surahInput.value)-1];
      input.value=String(Math.max(1,Math.min(limit||1,(Number(input.value)||1)+delta)));
      if(input===surahInput)commitSurah();else updateRangeSummary();
    });
  }
}
$("loadBtn").addEventListener("click",loadRange);
const setupControls=[surahInput,$("surahMinus"),$("surahPlus"),startInput,$("startMinus"),$("startPlus"),endInput,$("endMinus"),$("endPlus"),$("loadBtn")];
reader.addEventListener("click",()=>{
  if(setup.style.display==="none")playPause();
});

document.addEventListener("keydown",e=>{
  if(composing || e.isComposing || e.defaultPrevented)return;
  if(setup.style.display!=="none"){
    const index=setupControls.indexOf(document.activeElement);
    if(index<0 || e.target!==document.activeElement)return;
    if(e.key==="ArrowUp"||e.key==="ArrowDown"){
      e.preventDefault();
      const next=index+(e.key==="ArrowDown" ? 1 : -1);
      setupControls[Math.max(0,Math.min(setupControls.length-1,next))].focus();
    }
    // Leave left/right for the text cursor and Select for the input composer.
    return;
  }
  if(["Enter"," ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape"].includes(e.key))e.preventDefault();
  if(e.key==="Enter"||e.key===" ")playPause();
  else if(e.key==="ArrowUp")scrollPage(-1);
  else if(e.key==="ArrowDown")scrollPage(1);
  else if(e.key==="ArrowRight")speedUp();
  else if(e.key==="ArrowLeft")speedDown();
  else if(e.key==="Escape")showSetup();
});

if(!restore()){
  verses=[{number:1,text:"اضغط تحميل لاختيار السورة والآيات"}];
  render();
}
updateStatus();
try{
  const saved=JSON.parse(localStorage.getItem("quran-range")||"null");
  if(saved){
    surahInput.value=String(saved.s);
    startInput.value=String(saved.start);
    endInput.value=String(saved.end);
  }
}catch(e){}
committedSurah=Number(surahInput.value);
updateRangeSummary();
surahInput.focus();
