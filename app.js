
const API = "https://api.alquran.cloud/v1/surah";
let verses = [];
let playing = false, raf = null, lastTime = 0, scrollY = 0;
let speed = Number(localStorage.getItem("quran-speed") || 25);

const $ = id => document.getElementById(id);
const setup = $("setup"), reader = $("reader"), versesEl = $("verses");
const title = $("title"), counter = $("counter"), message = $("message");
const numberInput = $("numberInput"), backBtn = $("backBtn"), nextBtn = $("nextBtn");
const fields = [
  {key:"s", label:"السورة", accessible:"Surah number"},
  {key:"start", label:"من الآية", accessible:"Start verse"},
  {key:"end", label:"إلى الآية", accessible:"End verse"}
];
const range = {s:"17", start:"1", end:"40"};
try{
  const saved=JSON.parse(localStorage.getItem("quran-range")||"null");
  if(saved)for(const field of fields)if(saved[field.key]!=null)range[field.key]=String(saved[field.key]);
}catch(e){}
let step=0;

function showStep(index){
  step=index;
  const field=fields[step];
  $("fieldLabel").textContent=field.label;
  $("stepCount").textContent=`${arabicDigits(step+1)}/٣`;
  numberInput.setAttribute("aria-label",field.accessible);
  numberInput.value=range[field.key];
  backBtn.hidden=step===0;
  nextBtn.textContent=step===fields.length-1?"تحميل":"التالي";
  $("rangeSummary").textContent=`السورة ${range.s} · من ${range.start} · إلى ${range.end}`;
  message.textContent="اكتب الرقم ثم اختر " + nextBtn.textContent;
  numberInput.focus();
}

function saveStep(){
  range[fields[step].key]=numberInput.value.trim();
}

function advance(){
  saveStep();
  const n=Number(range[fields[step].key]);
  if(!Number.isInteger(n)||n<1||(step===0&&n>114)||(step===2&&n<Number(range.start))){
    message.textContent="أدخل رقمًا صحيحًا";
    numberInput.focus();
    return;
  }
  if(step<fields.length-1)showStep(step+1);
  else loadRange();
}

function showSetup(){
  restart();
  setup.style.display="block";
  showStep(0);
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
  const s=Number(range.s), start=Number(range.start), end=Number(range.end);
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

nextBtn.addEventListener("click",advance);
backBtn.addEventListener("click",()=>{saveStep();showStep(step-1)});
reader.addEventListener("click",()=>{
  if(setup.style.display==="none")playPause();
});

document.addEventListener("keydown",e=>{
  if(e.isComposing || e.defaultPrevented)return;
  if(setup.style.display!=="none"){
    const setupControls=[numberInput,...(backBtn.hidden?[]:[backBtn]),nextBtn];
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
  if(["Enter"," ","ArrowUp","ArrowDown","Escape"].includes(e.key))e.preventDefault();
  if(e.key==="Enter"||e.key===" ")playPause();
  else if(e.key==="ArrowUp")speedUp();
  else if(e.key==="ArrowDown")speedDown();
  else if(e.key==="Escape")showSetup();
});

if(!restore()){
  verses=[{number:1,text:"اضغط تحميل لاختيار السورة والآيات"}];
  render();
}
updateStatus();
showStep(0);
