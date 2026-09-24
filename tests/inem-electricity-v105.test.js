const fs=require('fs'),path=require('path'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const ROOT=process.cwd();
const pdf='data/inem/INEM ENERO - JULIO 115445775150.pdf';
ok(fs.existsSync(pdf),'Falta PDF eléctrico INEM en data/inem');
ok(!fs.existsSync('data/INEM ENERO - JULIO 115445775150.pdf'),'El PDF INEM no debe quedar suelto en data/');
ok(fs.statSync(pdf).size>100000,'PDF INEM inválido o vacío');

const c={window:{}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('data/registros.electricidad.min.js','utf8'),c);
const rows=c.SIMECO_REGISTROS.filter(r=>/inem/i.test(String(r.site))&&String(r.address).includes('48')&&String(r.address).includes('125'));
const y2026=rows.filter(r=>String(r.period).startsWith('2026-')&&r.energyKwh!==null&&r.energyKwh!==undefined);
ok(y2026.length>=7,`INEM debe conservar al menos enero-julio de 2026; hay ${y2026.length} meses integrados`);
const expected={
  '2026-01':28035.74,'2026-02':34099.41,'2026-03':40306.74,'2026-04':38848.52,
  '2026-05':40285.50,'2026-06':37241.51,'2026-07':39643.75
};
for(const [period,value] of Object.entries(expected)){
  const row=y2026.find(r=>r.period===period);ok(row,`Falta ${period}`);
  ok(Math.abs(Number(row.energyKwh)-value)<0.001,`Consumo incorrecto ${period}: ${row.energyKwh}`);
  ok(String(row.sourceUrl||'').startsWith('data/inem/'),`Fuente INEM incorrecta en ${period}: ${row.sourceUrl}`);
  ok(fs.existsSync(String(row.sourceUrl)),`No existe la evidencia ${row.sourceUrl}`);
  ok(Number(row.page)===1,`Página de evidencia incorrecta en ${period}`);
}
const total=y2026.reduce((a,r)=>a+Number(r.energyKwh),0);
ok(total>=258461.17-0.001,`El total INEM no puede ser inferior a la línea base ene-jul 2026: ${total}`);
const co2=y2026.reduce((a,r)=>a+Number(r.co2kg||0),0);
ok(co2>=32566.108-0.02,`El CO₂ INEM no puede ser inferior a la línea base ene-jul 2026: ${co2}`);

const compact=JSON.parse(fs.readFileSync('data/registros.compact.json','utf8'));
const cols=compact.c,dict=compact.d,n=compact.dictColumns.length;
const decoded=compact.r.map(a=>{const o={};for(let i=0;i<cols.length;i++){const k=cols[i];o[k]=i<n?dict[k][a[i]]:a[i];}return o;});
const july=decoded.find(r=>/inem/i.test(String(r.site))&&r.period==='2026-07');
ok(july&&String(july.energySourceUrl||'').startsWith('data/inem/'),'El bundle API no conserva energySourceUrl del INEM');
ok(july.energyContract==='10887186','Contrato INEM incorrecto');
ok(july.energyServiceId==='121590204','Servicio suscrito INEM incorrecto');
ok(july.energyMarket==='Mercado No Regulado','Mercado INEM incorrecto');

const exceptions=JSON.parse(fs.readFileSync('data/excepciones-servicios.json','utf8'));
const ex=exceptions.exceptions.find(x=>/inem/i.test(String(x.displayName||x.site)));
ok(ex&&ex.status==='external_contract_integrated','La excepción INEM no está marcada como integrada');
ok(/kWh/.test(ex.dataState)&&/periodo/i.test(ex.dataState),'El estado INEM no documenta dinámicamente la serie integrada');

const app=fs.readFileSync('app.js','utf8');
ok(app.includes('isIntegratedExternalEnergyRecord'),'El total global no reconoce fuentes eléctricas contractuales integradas');
ok(app.includes("const DATA_VERSION = 'v107-light-20260924';"),'DATA_VERSION v105 ausente');
ok(fs.existsSync('tools/integrar_inem.py')&&fs.existsSync('tools/inem_energy.py'),'Faltan herramientas de integración INEM');
console.log(JSON.stringify({ok:true,months:y2026.length,totalKwh:total,co2kg:co2,contract:july.energyContract,source:july.energySourceUrl},null,2));
