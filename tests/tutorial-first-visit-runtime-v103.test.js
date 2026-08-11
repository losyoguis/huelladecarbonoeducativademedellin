const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}

const html=fs.readFileSync('index.html','utf8');
const marker="const FIRST_VISIT_KEY='simeco-tutorial-bienvenida-v1';";
const markerPos=html.indexOf(marker);
ok(markerPos>=0,'No se encontró controlador primera visita');
const scriptStart=html.lastIndexOf('<script>',markerPos);
const scriptEnd=html.indexOf('</script>',markerPos);
const code=html.slice(scriptStart+8,scriptEnd);

function classList(){
  const set=new Set();
  return {add(...x){x.forEach(v=>set.add(v))},remove(...x){x.forEach(v=>set.delete(v))},toggle(v,on){on?set.add(v):set.delete(v)},contains(v){return set.has(v)}};
}
function createEnv(initialSeen=false){
  const storage=new Map(initialSeen?[['simeco-tutorial-bienvenida-v1','1']]:[]);
  const welcome={hidden:true};
  const frame={
    dataset:{src:'https://www.youtube-nocookie.com/embed/SrQj2rXw1ow?start=18'},
    attrs:{},
    set src(v){this.attrs.src=v},
    get src(){return this.attrs.src||''},
    removeAttribute(k){delete this.attrs[k]}
  };
  const closeBtn={focus(){}};
  const modal={
    hidden:true,attrs:{},classList:classList(),
    setAttribute(k,v){this.attrs[k]=v},
    querySelector(sel){if(sel==='.tutorial-modal-close')return closeBtn;return null},
    querySelectorAll(){return []}
  };
  const elements={
    tutorialModal:modal,tutorialVideoFrame:frame,tutorialWelcomeStatus:welcome,
    tutorialWelcomeProgressBar:{style:{}},
    tutorialWelcomeProgressTrack:{setAttribute(){}},
    tutorialWelcomeProgressPercent:{textContent:''},
    tutorialWelcomeLoadingText:{textContent:''},
    invoiceLoading:{classList:classList(),attrs:{},style:{},setAttribute(k,v){this.attrs[k]=v}}
  };
  const body={classList:classList()};
  const doc={
    body,current:null,
    getElementById(id){return elements[id]||null},
    querySelectorAll(){return []},
    addEventListener(){},
    contains(){return true},
    documentElement:{}
  };
  const c={
    window:{},document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    sessionStorage:{getItem(){return null},setItem(){}},
    requestAnimationFrame:fn=>fn(),console
  };
  c.window=c;c.globalThis=c;c.document.body=body;
  vm.createContext(c);
  vm.runInContext(code,c,{filename:'tutorial-controller'});
  return {c,storage,modal,frame,welcome,elements};
}

// Primera visita: abre automáticamente, guarda estado, pero espera datos antes de cargar YouTube.
const first=createEnv(false);
ok(first.modal.hidden===false,'Primera visita no abrió modal');
ok(first.storage.get('simeco-tutorial-bienvenida-v1')==='1','Primera visita no quedó registrada');
ok(first.c.SIMECO_TUTORIAL_WELCOME_OPEN===true,'No se marcó bienvenida activa');
ok(!first.frame.attrs.src,'YouTube se cargó antes de los datos principales');
first.c.SIMECO_FAST_BOOT_DONE=true;
first.c.simecoStartWelcomeVideo();
ok(first.frame.attrs.src&&first.frame.attrs.src.includes('SrQj2rXw1ow'),'Video no inició después de datos');
first.c.simecoSyncTutorialWelcomeProgress(100,'Datos listos');
ok(first.elements.tutorialWelcomeProgressPercent.textContent==='100%','Progreso de bienvenida no llegó a 100%');
first.c.simecoCloseTutorial();
ok(first.modal.hidden===true,'Cerrar no ocultó tutorial');
ok(first.c.SIMECO_TUTORIAL_WELCOME_OPEN===false,'Cerrar no limpió bienvenida');

// Segunda visita: NO abre automáticamente.
const second=createEnv(true);
ok(second.modal.hidden===true,'Segunda visita abrió tutorial automáticamente');
ok(second.c.SIMECO_TUTORIAL_WELCOME_OPEN!==true,'Segunda visita marcó bienvenida activa');
second.c.simecoOpenTutorial();
ok(second.modal.hidden===false,'Botón/API manual no abre tutorial después de primera visita');

console.log(JSON.stringify({ok:true,firstAuto:true,secondAuto:false,dataBeforeYoutube:true,manualReopen:true}));
