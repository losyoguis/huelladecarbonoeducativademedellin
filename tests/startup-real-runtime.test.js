const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const listeners={};
const c={console,window:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},document:{getElementById(){return null}},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:(f)=>f(),performance,URL,Blob,TextEncoder,TextDecoder,Intl,navigator:{},location:{},history:{},addEventListener:(name,fn)=>{listeners[name]=fn}};
c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of ['data/registros.electricidad.min.js','data/resumenes.electricidad.min.js']) vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
vm.runInContext(fs.readFileSync('app.js','utf8'),c,{filename:'app.js'});
ok(vm.runInContext('state.records.length',c)===9147,'app.js no inicia con 9.147 registros');
ok(typeof listeners.DOMContentLoaded==='function','app.js no registró DOMContentLoaded');
ok(vm.runInContext("typeof siteKey",c)==='function','siteKey no está disponible durante el arranque');
const html=fs.readFileSync('index.html','utf8');
ok(html.includes('window.SIMECO_FAST_BOOT_DONE=true'),'Falta bootstrap inmediato');
ok(html.includes("overlay.style.display='none'"),'El bootstrap no oculta el loader');
ok(html.indexOf('data/registros.electricidad.min.js?v=93-agua') < html.indexOf('app.js?v=93-agua'),'Los datos no cargan antes de app.js');
console.log(JSON.stringify({ok:true,records:9147,runtime:'app-eval-real',fastBoot:true},null,2));
