const fs=require('fs'),vm=require('vm');
function ok(v,m){if(!v)throw new Error(m);}
const errors=[];
function canvasContext(){
  const grad={addColorStop(){}};
  return new Proxy({createLinearGradient(){return grad},measureText(t){return {width:String(t||'').length*7}},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},rect(){},roundRect(){},save(){},restore(){},translate(){},rotate(){},clearRect(){},fillText(){}},{get(o,k){return k in o?o[k]:(()=>{})},set(o,k,v){o[k]=v;return true}});
}
const ids=['gasTotalOfficial','gasTotalDetail','gasReconciliation','gasSitesWithData','gasCoverageText','gasMonthlyAverage','gasAnalysisNarrative','gasAnalysisHighlights','gasMonthlyBody','gasHistoryChart','gasConsumptionPeriod','gasConsumptionSearch','gasConsumptionBody','gasConsumptionSummary','gasConsumptionPageInfo','gasConsumptionPrev','gasConsumptionNext','gasSavingsPeriod','gasSavingsSearch','gasSavingsBody','gasSavingsSummary','gasSavingsMetricHead','gasSavingsPageInfo','gasSavingsPrev','gasSavingsNext','gasPlanSites'];
const elements={};
for(const id of ids){
  elements[id]={id,value:'',innerHTML:'',textContent:'',disabled:false,style:{},hidden:false,parentElement:{clientWidth:1000},addEventListener(){},getContext:id==='gasHistoryChart'?canvasContext:undefined};
}
const c={
  console:{...console,error(...a){errors.push(a.join(' '));}},
  window:{devicePixelRatio:1,addEventListener(){}},
  document:{getElementById(id){return elements[id]||null},addEventListener(){},querySelector(){return null}},
  Intl,Number,String,Set,Map,Math,Array,Object,encodeURIComponent,requestAnimationFrame:f=>f()
};
c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of ['data/registros.gas.min.js','data/resumenes.gas.min.js','gas.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
c.simecoRefreshGas();
ok(errors.length===0,`Errores runtime Gas: ${errors.join(' | ')}`);
ok(/1\.094,52/.test(elements.gasTotalOfficial.textContent),'No renderiza total oficial de gas');
ok(elements.gasConsumptionBody.innerHTML.includes('m³'),'Ranking consumo gas no renderizó');
ok(elements.gasSavingsBody.innerHTML.includes('Plan'),'Ranking ahorro gas no renderizó');
ok(elements.gasMonthlyBody.innerHTML.includes('PDF'),'Histórico gas no renderizó fuentes');
console.log(JSON.stringify({ok:true,runtimeErrors:errors.length,total:elements.gasTotalOfficial.textContent,consumptionRendered:true,savingsRendered:true}));
