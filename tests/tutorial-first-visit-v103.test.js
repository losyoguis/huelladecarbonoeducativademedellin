const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes("const FIRST_VISIT_KEY='simeco-tutorial-bienvenida-v1';"),'La clave de primera visita no es estable');
ok(html.includes("localStorage.getItem(FIRST_VISIT_KEY)==='1'"),'No se consulta persistencia');
ok(html.includes("localStorage.setItem(FIRST_VISIT_KEY,'1')"),'No se registra la bienvenida');
ok(html.includes("sessionStorage.getItem(FIRST_VISIT_KEY)==='1'"),'Falta fallback sessionStorage');
ok(html.includes("if(!hasSeenWelcome())")&&html.includes("openTutorial({welcome:true})"),'No se abre automáticamente en primera visita');
ok(html.includes("openTutorial({welcome:false})"),'Los botones no abren en modo manual');
ok(html.includes("window.simecoOpenTutorial=openTutorial"),'API manual incorrecta');

ok(html.includes("window.SIMECO_TUTORIAL_WELCOME_OPEN=true"),'No se marca bienvenida abierta');
ok(html.includes("window.SIMECO_TUTORIAL_WELCOME_OPEN=false"),'No se limpia bienvenida abierta');
ok(html.includes("if(window.SIMECO_TUTORIAL_WELCOME_OPEN)"),'Fast boot no conserva loader detrás');
ok(html.includes("window.simecoStartWelcomeVideo"),'Falta inicio de video tras datos');
ok(html.includes("if(!welcomeMode || window.SIMECO_FAST_BOOT_DONE)"),'YouTube puede competir con datos en primera visita');

ok(html.includes('id="tutorialWelcomeStatus" hidden'),'Falta estado de carga dentro del tutorial');
ok(html.includes('id="tutorialWelcomeProgressBar"'),'Falta barra de progreso en bienvenida');
ok(html.includes("window.simecoSyncTutorialWelcomeProgress(100"),'No se sincroniza 100% al terminar datos');

ok(css.includes('.tutorial-modal.tutorial-first-visit .tutorial-modal-backdrop'),'Falta diseño primera visita');
ok(css.includes('.tutorial-welcome-status{'),'Falta tarjeta de estado');
ok(css.includes('.tutorial-welcome-progress-track{'),'Falta progreso visual');
ok(css.includes('.tutorial-modal.tutorial-waiting-data .tutorial-video-frame::before'),'Falta espera visual antes de YouTube');

console.log(JSON.stringify({
  ok:true,
  autoOnlyFirstVisit:true,
  persistent:true,
  loaderBehind:true,
  dataBeforeYoutube:true,
  manualAfterwards:true
}));
