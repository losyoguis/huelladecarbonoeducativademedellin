const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const c={window:{}};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('data/registros.agua.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('data/resumenes.agua.min.js','utf8'),c);
const rows=c.SIMECO_WATER_RECORDS,s=c.SIMECO_WATER_SUMMARY_BUNDLE.summaries;
ok(rows.length===9147,'Deben existir 9.147 registros base');
const valid=rows.filter(r=>r.waterM3!==null&&r.waterM3!==undefined&&Number.isFinite(Number(r.waterM3)));
ok(valid.length===7317,`Lecturas de agua esperadas 7317, hay ${valid.length}`);
ok(valid.filter(r=>Number(r.waterM3)===0).length===256,'Las lecturas de 0 m³ deben conservarse');
const detail=valid.reduce((a,r)=>a+Number(r.waterM3),0);
ok(Math.abs(detail-1337964.432)<0.001,`Total detallado inesperado ${detail}`);
const official=s.reduce((a,r)=>a+Number(r.waterM3||0),0);
ok(Math.abs(official-1351583.22)<0.01,`Total oficial inesperado ${official}`);
ok(s.length===17,'Deben existir 17 periodos oficiales de agua');
console.log(JSON.stringify({ok:true,records:rows.length,waterReadings:valid.length,zeroM3:256,detailWaterM3:detail,officialWaterM3:official}));
