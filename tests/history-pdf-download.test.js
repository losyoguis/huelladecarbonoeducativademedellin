const fs=require('fs'),vm=require('vm'),path=require('path');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
ok(app.includes('function historySourceDownloadHtml(item)'),'Falta renderizador de descarga PDF histórica');
ok(app.includes('class="history-source-download"'),'Falta enlace Descargar PDF');
ok(app.includes('download="${escapeHtml(name)}"'),'Falta atributo download');
ok(app.includes("sources:[]"),'El histórico no conserva fuentes');
ok(app.includes("sourceUrl||`data/${r.source}`"),'No se conserva URL de factura');
ok(css.includes('.history-source-download'),'Faltan estilos de descarga histórica');
ok(html.includes('app.js?v=98-sidebar-legible'),'Falta cache-busting v95');

const text=fs.readFileSync('data/resumenes.electricidad.min.js','utf8');
const ctx={window:{}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(text,ctx);
const summaries=ctx.SIMECO_SUMMARY_BUNDLE.summaries;
ok(summaries.length===17,`Se esperaban 17 resúmenes, hay ${summaries.length}`);
for(const s of summaries){
  ok(s.source&&s.sourceUrl,`Fuente incompleta en ${s.period}`);
  const f=path.join(process.cwd(),s.sourceUrl);
  ok(fs.existsSync(f),`PDF inexistente: ${s.sourceUrl}`);
  ok(fs.statSync(f).size>100000,`PDF vacío o inválido: ${s.sourceUrl}`);
}
console.log(JSON.stringify({ok:true,summaries:summaries.length,pdfs:summaries.length}));
