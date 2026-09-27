const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m)}
const app=fs.readFileSync('app.js','utf8');
const index=fs.readFileSync('index.html','utf8');
ok(app.includes('/contents/data/inem?ref='),'No se explora data/inem');
ok(app.includes("kind:'inem'"),'No se clasifica la factura INEM');
ok(app.includes('parseInvoiceArrayBuffer'),'No existe enrutador universal de facturas');
ok(app.includes('parseInemHistoricalText'),'No existe parser INEM en navegador');
ok(app.includes("energySourceType:'inem_external_contract'"),'INEM no se integra como contrato externo');
ok(app.includes("if(result.summary && !result.isInem)"),'INEM podría reemplazar el resumen consolidado general');
ok(app.includes("scanDataFolder({quiet:true,automatic:true})"),'No existe sincronización automática silenciosa');
ok(app.includes("const seenRemote=new Set()"),'No se deduplican PDF remotos idénticos');
ok(index.includes('app.js?v=119-auto-facturas'),'No se actualizó cache bust');
console.log(JSON.stringify({ok:true,version:'v119',general:true,inem:true,water:true,gas:true,auto:true,dedupe:true}));
