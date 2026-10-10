
const API = "https://api.alquran.cloud/v1/surah";
let verses = [];
let playing = false, raf = null, lastTime = 0, scrollY = 0;
let speed = Number(localStorage.getItem("quran-speed") || 25);

const $ = id => document.getElementById(id);
const setup = $("setup"), reader = $("reader"), versesEl = $("verses");
const title = $("title"), counter = $("counter"), message = $("message");
const numberInput = $("numberInput"), backBtn = $("backBtn"), nextBtn = $("nextBtn");
const decreaseBtn = $("decreaseBtn"), increaseBtn = $("increaseBtn");
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
const chapters=new Map();
// Verse counts from Al Quran Cloud, indexed by Surah number minus one.
const verseCounts=[7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

async function getChapter(s, signal){
  signal?.throwIfAborted();
  if(chapters.has(s))return chapters.get(s);
  const res=await fetch(`${API}/${s}/quran-uthmani`,{cache:"force-cache",signal});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const data=(await res.json()).data;
  if(!Array.isArray(data?.ayahs)||!data.ayahs.length)throw new Error("chapter");
  chapters.set(s,data);
  return data;
}

function updateRangeSummary(){
  $("rangeSummary").textContent=`السورة ${range.s} · من ${range.start} · إلى ${range.end}`;
}

function showStep(index){
  step=index;
  const field=fields[step];
  $("fieldLabel").textContent=field.label;
  $("stepCount").textContent=`${arabicDigits(step+1)}/٣`;
  numberInput.setAttribute("aria-label",field.accessible);
  numberInput.value=range[field.key];
  backBtn.hidden=step===0;
  nextBtn.textContent=step===fields.length-1?"تحميل":"التالي";
  updateRangeSummary();
  message.textContent="استخدم − / + ثم " + nextBtn.textContent;
  decreaseBtn.focus();
}

function saveStep(){
  range[fields[step].key]=numberInput.value.trim();
  updateRangeSummary();
}

async function advance(){
  saveStep();
  const n=Number(range[fields[step].key]);
  if(!Number.isInteger(n)||n<1||(step===0&&n>114)||(step===2&&n<Number(range.start))){
    message.textContent="أدخل رقمًا صحيحًا";
    decreaseBtn.focus();
    return;
  }
  if(step===0){
    range.start="1";
    range.end=String(verseCounts[n-1]);
    showStep(1);
  }else if(step<fields.length-1)showStep(step+1);
  else await loadRange();
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

let passageRequest=0;
async function loadRange(selection=range, {signal}={}){
  const s=Number(selection.s), start=Number(selection.start), end=Number(selection.end);
  if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(start)||start<1||
     !Number.isInteger(end)||end<start||end>verseCounts[s-1]){
    const error="Choose a Surah from 1 to 114 and a valid verse range within that Surah.";
    message.textContent="أدخل أرقامًا صحيحة ضمن السورة";
    return {ok:false,error};
  }
  const request=++passageRequest;
  stop();
  message.textContent="جارٍ التحميل…";
  try{
    const data=await getChapter(s,signal);
    signal?.throwIfAborted();
    if(request!==passageRequest)return {ok:false,error:"A newer passage request replaced this one."};
    const selected=data.ayahs.filter(v=>v.numberInSurah>=start && v.numberInSurah<=end);
    if(selected.length!==end-start+1)throw new Error("range");
    verses=selected.map(v=>({number:v.numberInSurah,text:v.text}));
    title.textContent=data.name || `سورة ${s}`;
    Object.assign(range,{s:String(s),start:String(start),end:String(end)});
    numberInput.value=range[fields[step].key];
    updateRangeSummary();
    localStorage.setItem("quran-range",JSON.stringify({s,start,end}));
    render(); saveCurrent();
    message.textContent="تم التحميل — اضغط Enter للتشغيل";
    setup.style.display="none";
    reader.focus();
    return {ok:true,s,start,end};
  }catch(e){
    const cancelled=signal?.aborted || e.name==="AbortError";
    if(request===passageRequest)message.textContent=cancelled?"تم إلغاء التحميل":"تعذر التحميل. تأكد من اتصال النظارة بالإنترنت.";
    return {ok:false,error:cancelled?"Opening the passage was cancelled.":"Could not load the passage. Check the glasses' internet connection and try again."};
  }
}

async function registerQuranTool(){
  const context=document.modelContext;
  if(typeof context?.registerTool!=="function")return;
  try{
    await context.registerTool({
      name:"open_quran_passage",
      description:"Open and display Arabic Quran verses in this Quran teleprompter. Use for requests to open a Surah/chapter and an ayah/verse range, such as Surah An-Nahl (16) verses 106 to 128, or Surah Yasin (36). Convert Surah names to their chapter numbers. Omit fromVerse for verse 1 and omit toVerse to read through the end of the Surah. This displays the passage without starting automatic scrolling.",
      inputSchema:{
        type:"object",
        properties:{
          surah:{type:"integer",minimum:1,maximum:114,description:"Quran Surah/chapter number, 1 to 114."},
          fromVerse:{type:"integer",minimum:1,description:"First ayah/verse to display, inclusive. Defaults to 1."},
          toVerse:{type:"integer",minimum:1,description:"Last ayah/verse to display, inclusive. Omit for the end of the Surah. For one verse, use the same number as fromVerse."}
        },
        required:["surah"],
        additionalProperties:false
      },
      async execute(input, {signal}={}){
        if(!input || !Number.isInteger(input.surah)||input.surah<1||input.surah>114 ||
           (input.fromVerse!==undefined&&!Number.isInteger(input.fromVerse)) ||
           (input.toVerse!==undefined&&!Number.isInteger(input.toVerse))){
          return {isError:true,content:[{type:"text",text:"Specify a Surah number from 1 to 114 and whole verse numbers."}]};
        }
        const result=await loadRange({s:input.surah,start:input.fromVerse??1,end:input.toVerse??verseCounts[input.surah-1]},{signal});
        return {isError:!result.ok,content:[{type:"text",text:result.ok?
          `Opened Surah ${result.s}, verses ${result.start} to ${result.end}.`:result.error}]};
      }
    });
  }catch(e){
    console.warn("Quran WebMCP tool could not be registered:",e);
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

function adjustNumber(delta){
  const limit=step===0?114:verseCounts[Number(range.s)-1];
  const current=Number(numberInput.value)||1;
  numberInput.value=String(Math.max(1,Math.min(limit,current+delta)));
  saveStep();
}
decreaseBtn.addEventListener("click",()=>adjustNumber(-1));
increaseBtn.addEventListener("click",()=>adjustNumber(1));
nextBtn.addEventListener("click",advance);
backBtn.addEventListener("click",()=>{saveStep();showStep(step-1)});
$("testInputBtn").addEventListener("click",()=>{window.location.href="input-test.html"});
numberInput.addEventListener("input",saveStep);
numberInput.addEventListener("change",saveStep);
reader.addEventListener("click",()=>{
  if(setup.style.display==="none")playPause();
});

document.addEventListener("keydown",e=>{
  if(e.isComposing || e.defaultPrevented)return;
  if(setup.style.display!=="none"){
    const setupControls=[decreaseBtn,increaseBtn,nextBtn,...(backBtn.hidden?[]:[backBtn]),$("testInputBtn")];
    const index=setupControls.indexOf(document.activeElement);
    if(index<0 || e.target!==document.activeElement)return;
    if(e.key==="ArrowUp"||e.key==="ArrowDown"){
      e.preventDefault();
      const next=index+(e.key==="ArrowDown" ? 1 : -1);
      setupControls[Math.max(0,Math.min(setupControls.length-1,next))].focus();
    }
    // Let Select activate the focused button.
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
showStep(0);

registerQuranTool();
