const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const errors=[];
function canvasContext(){
  const grad={addColorStop(){}};
  return new Proxy({createLinearGradient(){return grad},measureText(t){return {width:String(t||'').length*7}},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},rect(){},roundRect(){},save(){},restore(){},translate(){},rotate(){},clearRect(){},fillText(){}},{get(o,k){return k in o?o[k]:(()=>{})},set(o,k,v){o[k]=v;return true}});
}
const ids=['waterTotalOfficial','waterTotalDetail','waterReconciliation','waterSitesWithData','waterCoverageText','waterMonthlyAverage','waterAnalysisNarrative','waterAnalysisHighlights','waterMonthlyBody','waterHistoryChart','waterConsumptionPeriod','waterConsumptionSearch','waterConsumptionBody','waterConsumptionSummary','waterConsumptionPageInfo','waterConsumptionPrev','waterConsumptionNext','waterSavingsPeriod','waterSavingsSearch','waterSavingsBody','waterSavingsSummary','waterSavingsMetricHead','waterSavingsPageInfo','waterSavingsPrev','waterSavingsNext','waterPlanSites'];
const elements={};
for(const id of ids){
  elements[id]={id,value:'',innerHTML:'',textContent:'',disabled:false,style:{},hidden:false,parentElement:{clientWidth:1000},addEventListener(){},getContext:id==='waterHistoryChart'?canvasContext:undefined};
}
const c={
  console:{...console,error(...a){errors.push(a.join(' '));}},
  window:{devicePixelRatio:1,addEventListener(){}},
  document:{getElementById(id){return elements[id]||null},addEventListener(){},querySelector(){return null}},
  Intl,Number,String,Set,Map,Math,Array,Object,encodeURIComponent,requestAnimationFrame:f=>f()
};
c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of ['data/registros.agua.min.js','data/resumenes.agua.min.js','water.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.simecoRefreshWater();
ok(errors.length===0,`Errores runtime Agua: ${errors.join(' | ')}`);
ok(/1.351.583,22/.test(elements.waterTotalOfficial.textContent),'No renderiza total oficial');
ok(elements.waterConsumptionBody.innerHTML.includes('m³'),'Ranking de consumo no renderizó filas');
ok(elements.waterSavingsBody.innerHTML.includes('Plan'),'Ranking de ahorro no renderizó filas');
ok(elements.waterMonthlyBody.innerHTML.includes('PDF'),'Histórico de agua no renderizó fuentes');
console.log(JSON.stringify({ok:true,runtimeErrors:errors.length,total:elements.waterTotalOfficial.textContent,consumptionRendered:true,savingsRendered:true}));
