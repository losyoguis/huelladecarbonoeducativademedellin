const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
function context(files){
  const c={console,window:{},document:{addEventListener(){},getElementById(){return null}},Intl,Number,String,Set,Map,Math,Array,Object,encodeURIComponent,requestAnimationFrame:f=>f()};
  c.window=c;c.globalThis=c;vm.createContext(c);
  for(const f of files) vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
  return c;
}
const wc=context(['data/registros.agua.min.js','data/resumenes.agua.min.js','water.js']);
const gc=context(['data/registros.gas.min.js','data/resumenes.gas.min.js','gas.js']);

const wsites=wc.simecoWaterDebug.aggregateWaterSites().filter(s=>s.hasWater).sort((a,b)=>b.waterM3-a.waterM3);
const gsites=gc.simecoGasDebug.aggregateGasSites().filter(s=>s.hasGas).sort((a,b)=>b.gasM3-a.gasM3);
const wp=wc.simecoWaterDebug.buildWaterPlan(wsites[0]);
const gp=gc.simecoGasDebug.buildGasPlan(gsites[0]);
const wsvg=wc.simecoWaterDebug.buildWaterPlanHistoryChartSvg(wp.monthlyRows);
const gsvg=gc.simecoGasDebug.buildGasPlanHistoryChartSvg(gp.monthlyRows);

for(const [name,svg,rows,label] of [['agua',wsvg,wp.monthlyRows,'Consumo mensual de agua'],['gas',gsvg,gp.monthlyRows,'Consumo mensual de gas']]){
  ok(svg.includes('<svg class="plan-history-svg"'),`Falta SVG ${name}`);
  ok(svg.includes('width="100%" height="330"'),`SVG ${name} no está preparado para PDF`);
  ok(svg.includes(label),`Falta título ${name}`);
  ok((svg.match(/<rect /g)||[]).length>=rows.length,`Faltan barras ${name}`);
  ok(svg.includes('Último:'),`Falta indicador del último dato ${name}`);
}
const water=fs.readFileSync('water.js','utf8'),gas=fs.readFileSync('gas.js','utf8'),app=fs.readFileSync('app.js','utf8');
ok(water.includes('<div class="plan-history-chart water-plan-history-chart">${buildWaterPlanHistoryChartSvg(plan.monthlyRows)}</div>'),'El plan Agua no incluye gráfico antes de la tabla');
ok(gas.includes('<div class="plan-history-chart gas-plan-history-chart">${buildGasPlanHistoryChartSvg(plan.monthlyRows)}</div>'),'El plan Gas no incluye gráfico antes de la tabla');
ok(app.includes('.plan-history-svg{display:block;width:100%;height:auto;max-height:330px}'),'El documento A4 no incluye estilo para gráfico');
console.log(JSON.stringify({ok:true,waterPoints:wp.monthlyRows.length,gasPoints:gp.monthlyRows.length,waterSvg:true,gasSvg:true,pdfInline:true}));
