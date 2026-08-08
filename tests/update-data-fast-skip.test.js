const fs=require('fs'),vm=require('vm'),path=require('path');
function ok(v,m){if(!v)throw new Error(m);}
const manifest=JSON.parse(fs.readFileSync('data/manifest.json','utf8'));
const c={window:{}};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('data/resumenes.electricidad.min.js','utf8'),c);
const files=c.SIMECO_SUMMARY_BUNDLE.files||{};
const list=manifest.files||[];
ok(list.length===17,`Manifest debe contener 17 PDF, tiene ${list.length}`);
ok(Object.keys(files).length===17,`Resumen debe registrar 17 huellas, tiene ${Object.keys(files).length}`);
for(const f of list){
  ok(fs.existsSync(path.join(process.cwd(),f.url)),`No existe ${f.url}`);
  ok(files[f.name],`No existe huella canónica para ${f.name}`);
  ok(files[f.name].fingerprint===f.sha,`SHA no coincide en ${f.name}`);
  ok(files[f.name].size===f.size,`Tamaño no coincide en ${f.name}`);
}
const app=fs.readFileSync('app.js','utf8');
ok(app.includes("if(previous && previous.fingerprint===fingerprint) skipped++;"),'Actualizar datos no omite facturas sin cambios');
ok(app.includes("const concurrency=Math.min(2,pending.length)"),'No existe límite de concurrencia para PDFs nuevos');
console.log(JSON.stringify({ok:true,pdfs:list.length,fastSkipReady:true}));
