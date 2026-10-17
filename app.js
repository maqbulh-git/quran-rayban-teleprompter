
const readerPage = window.location.pathname.endsWith("/reader.html");
const API = "https://api.alquran.cloud/v1/surah";
let verses = [];
let currentSurah=null;
let playing = false, raf = null, lastTime = 0, scrollY = 0;
let speed = Number(localStorage.getItem("quran-speed") || 25);

const $ = id => document.getElementById(id);
const setup = $("setup"), reader = $("reader"), versesEl = $("verses");
const playBtn=$("status"), resumeBtn=$("resumeBtn");
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
let step=0, numberStep=1;
const stepSizeBtn=$("stepSizeBtn");
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
  numberStep=1;
  updateNumberStep();
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
  endSpeedDrag();
  suppressReaderClickUntil=0;
  restart();
  if(readerPage){window.location.href="index.html";return;}
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
  endSpeedDrag();
  suppressReaderClickUntil=0;
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
    currentSurah=s;
    Object.assign(range,{s:String(s),start:String(start),end:String(end)});
    numberInput.value=range[fields[step].key];
    updateRangeSummary();
    localStorage.setItem("quran-range",JSON.stringify({s,start,end}));
    render(); saveCurrent();
    message.textContent="تم التحميل — اضغط Enter للتشغيل";
    setup.style.display="none";
    playBtn.focus();
    // Navigation reloads the host input mode; CSS changes cannot do this at runtime.
    // Defer until the current activation/WebMCP result can finish.
    if(!readerPage)setTimeout(()=>{window.location.href="reader.html";},300);
    return {ok:true,s,start,end};
  }catch(e){
    const cancelled=signal?.aborted || e.name==="AbortError";
    if(request===passageRequest)message.textContent=cancelled?"تم إلغاء التحميل":"تعذر التحميل. تأكد من اتصال النظارة بالإنترنت.";
    return {ok:false,error:cancelled?"Opening the passage was cancelled.":"Could not load the passage. Check the glasses' internet connection and try again."};
  }
}

