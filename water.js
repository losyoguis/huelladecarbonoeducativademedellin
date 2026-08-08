/* SiMeCO₂ v95 · Módulo 8 Agua con gráfico histórico por sede */
(() => {
  'use strict';

  const PAGE_SIZE = 10;
  let consumptionPage = 0;
  let savingsPage = 0;
  let currentWaterPlan = null;

  const $w = id => document.getElementById(id);
  const fmt = (value, digits=2) => {
    if(value===null || value===undefined || value==='' || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('es-CO',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Number(value));
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const siteKeyWater = (site,address='') => `${norm(site)}|${norm(address)}`;
  const monthBeforeWater = period => {
    const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
    if(!m) return '';
    let y=Number(m[1]), mo=Number(m[2])-1;
    if(mo===0){mo=12;y--;}
    return `${y}-${String(mo).padStart(2,'0')}`;
  };
  const monthLabelWater = period => {
    const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
    if(!m) return String(period||'');
    const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${months[Number(m[2])-1]} ${m[1]}`;
  };
  const validWater = r => r && r.waterM3!==null && r.waterM3!==undefined && r.waterM3!=='' && Number.isFinite(Number(r.waterM3));
  const waterRecords = () => {
    const base=Array.isArray(window.SIMECO_WATER_RECORDS) ? window.SIMECO_WATER_RECORDS : [];
    let imported=[];
    try{
      if(typeof state!=='undefined' && Array.isArray(state.records)){
        imported=state.records.filter(r=>Object.prototype.hasOwnProperty.call(r,'waterM3') || Object.prototype.hasOwnProperty.call(r,'waterValue'));
      }
    }catch(_err){}
    if(!imported.length) return base;
    const replacementSources=new Set(imported.map(r=>r.source).filter(Boolean));
    return base.filter(r=>!replacementSources.has(r.source)).concat(imported);
  };
  const waterSummaries = () => {
    const base=Array.isArray(window.SIMECO_WATER_SUMMARY_BUNDLE?.summaries) ? window.SIMECO_WATER_SUMMARY_BUNDLE.summaries : [];
    let imported=[];
    try{
      if(typeof state!=='undefined' && Array.isArray(state.summaries)){
        imported=state.summaries.filter(s=>Object.prototype.hasOwnProperty.call(s,'waterM3') || Object.prototype.hasOwnProperty.call(s,'waterValue'));
      }
    }catch(_err){}
    if(!imported.length) return base;
    const replacementSources=new Set(imported.map(s=>s.source).filter(Boolean));
    return base.filter(s=>!replacementSources.has(s.source)).concat(imported).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
  };

  function displayName(record){
    try{
      if(typeof preferredSiteName === 'function'){
        const name=preferredSiteName(record);
        if(name) return name;
      }
    }catch(_err){}
    return record?.site || 'Sede sin nombre';
  }

  function mapLink(address,label,school=''){
    const text=String(address||'').trim();
    if(!text) return '<span class="not-available">Sin dirección</span>';
    const q=[school,text,'Medellín','Antioquia','Colombia'].filter(Boolean).join(' ');
    return `<a class="water-map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" title="Abrir ubicación en Google Maps">🏫 ${esc(label||text)}</a>`;
  }

  function aggregateWaterSites(source=waterRecords()){
    const map=new Map();
    for(const r of source){
      const key=siteKeyWater(r.site,r.address);
      if(!map.has(key)){
        map.set(key,{
          key,
          site:r.site||'Sede sin nombre',
          displaySite:displayName(r),
          address:r.address||'',
          periods:new Set(),
          waterPeriods:new Set(),
          waterM3:0,
          waterValue:0,
          waterValueAvailable:false,
          records:[]
        });
      }
      const item=map.get(key);
      item.records.push(r);
      if(r.period) item.periods.add(r.period);
      if(validWater(r)){
        item.waterPeriods.add(r.period);
        item.waterM3 += Number(r.waterM3);
      }
      if(r.waterValue!==null && r.waterValue!==undefined && r.waterValue!=='' && Number.isFinite(Number(r.waterValue))){
        item.waterValue += Number(r.waterValue);
        item.waterValueAvailable=true;
      }
    }
    return [...map.values()].map(item=>({
      ...item,
      periodCount:item.periods.size,
      waterPeriodCount:item.waterPeriods.size,
      hasWater:item.waterPeriods.size>0,
      avgWaterMonth:item.waterPeriods.size ? item.waterM3/item.waterPeriods.size : null
    }));
  }

  function officialWaterStats(){
    const rows=waterSummaries().filter(s=>s.waterM3!==null && s.waterM3!==undefined && Number.isFinite(Number(s.waterM3)));
    const total=rows.reduce((a,s)=>a+Number(s.waterM3),0);
    const avg=rows.length?total/rows.length:0;
    const sorted=[...rows].sort((a,b)=>Number(b.waterM3)-Number(a.waterM3));
    return {rows,total,avg,max:sorted[0]||null,min:sorted[sorted.length-1]||null};
  }

  function drawWaterHistory(){
    const canvas=$w('waterHistoryChart');
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const stats=officialWaterStats();
    const rows=stats.rows;
    const cssWidth=Math.max(760,canvas.parentElement?.clientWidth||1000);
    const width=Math.max(900,cssWidth);
    const height=410;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle='#123b46';ctx.font='bold 18px Arial';ctx.fillText('Consumo oficial mensual de agua (m³)',28,34);
    if(!rows.length){ctx.font='13px Arial';ctx.fillText('No hay datos oficiales de agua.',28,70);return;}
    const pad={l:70,r:28,t:72,b:62};
    const chartW=width-pad.l-pad.r,chartH=height-pad.t-pad.b;
    const max=Math.max(...rows.map(r=>Number(r.waterM3)||0),1);
    ctx.strokeStyle='#d6e7eb';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=pad.t+chartH*(i/4);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();
      const value=max*(1-i/4);
      ctx.fillStyle='#5c777d';ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(fmt(value,0),pad.l-8,y+4);
    }
    const step=chartW/rows.length;
    const barW=Math.max(14,Math.min(36,step*.58));
    rows.forEach((r,i)=>{
      const value=Number(r.waterM3)||0;
      const h=(value/max)*chartH;
      const x=pad.l+i*step+(step-barW)/2;
      const y=pad.t+chartH-h;
      const grad=ctx.createLinearGradient(0,y,0,pad.t+chartH);
      grad.addColorStop(0,'#1d9fd1');grad.addColorStop(1,'#75d5ea');
      ctx.fillStyle=grad;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x,y,barW,h,[8,8,2,2]); else ctx.rect(x,y,barW,h);
      ctx.fill();
      ctx.save();ctx.translate(x+barW/2,pad.t+chartH+12);ctx.rotate(-Math.PI/4);ctx.fillStyle='#46666d';ctx.font='10px Arial';ctx.textAlign='right';ctx.fillText(monthLabelWater(r.period),0,0);ctx.restore();
    });
    ctx.textAlign='left';
  }

  function renderWaterOverview(){
    const stats=officialWaterStats();
    const allSites=aggregateWaterSites();
    const waterSites=allSites.filter(s=>s.hasWater);
    const detailTotal=waterSites.reduce((a,s)=>a+s.waterM3,0);
    const difference=stats.total-detailTotal;
    const differencePct=stats.total?100*difference/stats.total:0;
    if($w('waterTotalOfficial')) $w('waterTotalOfficial').textContent=`${fmt(stats.total)} m³`;
    if($w('waterTotalDetail')) $w('waterTotalDetail').textContent=`${fmt(detailTotal)} m³`;
    if($w('waterReconciliation')) $w('waterReconciliation').textContent=`${fmt(Math.abs(differencePct),2)}% de diferencia frente al resumen oficial`;
    if($w('waterSitesWithData')) $w('waterSitesWithData').textContent=fmt(waterSites.length,0);
    if($w('waterCoverageText')) $w('waterCoverageText').textContent=`${fmt(100*waterSites.length/Math.max(1,allSites.length),1)}% de ${allSites.length} sedes/cuentas`;
    if($w('waterMonthlyAverage')) $w('waterMonthlyAverage').textContent=`${fmt(stats.avg)} m³`;

    if($w('waterAnalysisNarrative') && stats.max && stats.min){
      const first=stats.rows[0],last=stats.rows[stats.rows.length-1];
      const change=Number(first?.waterM3)>0?100*(Number(last.waterM3)-Number(first.waterM3))/Number(first.waterM3):null;
      $w('waterAnalysisNarrative').innerHTML=`Entre <strong>${esc(monthLabelWater(first.period))}</strong> y <strong>${esc(monthLabelWater(last.period))}</strong> se acumulan <strong>${fmt(stats.total)} m³</strong> de consumo oficial. El mes de mayor consumo fue <strong>${esc(monthLabelWater(stats.max.period))}</strong> con <strong>${fmt(stats.max.waterM3)} m³</strong>; el menor fue <strong>${esc(monthLabelWater(stats.min.period))}</strong> con <strong>${fmt(stats.min.waterM3)} m³</strong>. ${change===null?'':`El último periodo está <strong>${fmt(Math.abs(change),1)}% ${change<=0?'por debajo':'por encima'}</strong> del primer periodo disponible.`}`;
    }
    if($w('waterAnalysisHighlights') && stats.rows.length){
      const latest=stats.rows[stats.rows.length-1];
      const prevPeriod=monthBeforeWater(latest.period);
      const prev=stats.rows.find(r=>r.period===prevPeriod);
      const delta=prev?Number(prev.waterM3)-Number(latest.waterM3):null;
      $w('waterAnalysisHighlights').innerHTML=`
        <article><span>Mayor consumo mensual</span><strong>${fmt(stats.max.waterM3)} m³</strong><small>${esc(monthLabelWater(stats.max.period))}</small></article>
        <article><span>Menor consumo mensual</span><strong>${fmt(stats.min.waterM3)} m³</strong><small>${esc(monthLabelWater(stats.min.period))}</small></article>
        <article><span>Último periodo</span><strong>${fmt(latest.waterM3)} m³</strong><small>${esc(monthLabelWater(latest.period))}${delta===null?'':` · ${delta>=0?'↓ ahorro':'↑ aumento'} ${fmt(Math.abs(delta))} m³ vs. ${esc(monthLabelWater(prevPeriod))}`}</small></article>
      `;
    }

    const body=$w('waterMonthlyBody');
    if(body){
      body.innerHTML=stats.rows.map((r,i)=>{
        const prev=i?stats.rows[i-1]:null;
        const isConsecutive=prev && monthBeforeWater(r.period)===prev.period;
        const diff=isConsecutive?Number(r.waterM3)-Number(prev.waterM3):null;
        const pct=isConsecutive && Number(prev.waterM3)>0?100*diff/Number(prev.waterM3):null;
        const change=diff===null?'<span class="not-available">Sin mes consecutivo</span>':`<span class="water-change ${diff<=0?'down':'up'}">${diff<=0?'↓':'↑'} ${fmt(Math.abs(diff))} m³${pct===null?'':` · ${fmt(Math.abs(pct),1)}%`}</span>`;
        const url=r.sourceUrl||`data/${r.source}`;
        return `<tr><td>${esc(monthLabelWater(r.period))}</td><td><strong>${fmt(r.waterM3)} m³</strong></td><td>${change}</td><td><span>${esc(r.source||'Factura')}</span> <a class="source-download water-pdf-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" download="${esc(r.source||'factura.pdf')}">⬇ PDF</a></td></tr>`;
      }).join('');
    }
    drawWaterHistory();
  }

  function filteredConsumptionRows(){
    const period=$w('waterConsumptionPeriod')?.value||'';
    const query=norm($w('waterConsumptionSearch')?.value||'');
    const source=period?waterRecords().filter(r=>r.period===period):waterRecords();
    let rows=aggregateWaterSites(source).filter(s=>s.hasWater);
    if(query){
      const tokens=query.split(' ').filter(Boolean);
      rows=rows.filter(s=>{
        const hay=norm(`${s.displaySite} ${s.site} ${s.address}`);
        return tokens.every(t=>hay.includes(t));
      });
    }
    return rows.sort((a,b)=>b.waterM3-a.waterM3 || String(a.displaySite).localeCompare(String(b.displaySite),'es'));
  }

  function renderWaterConsumptionRanking(){
    const body=$w('waterConsumptionBody');
    if(!body) return;
    const rows=filteredConsumptionRows();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    consumptionPage=Math.max(0,Math.min(consumptionPage,pages-1));
    const start=consumptionPage*PAGE_SIZE;
    const visible=rows.slice(start,start+PAGE_SIZE);
    const period=$w('waterConsumptionPeriod')?.value||'';
    const total=rows.reduce((a,r)=>a+r.waterM3,0);
    if($w('waterConsumptionSummary')){
      const top=rows[0];
      $w('waterConsumptionSummary').innerHTML=top?`<strong>${rows.length} sedes con lectura.</strong> ${period?`Periodo: ${esc(monthLabelWater(period))}.`:'Acumulado de todos los periodos.'} Mayor consumo: <strong>${esc(top.displaySite)}</strong> con <strong>${fmt(top.waterM3)} m³</strong>. Total detallado de la selección: <strong>${fmt(total)} m³</strong>.`:'No hay sedes con lectura de agua para esta selección.';
    }
    body.innerHTML=visible.length?visible.map((r,i)=>`<tr>
      <td>${start+i+1}</td>
      <td><strong>${esc(r.displaySite)}</strong>${r.displaySite!==r.site?`<small class="invoice-alias">En factura: ${esc(r.site)}</small>`:''}</td>
      <td>${mapLink(r.address,r.address,r.displaySite)}</td>
      <td><strong>${fmt(r.waterM3)} m³</strong></td>
      <td>${fmt(r.avgWaterMonth)} m³</td>
      <td>${r.waterPeriodCount}/${r.periodCount}</td>
      <td><button type="button" class="water-plan-row-btn" data-water-plan-key="${esc(r.key)}">💧 Plan</button></td>
    </tr>`).join(''):'<tr><td colspan="7">No hay lecturas de agua para mostrar.</td></tr>';
    if($w('waterConsumptionPageInfo')) $w('waterConsumptionPageInfo').textContent=rows.length?`${start+1}–${Math.min(start+visible.length,rows.length)} de ${rows.length} · Página ${consumptionPage+1} de ${pages}`:'Sin resultados';
    if($w('waterConsumptionPrev')) $w('waterConsumptionPrev').disabled=consumptionPage<=0;
    if($w('waterConsumptionNext')) $w('waterConsumptionNext').disabled=consumptionPage>=pages-1;
  }

  function waterBySitePeriod(){
    const map=new Map();
    for(const r of waterRecords()){
      if(!validWater(r)) continue;
      const key=siteKeyWater(r.site,r.address);
      const compound=`${key}@@${r.period}`;
      if(!map.has(compound)) map.set(compound,{key,site:r.site,displaySite:displayName(r),address:r.address||'',period:r.period,waterM3:0});
      map.get(compound).waterM3+=Number(r.waterM3);
    }
    return map;
  }

  function buildWaterSavingsRows(){
    const selected=$w('waterSavingsPeriod')?.value||'';
    const byPeriod=waterBySitePeriod();
    const periods=[...new Set(waterRecords().map(r=>r.period).filter(Boolean))].sort();
    const siteMeta=new Map();
    for(const item of byPeriod.values()) if(!siteMeta.has(item.key)) siteMeta.set(item.key,item);
    const rows=[];
    for(const [key,meta] of siteMeta.entries()){
      const comparisons=[];
      const targets=selected?[selected]:periods.filter(p=>periods.includes(monthBeforeWater(p)));
      for(const currentPeriod of targets){
        const previousPeriod=monthBeforeWater(currentPeriod);
        const prev=byPeriod.get(`${key}@@${previousPeriod}`);
        const curr=byPeriod.get(`${key}@@${currentPeriod}`);
        if(!prev||!curr) continue;
        const previous=Number(prev.waterM3),current=Number(curr.waterM3);
        if(!Number.isFinite(previous)||!Number.isFinite(current)) continue;
        const delta=previous-current;
        const pct=previous>0?100*delta/previous:null;
        comparisons.push({previousPeriod,currentPeriod,previous,current,delta,pct});
      }
      if(!comparisons.length) continue;
      if(selected){
        const c=comparisons[0];
        if(!(c.delta>0)) continue;
        rows.push({...meta,comparisons,decreaseCount:1,decreaseRate:100,savingsM3:c.delta,netSavingsM3:c.delta,previousM3:c.previous,currentM3:c.current,savingsPercent:c.pct,rankingValue:c.delta});
      }else{
        const decreases=comparisons.filter(c=>c.delta>0);
        const increases=comparisons.filter(c=>c.delta<0);
        const net=comparisons.reduce((a,c)=>a+c.delta,0);
        if(!decreases.length||net<=0) continue;
        rows.push({...meta,comparisons,decreaseCount:decreases.length,increaseCount:increases.length,equalCount:comparisons.length-decreases.length-increases.length,decreaseRate:100*decreases.length/comparisons.length,savingsM3:decreases.reduce((a,c)=>a+c.delta,0),increaseM3:increases.reduce((a,c)=>a+Math.abs(c.delta),0),netSavingsM3:net,savingsPercent:null});
      }
    }
    if(!selected&&rows.length){
      const maxNet=Math.max(...rows.map(r=>Math.max(0,r.netSavingsM3)),1);
      rows.forEach(r=>{
        const consistency=Math.max(0,Math.min(100,r.decreaseRate));
        const magnitude=100*Math.max(0,r.netSavingsM3)/maxNet;
        r.managementScore=.70*consistency+.30*magnitude;
        r.rankingValue=r.managementScore;
      });
    }
    const query=norm($w('waterSavingsSearch')?.value||'');
    const filtered=query?rows.filter(r=>{
      const hay=norm(`${r.displaySite} ${r.site} ${r.address}`);
      return query.split(' ').filter(Boolean).every(t=>hay.includes(t));
    }):rows;
    return filtered.sort((a,b)=>selected?(b.rankingValue-a.rankingValue)||((b.savingsPercent||0)-(a.savingsPercent||0)):(b.managementScore-a.managementScore)||(b.decreaseRate-a.decreaseRate)||(b.netSavingsM3-a.netSavingsM3));
  }

  function renderWaterSavingsRanking(){
    const body=$w('waterSavingsBody');
    if(!body) return;
    const selected=$w('waterSavingsPeriod')?.value||'';
    const rows=buildWaterSavingsRows();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    savingsPage=Math.max(0,Math.min(savingsPage,pages-1));
    const start=savingsPage*PAGE_SIZE,visible=rows.slice(start,start+PAGE_SIZE);
    if($w('waterSavingsMetricHead')) $w('waterSavingsMetricHead').textContent=selected?'Reducción mensual':'Índice de gestión';
    if($w('waterSavingsSummary')){
      const top=rows[0];
      $w('waterSavingsSummary').innerHTML=top?selected
        ?`<strong>${rows.length} sedes con ahorro verificable.</strong> Mayor ahorro entre ${esc(monthLabelWater(monthBeforeWater(selected)))} y ${esc(monthLabelWater(selected))}: <strong>${esc(top.displaySite)}</strong>, <strong>${fmt(top.savingsM3)} m³</strong> menos.`
        :`<strong>${rows.length} sedes con ahorro neto y reducciones verificables.</strong> Mejor Índice de Gestión del Ahorro de Agua: <strong>${esc(top.displaySite)}</strong> con <strong>${fmt(top.managementScore,1)} puntos</strong>.`
        :'No hay sedes con ahorro verificable para esta selección.';
    }
    body.innerHTML=visible.length?visible.map((r,i)=>{
      const metric=selected?`<strong>↓ ${fmt(r.savingsM3)} m³</strong>`:`<strong>🏆 ${fmt(r.managementScore,1)} pts</strong>`;
      const saving=selected?`${fmt(r.savingsPercent,1)}% menos`:`Ahorro neto ${fmt(r.netSavingsM3)} m³`;
      const detail=selected?`${fmt(r.previousM3)} → ${fmt(r.currentM3)} m³`:`${r.decreaseCount}/${r.comparisons.length} comparaciones a la baja · ${fmt(r.decreaseRate,1)}% constancia`;
      return `<tr>
        <td>${start+i+1}</td>
        <td><strong>${esc(r.displaySite)}</strong></td>
        <td>${mapLink(r.address,r.address,r.displaySite)}</td>
        <td>${metric}</td>
        <td>${saving}</td>
        <td>${detail}</td>
        <td><button type="button" class="water-plan-row-btn" data-water-plan-key="${esc(r.key)}">💧 Plan</button></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7">No hay reducciones de agua verificables para mostrar.</td></tr>';
    if($w('waterSavingsPageInfo')) $w('waterSavingsPageInfo').textContent=rows.length?`${start+1}–${Math.min(start+visible.length,rows.length)} de ${rows.length} · Página ${savingsPage+1} de ${pages}`:'Sin resultados';
    if($w('waterSavingsPrev')) $w('waterSavingsPrev').disabled=savingsPage<=0;
    if($w('waterSavingsNext')) $w('waterSavingsNext').disabled=savingsPage>=pages-1;
  }

  function populateWaterFilters(){
    const periods=[...new Set(waterRecords().map(r=>r.period).filter(Boolean))].sort();
    const consumption=$w('waterConsumptionPeriod');
    if(consumption){
      const value=consumption.value;
      consumption.innerHTML='<option value="">Todos los periodos</option>'+periods.map(p=>`<option value="${esc(p)}">${esc(monthLabelWater(p))}</option>`).join('');
      consumption.value=periods.includes(value)?value:'';
    }
    const savings=$w('waterSavingsPeriod');
    if(savings){
      const value=savings.value;
      const comparable=periods.filter(p=>periods.includes(monthBeforeWater(p)));
      savings.innerHTML='<option value="">Tendencia general</option>'+comparable.map(p=>`<option value="${esc(p)}">${esc(monthLabelWater(p))} vs. ${esc(monthLabelWater(monthBeforeWater(p)))}</option>`).join('');
      savings.value=comparable.includes(value)?value:'';
    }
    const dataList=$w('waterPlanSites');
    if(dataList){
      const sites=aggregateWaterSites().sort((a,b)=>String(a.displaySite).localeCompare(String(b.displaySite),'es'));
      dataList.innerHTML=sites.map(s=>`<option value="${esc(s.displaySite)} — ${esc(s.address)}"></option>`).join('');
    }
  }

  function resolveWaterSite(value){
    const q=norm(value);
    if(!q) return null;
    const sites=aggregateWaterSites();
    const exact=sites.find(s=>[s.displaySite,s.site,s.address,`${s.displaySite} — ${s.address}`].some(v=>norm(v)===q));
    if(exact) return exact;
    const tokens=q.split(' ').filter(Boolean);
    const scored=sites.map(s=>{
      const name=norm(s.displaySite),raw=norm(s.site),address=norm(s.address),hay=`${name} ${raw} ${address}`;
      if(!tokens.every(t=>hay.includes(t))) return null;
      let score=0;
      tokens.forEach(t=>{if(name.startsWith(t))score+=8;else if(name.includes(t))score+=5;if(address.includes(t))score+=2;});
      return {s,score};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    return scored[0]?.s||null;
  }

  function percentile(values,p){
    if(!values.length) return null;
    const arr=[...values].sort((a,b)=>a-b);
    const idx=(arr.length-1)*p,lo=Math.floor(idx),hi=Math.ceil(idx);
    return arr[lo]+(arr[hi]-arr[lo])*(idx-lo);
  }

  function buildWaterPlan(site){
    const allSites=aggregateWaterSites();
    const waterSites=allSites.filter(s=>s.hasWater);
    const averages=waterSites.map(s=>s.avgWaterMonth).filter(Number.isFinite);
    const q75=percentile(averages,.75);
    const q25=percentile(averages,.25);
    const valid=site.records.filter(validWater).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
    const monthly=new Map();
    valid.forEach(r=>monthly.set(r.period,(monthly.get(r.period)||0)+Number(r.waterM3)));
    const monthlyRows=[...monthly.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([period,value])=>({period,value}));
    const latest=monthlyRows[monthlyRows.length-1]||null;
    const previous=latest?monthlyRows.find(x=>x.period===monthBeforeWater(latest.period)):null;
    const latestDelta=latest&&previous?previous.value-latest.value:null;
    const position=waterSites.sort((a,b)=>b.waterM3-a.waterM3).findIndex(s=>s.key===site.key)+1;
    let priority='Sin línea base',targetPct=null;
    if(site.hasWater){
      if(site.avgWaterMonth>=q75){priority='Alta';targetPct=15;}
      else if(site.avgWaterMonth<=q25){priority='Preventiva';targetPct=5;}
      else{priority='Media';targetPct=10;}
    }
    const targetMonthly=targetPct!==null?site.avgWaterMonth*(1-targetPct/100):null;
    const savingMonthly=targetPct!==null?site.avgWaterMonth*(targetPct/100):null;
    return {site,monthlyRows,latest,previous,latestDelta,priority,targetPct,targetMonthly,savingMonthly,position,q75,q25};
  }

  function planActions(plan){
    const trend=plan.latestDelta===null?'sin comparación mensual consecutiva':plan.latestDelta>=0?`reducción reciente de ${fmt(plan.latestDelta)} m³`:`aumento reciente de ${fmt(Math.abs(plan.latestDelta))} m³`;
    if(!plan.site.hasWater){
      return [
        ['1. Establecer línea base','Registrar la lectura del medidor o validar la factura de agua durante tres meses consecutivos.','Administración / Líder Ambiental','Mensual','3 meses con lectura válida'],
        ['2. Inspección de fugas','Revisar sanitarios, llaves, tanques, flotadores y redes visibles; registrar cada hallazgo.','Mantenimiento','Semanal','Número de fugas detectadas y corregidas'],
        ['3. Cultura del agua','Implementar campaña estudiantil de cierre de llaves y reporte inmediato de fugas.','Líderes Ambientales','30 días','Participación y reportes atendidos'],
        ['4. Medición antes de meta','No fijar una reducción porcentual hasta contar con una línea base confiable.','Comité Ambiental','90 días','Línea base aprobada']
      ];
    }
    return [
      ['1. Control de fugas','Realizar recorrido semanal por baños, cocinas, tanques y puntos de lavado; corregir goteos y fugas en máximo 48 horas.','Mantenimiento','Semanal','Fugas detectadas / corregidas'],
      ['2. Seguimiento del medidor',`Comparar lectura semanal y factura mensual. El diagnóstico actual muestra ${trend}.`,'Administración + Líder Ambiental','Semanal / mensual','m³ por semana y por mes'],
      ['3. Dispositivos ahorradores','Priorizar aireadores, llaves temporizadas y sanitarios de bajo consumo donde el diagnóstico técnico lo justifique.','Rectoría / Mantenimiento','60 días','Puntos intervenidos'],
      ['4. Protocolos de limpieza','Definir cantidades y horarios para lavado de patios, baños y zonas comunes, evitando manguera abierta sin control.','Servicios generales','Inmediato','m³/mes y cumplimiento de protocolo'],
      ['5. Aprovechamiento de lluvia','Evaluar recolección de agua lluvia para riego o limpieza no potable, con separación sanitaria adecuada.','PRAE / Área técnica','90 días','Litros aprovechados'],
      ['6. Cultura y corresponsabilidad','Activar campaña estudiantil “Cada gota cuenta” con reporte de fugas, señalización y socialización mensual de resultados.','Líderes Ambientales','Mensual','Reportes, evidencias y variación m³']
    ];
  }


  function buildWaterPlanHistoryChartSvg(rows){
    const data=Array.isArray(rows)?rows.filter(r=>r&&Number.isFinite(Number(r.value))):[];
    if(!data.length) return `<div class="plan-history-chart-empty">Sin lecturas de agua identificadas para graficar.</div>`;
    const width=920,height=330,padL=62,padR=22,padT=48,padB=76;
    const chartW=width-padL-padR,chartH=height-padT-padB;
    const max=Math.max(...data.map(r=>Number(r.value)),1);
    const step=chartW/Math.max(data.length,1);
    const barW=Math.max(10,Math.min(36,step*.58));
    const grid=[0,.25,.5,.75,1].map((ratio,i)=>{
      const y=padT+chartH*(1-ratio);
      const val=max*ratio;
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width-padR}" y2="${y.toFixed(1)}" stroke="#dce9e7" stroke-width="1"/><text x="${padL-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="10" fill="#607872">${esc(fmt(val,1))}</text>`;
    }).join('');
    const bars=data.map((r,i)=>{
      const value=Number(r.value);
      const h=Math.max(1,(value/max)*chartH);
      const x=padL+i*step+(step-barW)/2;
      const y=padT+chartH-h;
      const label=monthLabelWater(r.period);
      const short=String(label).replace(/^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+(\d{4})$/,'$1 $2').replace(/(\d{2})(\d{2})$/,'$2');
      const isLast=i===data.length-1;
      return `<g><title>${esc(label)}: ${esc(fmt(value))} m³</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${isLast?'#087fa7':'#69cce5'}"/><text x="${(x+barW/2).toFixed(1)}" y="${height-padB+17}" text-anchor="middle" font-size="9" fill="#58706b" transform="rotate(-38 ${(x+barW/2).toFixed(1)} ${height-padB+17})">${esc(short)}</text></g>`;
    }).join('');
    const last=data[data.length-1];
    return `<svg class="plan-history-svg" viewBox="0 0 ${width} ${height}" width="100%" height="330" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Consumo mensual de agua por periodo"><rect width="${width}" height="${height}" rx="16" fill="#eaf9fd"/><text x="${padL}" y="26" font-size="15" font-weight="800" fill="#087fa7">Consumo mensual de agua (m³)</text>${grid}<line x1="${padL}" y1="${padT+chartH}" x2="${width-padR}" y2="${padT+chartH}" stroke="#9db6b0" stroke-width="1.2"/>${bars}<text x="${width-padR}" y="26" text-anchor="end" font-size="11" fill="#58706b">Último: ${esc(monthLabelWater(last.period))} · ${esc(fmt(last.value))} m³</text></svg>`;
  }

  function renderWaterPlan(plan){
    currentWaterPlan=plan;
    const site=plan.site;
    const actions=planActions(plan);
    const latestText=plan.latest?`${fmt(plan.latest.value)} m³ · ${monthLabelWater(plan.latest.period)}`:'Sin lectura identificada';
    const trendText=plan.latestDelta===null?'Sin comparación mensual consecutiva':plan.latestDelta>=0?`↓ Ahorro de ${fmt(plan.latestDelta)} m³ frente al mes anterior`:`↑ Aumento de ${fmt(Math.abs(plan.latestDelta))} m³ frente al mes anterior`;
    const goal=plan.targetPct===null
      ?'<strong>Meta inicial:</strong> construir una línea base de tres meses consecutivos antes de fijar una meta cuantitativa.'
      :`<strong>Meta propuesta:</strong> reducir <strong>${fmt(plan.targetPct,0)}%</strong> del consumo promedio mensual. Meta de consumo: <strong>${fmt(plan.targetMonthly)} m³/mes</strong>; ahorro esperado: <strong>${fmt(plan.savingMonthly)} m³/mes</strong>.`;
    const monthlyRows=plan.monthlyRows.map(r=>`<tr><td>${esc(monthLabelWater(r.period))}</td><td>${fmt(r.value)} m³</td><td>${r.period===plan.latest?.period?'<strong>Último dato</strong>':''}</td></tr>`).join('')||'<tr><td colspan="3">Sin lecturas de agua identificadas.</td></tr>';
    const actionRows=actions.map(a=>`<tr><td><strong>${esc(a[0])}</strong></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${esc(a[3])}</td><td>${esc(a[4])}</td></tr>`).join('');
    const html=`
      <article class="water-plan-document">
        <header class="water-plan-header">
          <div><span>SiMeCO₂ · Plan de Acción de Ahorro de Agua</span><h3>${esc(site.displaySite)}</h3><p>${mapLink(site.address,site.address,site.displaySite)}</p></div>
          <div class="water-plan-priority"><span>Prioridad</span><strong>${esc(plan.priority)}</strong></div>
        </header>
        <div class="water-plan-metrics">
          <article><span>Consumo acumulado</span><strong>${site.hasWater?`${fmt(site.waterM3)} m³`:'N.I.'}</strong></article>
          <article><span>Promedio mensual</span><strong>${site.hasWater?`${fmt(site.avgWaterMonth)} m³`:'No calculable'}</strong></article>
          <article><span>Último periodo</span><strong>${esc(latestText)}</strong></article>
          <article><span>Tendencia reciente</span><strong>${esc(trendText)}</strong></article>
          <article><span>Cobertura</span><strong>${site.waterPeriodCount}/${site.periodCount} periodos</strong></article>
          <article><span>Posición acumulada</span><strong>${plan.position>0?`#${plan.position}`:'Sin ranking'}</strong></article>
        </div>
        <section class="water-plan-goal">${goal}<p>La prioridad es relativa al comportamiento de las sedes con lectura disponible: Alta = cuartil superior del consumo promedio; Preventiva = cuartil inferior; Media = rango intermedio.</p></section>
        <h4>Plan de acción</h4>
        <div class="table-wrap"><table class="water-table"><thead><tr><th>Acción</th><th>Qué hacer</th><th>Responsable</th><th>Plazo</th><th>Indicador</th></tr></thead><tbody>${actionRows}</tbody></table></div>
        <h4>Histórico de agua de la sede</h4>
        <div class="plan-history-chart water-plan-history-chart">${buildWaterPlanHistoryChartSvg(plan.monthlyRows)}</div>
        <div class="table-wrap"><table class="water-table"><thead><tr><th>Periodo</th><th>Consumo</th><th>Observación</th></tr></thead><tbody>${monthlyRows}</tbody></table></div>
        <section class="water-plan-followup"><strong>Seguimiento recomendado</strong><p>Registrar mensualmente el consumo, comparar contra la meta, documentar fugas y reparaciones, y socializar el resultado con estudiantes y comunidad educativa. Una reducción solo se considera ahorro verificable cuando existe una lectura válida en dos meses calendario consecutivos.</p></section>
      </article>`;
    const preview=$w('waterPlanPreview');
    if(preview){preview.innerHTML=html;preview.hidden=false;}
    if($w('waterPlanStatus')) $w('waterPlanStatus').innerHTML=`Plan generado para <strong>${esc(site.displaySite)}</strong>. ${site.hasWater?`Se usaron ${site.waterPeriodCount} periodos con lectura de agua.`:'La sede no tiene lectura de agua identificada; el plan prioriza construir la línea base.'}`;
    if($w('waterDownloadPlanPdf')) $w('waterDownloadPlanPdf').disabled=false;
    return html;
  }

  function generateWaterPlanForSite(site){
    if(!site) return;
    if($w('waterPlanSearch')) $w('waterPlanSearch').value=`${site.displaySite} — ${site.address}`;
    const plan=buildWaterPlan(site);
    renderWaterPlan(plan);
    $w('waterPlanPreview')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function generateWaterPlanFromSearch(){
    const site=resolveWaterSite($w('waterPlanSearch')?.value||'');
    if(!site){
      if($w('waterPlanStatus')) $w('waterPlanStatus').innerHTML='<strong>No encontré la sede.</strong> Escribe parte del nombre o la dirección y selecciona una opción.';
      return;
    }
    generateWaterPlanForSite(site);
  }

  function waterPlanPdfContent(plan){
    const clone=document.createElement('div');
    clone.innerHTML=renderWaterPlan(plan);
    clone.querySelectorAll('a').forEach(a=>{a.removeAttribute('href');a.removeAttribute('target');});
    return clone.innerHTML;
  }

  function downloadWaterPlanPdf(){
    if(!currentWaterPlan){alert('Primero genera el plan de una sede.');return;}
    const html=waterPlanPdfContent(currentWaterPlan);
    const subtitle=`${currentWaterPlan.site.displaySite} · ${currentWaterPlan.site.address||'Sin dirección'} · Prioridad ${currentWaterPlan.priority}`;
    if(typeof openPdfPrintDocument==='function'){
      openPdfPrintDocument('Plan de Acción de Ahorro de Agua',subtitle,html);
    }else{
      const w=window.open('','_blank');
      if(!w){alert('Permite las ventanas emergentes para generar el PDF.');return;}
      w.document.write(`<html><head><title>Plan de Ahorro de Agua</title><style>body{font-family:Arial;padding:24px;color:#173f37}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #d8e8e5}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Guardar como PDF</button>${html}</body></html>`);
      w.document.close();
    }
  }

  function bindWaterEvents(){
    $w('waterConsumptionPeriod')?.addEventListener('change',()=>{consumptionPage=0;renderWaterConsumptionRanking();});
    $w('waterConsumptionSearch')?.addEventListener('input',()=>{consumptionPage=0;renderWaterConsumptionRanking();});
    $w('waterConsumptionRefresh')?.addEventListener('click',()=>{if($w('waterConsumptionPeriod'))$w('waterConsumptionPeriod').value='';if($w('waterConsumptionSearch'))$w('waterConsumptionSearch').value='';consumptionPage=0;renderWaterConsumptionRanking();});
    $w('waterConsumptionPrev')?.addEventListener('click',()=>{consumptionPage=Math.max(0,consumptionPage-1);renderWaterConsumptionRanking();});
    $w('waterConsumptionNext')?.addEventListener('click',()=>{consumptionPage++;renderWaterConsumptionRanking();});

    $w('waterSavingsPeriod')?.addEventListener('change',()=>{savingsPage=0;renderWaterSavingsRanking();});
    $w('waterSavingsSearch')?.addEventListener('input',()=>{savingsPage=0;renderWaterSavingsRanking();});
    $w('waterSavingsRefresh')?.addEventListener('click',()=>{if($w('waterSavingsPeriod'))$w('waterSavingsPeriod').value='';if($w('waterSavingsSearch'))$w('waterSavingsSearch').value='';savingsPage=0;renderWaterSavingsRanking();});
    $w('waterSavingsPrev')?.addEventListener('click',()=>{savingsPage=Math.max(0,savingsPage-1);renderWaterSavingsRanking();});
    $w('waterSavingsNext')?.addEventListener('click',()=>{savingsPage++;renderWaterSavingsRanking();});

    document.addEventListener('click',ev=>{
      const btn=ev.target.closest('[data-water-plan-key]');
      if(!btn) return;
      const site=aggregateWaterSites().find(s=>s.key===btn.dataset.waterPlanKey);
      if(site) generateWaterPlanForSite(site);
    });
    $w('waterGeneratePlan')?.addEventListener('click',generateWaterPlanFromSearch);
    $w('waterPlanSearch')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();generateWaterPlanFromSearch();}});
    $w('waterDownloadPlanPdf')?.addEventListener('click',downloadWaterPlanPdf);
    window.addEventListener('resize',()=>{if(!document.getElementById('seccion-8')?.hidden) drawWaterHistory();});
  }

  function refreshWaterModule(){
    if(!window.SIMECO_WATER_READY) return;
    populateWaterFilters();
    renderWaterOverview();
    renderWaterConsumptionRanking();
    renderWaterSavingsRanking();
  }

  window.simecoRefreshWater=refreshWaterModule;
  window.simecoWaterDebug={
    aggregateWaterSites,
    officialWaterStats,
    buildWaterSavingsRows,
    resolveWaterSite,
    buildWaterPlan,
    buildWaterPlanHistoryChartSvg
  };

  document.addEventListener('DOMContentLoaded',()=>{
    bindWaterEvents();
    refreshWaterModule();
  });
})();
