const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const c={window:{}};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync('data/registros.gas.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('data/resumenes.gas.min.js','utf8'),c);
const rows=c.SIMECO_GAS_RECORDS,s=c.SIMECO_GAS_SUMMARY_BUNDLE.summaries;
ok(rows.length===9147,'Deben existir 9.147 registros base de gas');
const valid=rows.filter(r=>r.gasM3!==null&&r.gasM3!==undefined&&Number.isFinite(Number(r.gasM3)));
ok(valid.length===381,`Lecturas de gas esperadas 381, hay ${valid.length}`);
ok(valid.filter(r=>Number(r.gasM3)===0).length===304,'Las 304 lecturas de 0 m³ deben conservarse');
const detail=valid.reduce((a,r)=>a+Number(r.gasM3),0);
ok(Math.abs(detail-1095.658)<0.001,`Total detallado inesperado ${detail}`);
const official=s.reduce((a,r)=>a+Number(r.gasM3||0),0);
ok(Math.abs(official-1094.52)<0.001,`Total oficial inesperado ${official}`);
ok(s.length===17,'Deben existir 17 periodos oficiales de gas');
console.log(JSON.stringify({ok:true,records:rows.length,gasReadings:valid.length,zeroM3:304,detailGasM3:detail,officialGasM3:official}));