// Search the plain Arabic edition; continue displaying Uthmani text in the reader.
let searchCorpus=null;
function normalizeVerseText(text){
  return text.normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,"")
    .replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي")
    .replace(/[^\u0621-\u063a\u0641-\u064a]+/g," ").trim().replace(/\s+/g," ");
}
async function getSearchCorpus(signal){
  signal?.throwIfAborted();
  if(searchCorpus)return searchCorpus;
  const res=await fetch("https://api.alquran.cloud/v1/quran/quran-simple-clean",{cache:"force-cache",signal});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const data=(await res.json()).data;
  if(!Array.isArray(data?.surahs)||data.surahs.length!==114)throw new Error("corpus");
  const index=data.surahs.flatMap(chapter=>chapter.ayahs.map(ayah=>({
    surah:chapter.number,surahName:chapter.name,verse:ayah.numberInSurah,text:ayah.text,
    normalized:" "+normalizeVerseText(ayah.text)+" "
  })));
  if(index.length!==6236)throw new Error("incomplete corpus");
  signal?.throwIfAborted();
  searchCorpus=index;
  return index;
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
    await context.registerTool({
      name:"navigate_quran_surah",
      description:"Move to the next or previous Quran Surah/chapter relative to the currently displayed passage. Use for requests such as 'next Surah', 'previous Surah', 'next chapter', or 'go back one Surah' while the Quran app is active. Opens exactly one adjacent Surah in full, from verse 1 to its final verse, with automatic scrolling paused. Does not wrap past Surah 1 or 114. Open a passage first if none is currently displayed.",
      inputSchema:{
        type:"object",
        properties:{direction:{type:"string",enum:["next","previous"],description:"Move forward one Surah (next) or back one Surah (previous)."}},
        required:["direction"],
        additionalProperties:false
      },
      async execute(input,{signal}={}){
        const reply=(isError,text)=>({isError,content:[{type:"text",text}]});
        if(!input || !["next","previous"].includes(input.direction))return reply(true,"Choose direction next or previous.");
        if(currentSurah===null)return reply(true,"Open a Quran passage first, then ask for the next or previous Surah.");
        if(surahMoving)return reply(true,"A Surah is already loading. Wait for it to open, then try again.");
        const s=currentSurah+(input.direction==="next"?1:-1);
        if(s<1 || s>114)return reply(true,s<1?"You are already at Surah 1; there is no previous Surah.":"You are already at Surah 114; there is no next Surah.");
        surahMoving=true;
        try{
          const result=await loadRange({s,start:1,end:verseCounts[s-1]},{signal});
          return reply(!result.ok,result.ok?`Opened Surah ${result.s}, verses ${result.start} to ${result.end}. Automatic scrolling is paused.`:result.error);
        }finally{surahMoving=false;}
      }
    });
    await context.registerTool({
      name:"search_quran_verse_text",
      description:"Find a Quran verse from Arabic words the user recites, quotes, or remembers. Pass the Arabic transcript, not a guessed Surah/verse number. Searches a consecutive phrase, ignoring diacritics and common letter variants. Supply at least two Arabic words. A unique match opens from that verse through the end of its Surah, paused. If several verses match, returns candidates without changing the passage: ask for more words or clarification, then use open_quran_passage for the chosen reference. This tool receives text only; it does not listen to audio or identify a reciter.",
      inputSchema:{
        type:"object",
        properties:{text:{type:"string",minLength:3,maxLength:1000,description:"At least two consecutive Arabic words from the verse; omit any introductory command or explanation."}},
        required:["text"],additionalProperties:false
      },
      async execute(input,{signal}={}){
        const reply=(isError,text)=>({isError,content:[{type:"text",text}]});
        if(typeof input?.text!=="string" || input.text.length>1000)return reply(true,"Supply up to 1000 characters of Arabic verse text.");
        const phrase=normalizeVerseText(input.text);
        if(!phrase || phrase.split(" ").length<2)return reply(true,"Supply at least two consecutive Arabic words from the verse.");
        try{
          const corpus=await getSearchCorpus(signal);
          signal?.throwIfAborted();
          const matches=corpus.filter(v=>v.normalized.includes(" "+phrase+" "));
          if(!matches.length)return reply(false,"No matching verse found. Ask for a longer or corrected Arabic phrase. No passage was changed.");
          if(matches.length>1){
            const candidates=matches.slice(0,10).map(({surah,surahName,verse,text})=>({surah,surahName,verse,text}));
            return reply(false,JSON.stringify({totalMatches:matches.length,candidates,opened:false,instruction:"Multiple verses match. Ask for more Arabic words or clarification; do not choose a verse automatically."}));
          }
          const match=matches[0];
          const result=await loadRange({s:match.surah,start:match.verse,end:verseCounts[match.surah-1]},{signal});
          return reply(!result.ok,result.ok?JSON.stringify({opened:true,surah:match.surah,surahName:match.surahName,verse:match.verse,toVerse:result.end,text:match.text,automaticScrolling:"paused"}):result.error);
        }catch(e){
          return reply(true,signal?.aborted||e.name==="AbortError"?"Verse search was cancelled.":"Could not search the Quran. Check the internet connection and try again.");
        }
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
  playBtn.textContent=playing?"⏸":"▶";
  playBtn.setAttribute("aria-label",playing?"Pause auto-scroll":"Play auto-scroll");
  playBtn.disabled=!readerPage;
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

// Glasses can emit several keydowns for one swipe, even without repeat=true.
let surahMoving=false, lastSurahSwipe=-Infinity;
async function moveSurah(direction){
  const now=performance.now();
  if(surahMoving || now-lastSurahSwipe<900)return;
  const s=Number(range.s)+direction;
  if(s<1||s>114)return;
  surahMoving=true;
  lastSurahSwipe=now;
  try{
    await loadRange({s,start:1,end:verseCounts[s-1]});
  }finally{
    surahMoving=false;
  }
}

// Drag belongs only to the reader; it never captures selection controls.
let speedDrag=null, suppressReaderClickUntil=0;
function endSpeedDrag(){
  const drag=speedDrag;
  speedDrag=null;
  if(drag && reader.hasPointerCapture?.(drag.id))reader.releasePointerCapture(drag.id);
}
function startSpeedDrag(e){
  if(setup.style.display!=="none" || e.isPrimary===false ||
     (e.button!==undefined&&e.button!==0) || !Number.isFinite(e.clientX))return;
  suppressReaderClickUntil=0;
  speedDrag={id:e.pointerId,x:e.clientX,speed,moved:false};
}
reader.addEventListener("pointerdown",startSpeedDrag);
playBtn.addEventListener("pointerdown",startSpeedDrag);
document.addEventListener("pointermove",e=>{
  if(!speedDrag || e.pointerId!==speedDrag.id || !Number.isFinite(e.clientX))return;
  const steps=Math.trunc((e.clientX-speedDrag.x)/25);
  if(steps!==0){
    speedDrag.moved=true;
    if(!reader.hasPointerCapture?.(e.pointerId))reader.setPointerCapture(e.pointerId);
  }
  const next=Math.max(5,Math.min(80,speedDrag.speed+steps*5));
  if(next!==speed){speed=next;updateStatus();}
});
document.addEventListener("pointerup",e=>{
  if(speedDrag?.id!==e.pointerId)return;
  if(speedDrag.moved)suppressReaderClickUntil=performance.now()+500;
  endSpeedDrag();
});
document.addEventListener("pointercancel",()=>{endSpeedDrag();suppressReaderClickUntil=0;});
reader.addEventListener("lostpointercapture",endSpeedDrag);
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){endSpeedDrag();suppressReaderClickUntil=0;}
});

function updateNumberStep(){
  stepSizeBtn.textContent=`×${numberStep}`;
  stepSizeBtn.setAttribute("aria-label",`Change step size, current ${numberStep}`);
}
stepSizeBtn.addEventListener("click",()=>{
  const sizes=[1,10,50];
  numberStep=sizes[(sizes.indexOf(numberStep)+1)%sizes.length];
  updateNumberStep();
});
function adjustNumber(delta){
  const limit=step===0?114:verseCounts[Number(range.s)-1];
  const current=Number(numberInput.value)||1;
  numberInput.value=String(Math.max(1,Math.min(limit,current+delta*numberStep)));
  saveStep();
}
resumeBtn.addEventListener("click",()=>{window.location.href="reader.html";});
decreaseBtn.addEventListener("click",()=>adjustNumber(-1));
increaseBtn.addEventListener("click",()=>adjustNumber(1));
nextBtn.addEventListener("click",advance);
backBtn.addEventListener("click",()=>{saveStep();showStep(step-1)});
$("testInputBtn").addEventListener("click",()=>{window.location.href="input-test.html"});
numberInput.addEventListener("input",saveStep);
numberInput.addEventListener("change",saveStep);
function activatePlayback(e){
  if(e.detail!==0 && performance.now()<suppressReaderClickUntil){suppressReaderClickUntil=0;return;}
  if(readerPage && setup.style.display==="none")playPause();
}
reader.addEventListener("click",activatePlayback);
playBtn.addEventListener("click",activatePlayback);

document.addEventListener("keydown",e=>{
  if(e.isComposing || e.defaultPrevented)return;
  if(setup.style.display!=="none"){
    const setupControls=[...(resumeBtn.hidden?[]:[resumeBtn]),decreaseBtn,increaseBtn,stepSizeBtn,nextBtn,...(backBtn.hidden?[]:[backBtn]),$("testInputBtn")];
    const index=setupControls.indexOf(document.activeElement);
    if(index<0 || e.target!==document.activeElement)return;
    if(e.key==="ArrowUp"||e.key==="ArrowDown"){
      e.preventDefault();
      const next=index+(e.key==="ArrowDown" ? 1 : -1);
      setupControls[Math.max(0,Math.min(setupControls.length-1,next))].focus();
    }
    if(e.key==="Enter" || e.key===" "){
      e.preventDefault();
      if(!e.repeat)document.activeElement.click();
    }
    // Handle activation explicitly: the glasses deliver Enter to focused controls.
    return;
  }
  if(["Enter"," ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape"].includes(e.key))e.preventDefault();
  if((e.key==="ArrowLeft"||e.key==="ArrowRight") && speedDrag?.moved)return;
  if(e.key==="Enter"||e.key===" "){
    if(!e.repeat){endSpeedDrag();suppressReaderClickUntil=0;playPause();}
  }
  else if(e.key==="ArrowUp")scrollPage(-1);
  else if(e.key==="ArrowDown")scrollPage(1);
  else if(e.key==="ArrowRight"&&!e.repeat)moveSurah(1);
  else if(e.key==="ArrowLeft"&&!e.repeat)moveSurah(-1);
  else if(e.key==="Escape")showSetup();
});

const restored=restore();
if(restored)currentSurah=Number(range.s);
if(!restored){
  verses=[{number:1,text:"اضغط تحميل لاختيار السورة والآيات"}];
  render();
}
updateStatus();
if(readerPage){
  if(restored){setup.style.display="none";playBtn.focus();}
  else window.location.replace("index.html");
}else {
  resumeBtn.hidden=!restored;
  showStep(0);
  if(restored)resumeBtn.focus();
}

registerQuranTool();
