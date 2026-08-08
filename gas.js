/* SiMeCO₂ v94 · Módulo 9 Gas */
(() => {
  'use strict';

  const PAGE_SIZE = 10;
  let consumptionPage = 0;
  let savingsPage = 0;
  let currentGasPlan = null;

  const $w = id => document.getElementById(id);
  const fmt = (value, digits=2) => {
    if(value===null || value===undefined || value==='' || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('es-CO',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Number(value));
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const siteKeyGas = (site,address='') => `${norm(site)}|${norm(address)}`;
  const monthBeforeGas = period => {
    const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
    if(!m) return '';
    let y=Number(m[1]), mo=Number(m[2])-1;
    if(mo===0){mo=12;y--;}
    return `${y}-${String(mo).padStart(2,'0')}`;
  };
  const monthLabelGas = period => {
    const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
    if(!m) return String(period||'');
    const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${months[Number(m[2])-1]} ${m[1]}`;
  };
  const validGas = r => r && r.gasM3!==null && r.gasM3!==undefined && r.gasM3!=='' && Number.isFinite(Number(r.gasM3));
  const gasRecords = () => {
    const base=Array.isArray(window.SIMECO_GAS_RECORDS) ? window.SIMECO_GAS_RECORDS : [];
    let imported=[];
    try{
      if(typeof state!=='undefined' && Array.isArray(state.records)){
        imported=state.records.filter(r=>Object.prototype.hasOwnProperty.call(r,'gasM3') || Object.prototype.hasOwnProperty.call(r,'gasValue'));
      }
    }catch(_err){}
    if(!imported.length) return base;
    const replacementSources=new Set(imported.map(r=>r.source).filter(Boolean));
    return base.filter(r=>!replacementSources.has(r.source)).concat(imported);
  };
  const gasSummaries = () => {
    const base=Array.isArray(window.SIMECO_GAS_SUMMARY_BUNDLE?.summaries) ? window.SIMECO_GAS_SUMMARY_BUNDLE.summaries : [];
    let imported=[];
    try{
      if(typeof state!=='undefined' && Array.isArray(state.summaries)){
        imported=state.summaries.filter(s=>Object.prototype.hasOwnProperty.call(s,'gasM3') || Object.prototype.hasOwnProperty.call(s,'gasValue'));
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
    return `<a class="gas-map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" title="Abrir ubicación en Google Maps">🏫 ${esc(label||text)}</a>`;
  }

  function aggregateGasSites(source=gasRecords()){
    const map=new Map();
    for(const r of source){
      const key=siteKeyGas(r.site,r.address);
      if(!map.has(key)){
        map.set(key,{
          key,
          site:r.site||'Sede sin nombre',
          displaySite:displayName(r),
          address:r.address||'',
          periods:new Set(),
          gasPeriods:new Set(),
          gasM3:0,
          gasValue:0,
          gasValueAvailable:false,
          records:[]
        });
      }
      const item=map.get(key);
      item.records.push(r);
      if(r.period) item.periods.add(r.period);
      if(validGas(r)){
        item.gasPeriods.add(r.period);
        item.gasM3 += Number(r.gasM3);
      }
      if(r.gasValue!==null && r.gasValue!==undefined && r.gasValue!=='' && Number.isFinite(Number(r.gasValue))){
        item.gasValue += Number(r.gasValue);
        item.gasValueAvailable=true;
      }
    }
    return [...map.values()].map(item=>({
      ...item,
      periodCount:item.periods.size,
      gasPeriodCount:item.gasPeriods.size,
      hasGas:item.gasPeriods.size>0,
      avgGasMonth:item.gasPeriods.size ? item.gasM3/item.gasPeriods.size : null
    }));
  }

  function officialGasStats(){
    const rows=gasSummaries().filter(s=>s.gasM3!==null && s.gasM3!==undefined && Number.isFinite(Number(s.gasM3)));
    const total=rows.reduce((a,s)=>a+Number(s.gasM3),0);
    const avg=rows.length?total/rows.length:0;
    const sorted=[...rows].sort((a,b)=>Number(b.gasM3)-Number(a.gasM3));
    return {rows,total,avg,max:sorted[0]||null,min:sorted[sorted.length-1]||null};
  }

  function drawGasHistory(){
    const canvas=$w('gasHistoryChart');
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const stats=officialGasStats();
    const rows=stats.rows;
    const cssWidth=Math.max(760,canvas.parentElement?.clientWidth||1000);
    const width=Math.max(900,cssWidth);
    const height=410;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle='#123b46';ctx.font='bold 18px Arial';ctx.fillText('Consumo oficial mensual de gas (m³)',28,34);
    if(!rows.length){ctx.font='13px Arial';ctx.fillText('No hay datos oficiales de gas.',28,70);return;}
    const pad={l:70,r:28,t:72,b:62};
    const chartW=width-pad.l-pad.r,chartH=height-pad.t-pad.b;
    const max=Math.max(...rows.map(r=>Number(r.gasM3)||0),1);
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
      const value=Number(r.gasM3)||0;
      const h=(value/max)*chartH;
      const x=pad.l+i*step+(step-barW)/2;
      const y=pad.t+chartH-h;
      const grad=ctx.createLinearGradient(0,y,0,pad.t+chartH);
      grad.addColorStop(0,'#1d9fd1');grad.addColorStop(1,'#75d5ea');
      ctx.fillStyle=grad;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x,y,barW,h,[8,8,2,2]); else ctx.rect(x,y,barW,h);
      ctx.fill();
      ctx.save();ctx.translate(x+barW/2,pad.t+chartH+12);ctx.rotate(-Math.PI/4);ctx.fillStyle='#46666d';ctx.font='10px Arial';ctx.textAlign='right';ctx.fillText(monthLabelGas(r.period),0,0);ctx.restore();
    });
    ctx.textAlign='left';
  }

  function renderGasOverview(){
    const stats=officialGasStats();
    const allSites=aggregateGasSites();
    const gasSites=allSites.filter(s=>s.hasGas);
    const detailTotal=gasSites.reduce((a,s)=>a+s.gasM3,0);
    const difference=stats.total-detailTotal;
    const differencePct=stats.total?100*difference/stats.total:0;
    if($w('gasTotalOfficial')) $w('gasTotalOfficial').textContent=`${fmt(stats.total)} m³`;
    if($w('gasTotalDetail')) $w('gasTotalDetail').textContent=`${fmt(detailTotal)} m³`;
    if($w('gasReconciliation')) $w('gasReconciliation').textContent=`${fmt(Math.abs(differencePct),2)}% de diferencia frente al resumen oficial`;
    if($w('gasSitesWithData')) $w('gasSitesWithData').textContent=fmt(gasSites.length,0);
    if($w('gasCoverageText')) $w('gasCoverageText').textContent=`${fmt(100*gasSites.length/Math.max(1,allSites.length),1)}% de ${allSites.length} sedes/cuentas`;
    if($w('gasMonthlyAverage')) $w('gasMonthlyAverage').textContent=`${fmt(stats.avg)} m³`;

    if($w('gasAnalysisNarrative') && stats.max && stats.min){
      const first=stats.rows[0],last=stats.rows[stats.rows.length-1];
      const change=Number(first?.gasM3)>0?100*(Number(last.gasM3)-Number(first.gasM3))/Number(first.gasM3):null;
      $w('gasAnalysisNarrative').innerHTML=`Entre <strong>${esc(monthLabelGas(first.period))}</strong> y <strong>${esc(monthLabelGas(last.period))}</strong> se acumulan <strong>${fmt(stats.total)} m³</strong> de consumo oficial. El mes de mayor consumo fue <strong>${esc(monthLabelGas(stats.max.period))}</strong> con <strong>${fmt(stats.max.gasM3)} m³</strong>; el menor fue <strong>${esc(monthLabelGas(stats.min.period))}</strong> con <strong>${fmt(stats.min.gasM3)} m³</strong>. ${change===null?'':`El último periodo está <strong>${fmt(Math.abs(change),1)}% ${change<=0?'por debajo':'por encima'}</strong> del primer periodo disponible.`}`;
    }
    if($w('gasAnalysisHighlights') && stats.rows.length){
      const latest=stats.rows[stats.rows.length-1];
      const prevPeriod=monthBeforeGas(latest.period);
      const prev=stats.rows.find(r=>r.period===prevPeriod);
      const delta=prev?Number(prev.gasM3)-Number(latest.gasM3):null;
      $w('gasAnalysisHighlights').innerHTML=`
        <article><span>Mayor consumo mensual</span><strong>${fmt(stats.max.gasM3)} m³</strong><small>${esc(monthLabelGas(stats.max.period))}</small></article>
        <article><span>Menor consumo mensual</span><strong>${fmt(stats.min.gasM3)} m³</strong><small>${esc(monthLabelGas(stats.min.period))}</small></article>
        <article><span>Último periodo</span><strong>${fmt(latest.gasM3)} m³</strong><small>${esc(monthLabelGas(latest.period))}${delta===null?'':` · ${delta>=0?'↓ ahorro':'↑ aumento'} ${fmt(Math.abs(delta))} m³ vs. ${esc(monthLabelGas(prevPeriod))}`}</small></article>
      `;
    }

    const body=$w('gasMonthlyBody');
    if(body){
      body.innerHTML=stats.rows.map((r,i)=>{
        const prev=i?stats.rows[i-1]:null;
        const isConsecutive=prev && monthBeforeGas(r.period)===prev.period;
        const diff=isConsecutive?Number(r.gasM3)-Number(prev.gasM3):null;
        const pct=isConsecutive && Number(prev.gasM3)>0?100*diff/Number(prev.gasM3):null;
        const change=diff===null?'<span class="not-available">Sin mes consecutivo</span>':`<span class="gas-change ${diff<=0?'down':'up'}">${diff<=0?'↓':'↑'} ${fmt(Math.abs(diff))} m³${pct===null?'':` · ${fmt(Math.abs(pct),1)}%`}</span>`;
        const url=r.sourceUrl||`data/${r.source}`;
        return `<tr><td>${esc(monthLabelGas(r.period))}</td><td><strong>${fmt(r.gasM3)} m³</strong></td><td>${change}</td><td><span>${esc(r.source||'Factura')}</span> <a class="source-download gas-pdf-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" download="${esc(r.source||'factura.pdf')}">⬇ PDF</a></td></tr>`;
      }).join('');
    }
    drawGasHistory();
  }

  function filteredGasConsumptionRows(){
    const period=$w('gasConsumptionPeriod')?.value||'';
    const query=norm($w('gasConsumptionSearch')?.value||'');
    const source=period?gasRecords().filter(r=>r.period===period):gasRecords();
    let rows=aggregateGasSites(source).filter(s=>s.hasGas);
    if(query){
      const tokens=query.split(' ').filter(Boolean);
      rows=rows.filter(s=>{
        const hay=norm(`${s.displaySite} ${s.site} ${s.address}`);
        return tokens.every(t=>hay.includes(t));
      });
    }
    return rows.sort((a,b)=>b.gasM3-a.gasM3 || String(a.displaySite).localeCompare(String(b.displaySite),'es'));
  }

  function renderGasConsumptionRanking(){
    const body=$w('gasConsumptionBody');
    if(!body) return;
    const rows=filteredGasConsumptionRows();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    consumptionPage=Math.max(0,Math.min(consumptionPage,pages-1));
    const start=consumptionPage*PAGE_SIZE;
    const visible=rows.slice(start,start+PAGE_SIZE);
    const period=$w('gasConsumptionPeriod')?.value||'';
    const total=rows.reduce((a,r)=>a+r.gasM3,0);
    if($w('gasConsumptionSummary')){
      const top=rows[0];
      $w('gasConsumptionSummary').innerHTML=top?`<strong>${rows.length} sedes con lectura.</strong> ${period?`Periodo: ${esc(monthLabelGas(period))}.`:'Acumulado de todos los periodos.'} Mayor consumo: <strong>${esc(top.displaySite)}</strong> con <strong>${fmt(top.gasM3)} m³</strong>. Total detallado de la selección: <strong>${fmt(total)} m³</strong>.`:'No hay sedes con lectura de gas para esta selección.';
    }
    body.innerHTML=visible.length?visible.map((r,i)=>`<tr>
      <td>${start+i+1}</td>
      <td><strong>${esc(r.displaySite)}</strong>${r.displaySite!==r.site?`<small class="invoice-alias">En factura: ${esc(r.site)}</small>`:''}</td>
      <td>${mapLink(r.address,r.address,r.displaySite)}</td>
      <td><strong>${fmt(r.gasM3)} m³</strong></td>
      <td>${fmt(r.avgGasMonth)} m³</td>
      <td>${r.gasPeriodCount}/${r.periodCount}</td>
      <td><button type="button" class="gas-plan-row-btn" data-gas-plan-key="${esc(r.key)}">🔥 Plan</button></td>
    </tr>`).join(''):'<tr><td colspan="7">No hay lecturas de gas para mostrar.</td></tr>';
    if($w('gasConsumptionPageInfo')) $w('gasConsumptionPageInfo').textContent=rows.length?`${start+1}–${Math.min(start+visible.length,rows.length)} de ${rows.length} · Página ${consumptionPage+1} de ${pages}`:'Sin resultados';
    if($w('gasConsumptionPrev')) $w('gasConsumptionPrev').disabled=consumptionPage<=0;
    if($w('gasConsumptionNext')) $w('gasConsumptionNext').disabled=consumptionPage>=pages-1;
  }

  function gasBySitePeriod(){
    const map=new Map();
    for(const r of gasRecords()){
      if(!validGas(r)) continue;
      const key=siteKeyGas(r.site,r.address);
      const compound=`${key}@@${r.period}`;
      if(!map.has(compound)) map.set(compound,{key,site:r.site,displaySite:displayName(r),address:r.address||'',period:r.period,gasM3:0});
      map.get(compound).gasM3+=Number(r.gasM3);
    }
    return map;
  }

  function buildGasSavingsRows(){
    const selected=$w('gasSavingsPeriod')?.value||'';
    const byPeriod=gasBySitePeriod();
    const periods=[...new Set(gasRecords().map(r=>r.period).filter(Boolean))].sort();
    const siteMeta=new Map();
    for(const item of byPeriod.values()) if(!siteMeta.has(item.key)) siteMeta.set(item.key,item);
    const rows=[];
    for(const [key,meta] of siteMeta.entries()){
      const comparisons=[];
      const targets=selected?[selected]:periods.filter(p=>periods.includes(monthBeforeGas(p)));
      for(const currentPeriod of targets){
        const previousPeriod=monthBeforeGas(currentPeriod);
        const prev=byPeriod.get(`${key}@@${previousPeriod}`);
        const curr=byPeriod.get(`${key}@@${currentPeriod}`);
        if(!prev||!curr) continue;
        const previous=Number(prev.gasM3),current=Number(curr.gasM3);
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
    const query=norm($w('gasSavingsSearch')?.value||'');
    const filtered=query?rows.filter(r=>{
      const hay=norm(`${r.displaySite} ${r.site} ${r.address}`);
      return query.split(' ').filter(Boolean).every(t=>hay.includes(t));
    }):rows;
    return filtered.sort((a,b)=>selected?(b.rankingValue-a.rankingValue)||((b.savingsPercent||0)-(a.savingsPercent||0)):(b.managementScore-a.managementScore)||(b.decreaseRate-a.decreaseRate)||(b.netSavingsM3-a.netSavingsM3));
  }

  function renderGasSavingsRanking(){
    const body=$w('gasSavingsBody');
    if(!body) return;
    const selected=$w('gasSavingsPeriod')?.value||'';
    const rows=buildGasSavingsRows();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    savingsPage=Math.max(0,Math.min(savingsPage,pages-1));
    const start=savingsPage*PAGE_SIZE,visible=rows.slice(start,start+PAGE_SIZE);
    if($w('gasSavingsMetricHead')) $w('gasSavingsMetricHead').textContent=selected?'Reducción mensual':'Índice de gestión';
    if($w('gasSavingsSummary')){
      const top=rows[0];
      $w('gasSavingsSummary').innerHTML=top?selected
        ?`<strong>${rows.length} sedes con ahorro verificable.</strong> Mayor ahorro entre ${esc(monthLabelGas(monthBeforeGas(selected)))} y ${esc(monthLabelGas(selected))}: <strong>${esc(top.displaySite)}</strong>, <strong>${fmt(top.savingsM3)} m³</strong> menos.`
        :`<strong>${rows.length} sedes con ahorro neto y reducciones verificables.</strong> Mejor Índice de Gestión del Ahorro de Gas: <strong>${esc(top.displaySite)}</strong> con <strong>${fmt(top.managementScore,1)} puntos</strong>.`
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
        <td><button type="button" class="gas-plan-row-btn" data-gas-plan-key="${esc(r.key)}">🔥 Plan</button></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7">No hay reducciones de gas verificables para mostrar.</td></tr>';
    if($w('gasSavingsPageInfo')) $w('gasSavingsPageInfo').textContent=rows.length?`${start+1}–${Math.min(start+visible.length,rows.length)} de ${rows.length} · Página ${savingsPage+1} de ${pages}`:'Sin resultados';
    if($w('gasSavingsPrev')) $w('gasSavingsPrev').disabled=savingsPage<=0;
    if($w('gasSavingsNext')) $w('gasSavingsNext').disabled=savingsPage>=pages-1;
  }

  function populateGasFilters(){
    const periods=[...new Set(gasRecords().map(r=>r.period).filter(Boolean))].sort();
    const consumption=$w('gasConsumptionPeriod');
    if(consumption){
      const value=consumption.value;
      consumption.innerHTML='<option value="">Todos los periodos</option>'+periods.map(p=>`<option value="${esc(p)}">${esc(monthLabelGas(p))}</option>`).join('');
      consumption.value=periods.includes(value)?value:'';
    }
    const savings=$w('gasSavingsPeriod');
    if(savings){
      const value=savings.value;
      const comparable=periods.filter(p=>periods.includes(monthBeforeGas(p)));
      savings.innerHTML='<option value="">Tendencia general</option>'+comparable.map(p=>`<option value="${esc(p)}">${esc(monthLabelGas(p))} vs. ${esc(monthLabelGas(monthBeforeGas(p)))}</option>`).join('');
      savings.value=comparable.includes(value)?value:'';
    }
    const dataList=$w('gasPlanSites');
    if(dataList){
      const sites=aggregateGasSites().sort((a,b)=>String(a.displaySite).localeCompare(String(b.displaySite),'es'));
      dataList.innerHTML=sites.map(s=>`<option value="${esc(s.displaySite)} — ${esc(s.address)}"></option>`).join('');
    }
  }

  function resolveGasSite(value){
    const q=norm(value);
    if(!q) return null;
    const sites=aggregateGasSites();
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

  function buildGasPlan(site){
    const allSites=aggregateGasSites();
    const gasSites=allSites.filter(s=>s.hasGas);
    const averages=gasSites.map(s=>s.avgGasMonth).filter(Number.isFinite);
    const q75=percentile(averages,.75);
    const q25=percentile(averages,.25);
    const valid=site.records.filter(validGas).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
    const monthly=new Map();
    valid.forEach(r=>monthly.set(r.period,(monthly.get(r.period)||0)+Number(r.gasM3)));
    const monthlyRows=[...monthly.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([period,value])=>({period,value}));
    const latest=monthlyRows[monthlyRows.length-1]||null;
    const previous=latest?monthlyRows.find(x=>x.period===monthBeforeGas(latest.period)):null;
    const latestDelta=latest&&previous?previous.value-latest.value:null;
    const position=gasSites.sort((a,b)=>b.gasM3-a.gasM3).findIndex(s=>s.key===site.key)+1;
    let priority='Sin línea base',targetPct=null;
    if(site.hasGas){
      if(site.avgGasMonth>=q75){priority='Alta';targetPct=15;}
      else if(site.avgGasMonth<=q25){priority='Preventiva';targetPct=5;}
      else{priority='Media';targetPct=10;}
    }
    const targetMonthly=targetPct!==null?site.avgGasMonth*(1-targetPct/100):null;
    const savingMonthly=targetPct!==null?site.avgGasMonth*(targetPct/100):null;
    return {site,monthlyRows,latest,previous,latestDelta,priority,targetPct,targetMonthly,savingMonthly,position,q75,q25};
  }

  function gasPlanActions(plan){
    const trend=plan.latestDelta===null?'sin comparación mensual consecutiva':plan.latestDelta>=0?`reducción reciente de ${fmt(plan.latestDelta)} m³`:`aumento reciente de ${fmt(Math.abs(plan.latestDelta))} m³`;
    if(!plan.site.hasGas){
      return [
        ['1. Establecer línea base','Validar la factura y la lectura del medidor durante tres meses consecutivos antes de fijar una meta cuantitativa.','Administración / Líder Ambiental','Mensual','3 meses con lectura válida'],
        ['2. Verificación técnica segura','Solicitar a personal autorizado la revisión de medidor, conexiones, válvulas, equipos y ventilación. No manipular tuberías ni accesorios de gas por cuenta propia.','Administración / Técnico autorizado','30 días','Revisión técnica documentada'],
        ['3. Inventario de usos','Identificar qué equipos consumen gas, horarios de operación, frecuencia y responsables de encendido/apagado.','Administración / Servicios generales','30 días','Inventario actualizado'],
        ['4. Protocolo de reporte','Definir un canal inmediato para reportar olor a gas, fallas o consumos atípicos y activar el protocolo institucional de emergencia.','Comité de Seguridad','Inmediato','Protocolo publicado y socializado']
      ];
    }
    return [
      ['1. Seguimiento del consumo',`Comparar la lectura mensual con la factura y revisar desviaciones. El diagnóstico actual muestra ${trend}.`,'Administración + Líder Ambiental','Mensual','m³/mes y variación porcentual'],
      ['2. Mantenimiento de equipos','Programar mantenimiento preventivo de estufas, calentadores u otros equipos a gas únicamente con personal competente o autorizado.','Administración / Técnico autorizado','Semestral','Equipos revisados y certificados'],
      ['3. Eficiencia operativa','Evitar mantener equipos encendidos sin necesidad, agrupar actividades de cocción o calentamiento y ajustar tiempos de operación a la demanda real.','Responsables de uso','Diario','Horas de operación y m³/mes'],
      ['4. Buenas prácticas en cocinas','Usar recipientes adecuados, mantener quemadores limpios mediante mantenimiento autorizado y aprovechar calor residual cuando sea seguro.','Servicios generales / Cocina','Permanente','Consumo por jornada'],
      ['5. Control de pérdidas','Ante olor a gas o una variación anormal del consumo, suspender el uso según el protocolo institucional y solicitar revisión inmediata a personal autorizado. Nunca buscar ni reparar fugas con métodos caseros.','Administración / Seguridad','Inmediato','Eventos atendidos y tiempo de respuesta'],
      ['6. Cultura y seguimiento','Socializar mensualmente el consumo, la meta y los resultados con la comunidad educativa, enfatizando uso eficiente y seguridad.','Líderes Ambientales / Comité de Seguridad','Mensual','Evidencias y variación m³']
    ];
  }

  function renderGasPlan(plan){
    currentGasPlan=plan;
    const site=plan.site;
    const actions=gasPlanActions(plan);
    const latestText=plan.latest?`${fmt(plan.latest.value)} m³ · ${monthLabelGas(plan.latest.period)}`:'Sin lectura identificada';
    const trendText=plan.latestDelta===null?'Sin comparación mensual consecutiva':plan.latestDelta>=0?`↓ Ahorro de ${fmt(plan.latestDelta)} m³ frente al mes anterior`:`↑ Aumento de ${fmt(Math.abs(plan.latestDelta))} m³ frente al mes anterior`;
    const goal=plan.targetPct===null
      ?'<strong>Meta inicial:</strong> construir una línea base de tres meses consecutivos antes de fijar una meta cuantitativa.'
      :`<strong>Meta propuesta:</strong> reducir <strong>${fmt(plan.targetPct,0)}%</strong> del consumo promedio mensual. Meta de consumo: <strong>${fmt(plan.targetMonthly)} m³/mes</strong>; ahorro esperado: <strong>${fmt(plan.savingMonthly)} m³/mes</strong>.`;
    const monthlyRows=plan.monthlyRows.map(r=>`<tr><td>${esc(monthLabelGas(r.period))}</td><td>${fmt(r.value)} m³</td><td>${r.period===plan.latest?.period?'<strong>Último dato</strong>':''}</td></tr>`).join('')||'<tr><td colspan="3">Sin lecturas de gas identificadas.</td></tr>';
    const actionRows=actions.map(a=>`<tr><td><strong>${esc(a[0])}</strong></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${esc(a[3])}</td><td>${esc(a[4])}</td></tr>`).join('');
    const html=`
      <article class="gas-plan-document">
        <header class="gas-plan-header">
          <div><span>SiMeCO₂ · Plan de Acción de Ahorro de Gas</span><h3>${esc(site.displaySite)}</h3><p>${mapLink(site.address,site.address,site.displaySite)}</p></div>
          <div class="gas-plan-priority"><span>Prioridad</span><strong>${esc(plan.priority)}</strong></div>
        </header>
        <div class="gas-plan-metrics">
          <article><span>Consumo acumulado</span><strong>${site.hasGas?`${fmt(site.gasM3)} m³`:'N.I.'}</strong></article>
          <article><span>Promedio mensual</span><strong>${site.hasGas?`${fmt(site.avgGasMonth)} m³`:'No calculable'}</strong></article>
          <article><span>Último periodo</span><strong>${esc(latestText)}</strong></article>
          <article><span>Tendencia reciente</span><strong>${esc(trendText)}</strong></article>
          <article><span>Cobertura</span><strong>${site.gasPeriodCount}/${site.periodCount} periodos</strong></article>
          <article><span>Posición acumulada</span><strong>${plan.position>0?`#${plan.position}`:'Sin ranking'}</strong></article>
        </div>
        <section class="gas-plan-goal">${goal}<p>La prioridad de ahorro es relativa al consumo promedio de las sedes con lectura de gas: Alta = cuartil superior; Preventiva = cuartil inferior; Media = rango intermedio. Las acciones técnicas sobre instalaciones de gas deben realizarlas personas autorizadas.</p></section>
        <h4>Plan de acción</h4>
        <div class="table-wrap"><table class="gas-table"><thead><tr><th>Acción</th><th>Qué hacer</th><th>Responsable</th><th>Plazo</th><th>Indicador</th></tr></thead><tbody>${actionRows}</tbody></table></div>
        <h4>Histórico de gas de la sede</h4>
        <div class="table-wrap"><table class="gas-table"><thead><tr><th>Periodo</th><th>Consumo</th><th>Observación</th></tr></thead><tbody>${monthlyRows}</tbody></table></div>
        <section class="gas-plan-followup"><strong>Seguimiento recomendado</strong><p>Registrar mensualmente el consumo, comparar contra la meta, documentar mantenimientos y eventos de seguridad, y socializar el resultado con la comunidad educativa. Una reducción solo se considera ahorro verificable cuando existe una lectura válida en dos meses calendario consecutivos. Cualquier intervención sobre redes, válvulas o equipos de gas debe ser realizada por personal competente o autorizado.</p></section>
      </article>`;
    const preview=$w('gasPlanPreview');
    if(preview){preview.innerHTML=html;preview.hidden=false;}
    if($w('gasPlanStatus')) $w('gasPlanStatus').innerHTML=`Plan generado para <strong>${esc(site.displaySite)}</strong>. ${site.hasGas?`Se usaron ${site.gasPeriodCount} periodos con lectura de gas.`:'La sede no tiene lectura de gas identificada; el plan prioriza construir la línea base.'}`;
    if($w('gasDownloadPlanPdf')) $w('gasDownloadPlanPdf').disabled=false;
    return html;
  }

  function generateGasPlanForSite(site){
    if(!site) return;
    if($w('gasPlanSearch')) $w('gasPlanSearch').value=`${site.displaySite} — ${site.address}`;
    const plan=buildGasPlan(site);
    renderGasPlan(plan);
    $w('gasPlanPreview')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function generateGasPlanFromSearch(){
    const site=resolveGasSite($w('gasPlanSearch')?.value||'');
    if(!site){
      if($w('gasPlanStatus')) $w('gasPlanStatus').innerHTML='<strong>No encontré la sede.</strong> Escribe parte del nombre o la dirección y selecciona una opción.';
      return;
    }
    generateGasPlanForSite(site);
  }

  function gasPlanPdfContent(plan){
    const clone=document.createElement('div');
    clone.innerHTML=renderGasPlan(plan);
    clone.querySelectorAll('a').forEach(a=>{a.removeAttribute('href');a.removeAttribute('target');});
    return clone.innerHTML;
  }

  function downloadGasPlanPdf(){
    if(!currentGasPlan){alert('Primero genera el plan de una sede.');return;}
    const html=gasPlanPdfContent(currentGasPlan);
    const subtitle=`${currentGasPlan.site.displaySite} · ${currentGasPlan.site.address||'Sin dirección'} · Prioridad ${currentGasPlan.priority}`;
    if(typeof openPdfPrintDocument==='function'){
      openPdfPrintDocument('Plan de Acción de Ahorro de Gas',subtitle,html);
    }else{
      const w=window.open('','_blank');
      if(!w){alert('Permite las ventanas emergentes para generar el PDF.');return;}
      w.document.write(`<html><head><title>Plan de Ahorro de Gas</title><style>body{font-family:Arial;padding:24px;color:#173f37}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #d8e8e5}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Guardar como PDF</button>${html}</body></html>`);
      w.document.close();
    }
  }

  function bindGasEvents(){
    $w('gasConsumptionPeriod')?.addEventListener('change',()=>{consumptionPage=0;renderGasConsumptionRanking();});
    $w('gasConsumptionSearch')?.addEventListener('input',()=>{consumptionPage=0;renderGasConsumptionRanking();});
    $w('gasConsumptionRefresh')?.addEventListener('click',()=>{if($w('gasConsumptionPeriod'))$w('gasConsumptionPeriod').value='';if($w('gasConsumptionSearch'))$w('gasConsumptionSearch').value='';consumptionPage=0;renderGasConsumptionRanking();});
    $w('gasConsumptionPrev')?.addEventListener('click',()=>{consumptionPage=Math.max(0,consumptionPage-1);renderGasConsumptionRanking();});
    $w('gasConsumptionNext')?.addEventListener('click',()=>{consumptionPage++;renderGasConsumptionRanking();});

    $w('gasSavingsPeriod')?.addEventListener('change',()=>{savingsPage=0;renderGasSavingsRanking();});
    $w('gasSavingsSearch')?.addEventListener('input',()=>{savingsPage=0;renderGasSavingsRanking();});
    $w('gasSavingsRefresh')?.addEventListener('click',()=>{if($w('gasSavingsPeriod'))$w('gasSavingsPeriod').value='';if($w('gasSavingsSearch'))$w('gasSavingsSearch').value='';savingsPage=0;renderGasSavingsRanking();});
    $w('gasSavingsPrev')?.addEventListener('click',()=>{savingsPage=Math.max(0,savingsPage-1);renderGasSavingsRanking();});
    $w('gasSavingsNext')?.addEventListener('click',()=>{savingsPage++;renderGasSavingsRanking();});

    document.addEventListener('click',ev=>{
      const btn=ev.target.closest('[data-gas-plan-key]');
      if(!btn) return;
      const site=aggregateGasSites().find(s=>s.key===btn.dataset.gasPlanKey);
      if(site) generateGasPlanForSite(site);
    });
    $w('gasGeneratePlan')?.addEventListener('click',generateGasPlanFromSearch);
    $w('gasPlanSearch')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();generateGasPlanFromSearch();}});
    $w('gasDownloadPlanPdf')?.addEventListener('click',downloadGasPlanPdf);
    window.addEventListener('resize',()=>{if(!document.getElementById('seccion-8')?.hidden) drawGasHistory();});
  }

  function refreshGasModule(){
    if(!window.SIMECO_GAS_READY) return;
    populateGasFilters();
    renderGasOverview();
    renderGasConsumptionRanking();
    renderGasSavingsRanking();
  }

  window.simecoRefreshGas=refreshGasModule;
  window.simecoGasDebug={
    aggregateGasSites,
    officialGasStats,
    buildGasSavingsRows,
    resolveGasSite,
    buildGasPlan
  };

  document.addEventListener('DOMContentLoaded',()=>{
    bindGasEvents();
    refreshGasModule();
  });
})();
