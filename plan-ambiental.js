/* SiMeCO₂ v108 · Plan de Acción Ambiental Integrado por sede · carga bajo demanda */
(() => {
  'use strict';

  const STORAGE_KEY = 'simeco2_plan_ambiental_seguimiento_v108';
  const SOLAR_HOURS_DAY = 4.2;
  const SOLAR_DAYS_MONTH = 30;
  const SOLAR_YIELD = SOLAR_HOURS_DAY * SOLAR_DAYS_MONTH; // 126 kWh/kWp-mes
  const SOLAR_PANEL_KWP = 0.615;
  const SOLAR_PANEL_AREA_M2 = 3.2;
  const SOLAR_COVERAGE = 0.80;
  let currentPlan = null;
  let activeTab = 'energy';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const slug = value => norm(value).replace(/\s+/g,'-') || 'sede';
  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const fmt = (value, digits=2) => value===null || value===undefined || !Number.isFinite(Number(value))
    ? 'N.I.'
    : new Intl.NumberFormat('es-CO',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Number(value));
  const money = value => value===null || value===undefined || !Number.isFinite(Number(value))
    ? 'Pendiente'
    : new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(value));
  const monthLabel = period => {
    const m=String(period||'').match(/^(\d{4})-(\d{2})$/);
    if(!m) return String(period||'');
    const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${months[Number(m[2])-1]} ${m[1]}`;
  };

  function loadStore(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch(_err){return {};}
  }
  function saveStore(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}catch(_err){return false;}
  }
  function siteStoreKey(plan){ return slug(plan?.context?.key || `${plan?.context?.site}|${plan?.context?.address}`); }
  function actionId(service,index,title){ return `${service}|${index}|${slug(title)}`; }
  function trackingFor(plan,id){
    const store=loadStore();
    return store?.[siteStoreKey(plan)]?.[id] || {status:'Pendiente',evidence:'',updatedAt:''};
  }

  function getContext(){
    const ctx=window.simecoGetSelectedSiteContext?.();
    return ctx && ctx.records?.length ? ctx : null;
  }

  function findServiceSite(debug,ctx){
    if(!debug?.resolveWaterSite && !debug?.resolveGasSite) return null;
    const resolve=debug.resolveWaterSite || debug.resolveGasSite;
    const queries=[`${ctx.site} — ${ctx.address}`,ctx.address,ctx.site,ctx.invoiceSite].filter(Boolean);
    for(const q of queries){
      try{const found=resolve(q);if(found)return found;}catch(_err){}
    }
    return null;
  }

  function buildEnergyPlan(ctx){
    const energyRows=(ctx.records||[]).filter(r=>num(r.energyKwh)!==null && Number(r.energyKwh)>0);
    const valueRows=energyRows.filter(r=>num(r.energyValue)!==null && Number(r.energyValue)>0);
    const energy=energyRows.reduce((s,r)=>s+Number(r.energyKwh),0);
    const energyValue=valueRows.reduce((s,r)=>s+Number(r.energyValue),0);
    const tariff=energy>0 && energyValue>0 ? energyValue/energy : null;
    const safeTariff=tariff && tariff>=80 && tariff<=4000 ? tariff : null;
    const avg=ctx.avgMonth;
    const targetPct=avg===null?null:(ctx.intensity?.short==='Alta'?15:ctx.intensity?.short==='Media'?10:5);
    const targetMonthly=targetPct!==null ? avg*(1-targetPct/100) : null;
    const savingMonthly=targetPct!==null ? avg*(targetPct/100) : null;
    const actions=[
      ['Medición y control','Registrar cada factura, validar kWh y mantener una serie mensual comparable.','Administración + Líder Ambiental','0–30 días','Serie mensual completa',ctx.energyPeriods?.length>=12?'12 meses consolidados':'Completar 12 meses'],
      ['Cierre operativo','Aplicar lista de apagado para iluminación, cómputo, ventilación y equipos al finalizar cada jornada.','Coordinación / usuarios','0–30 días','% listas cumplidas','≥ 90%'],
      ['Inventario de cargas','Levantar potencia, cantidad, horas de uso y estado de equipos por área.','Mantenimiento','31–60 días','% cargas inventariadas','100% de áreas críticas'],
      ['Iluminación eficiente','Revisar niveles, sectorización, tecnología LED y sensores donde sean técnicamente pertinentes.','Mantenimiento / SST','31–60 días','Puntos evaluados / intervenidos','100% de puntos priorizados'],
      ['Medición técnica','Medir circuitos críticos y demanda en horarios representativos antes de inversiones mayores.','Profesional competente','61–90 días','Perfil de carga','Perfil de cargas críticas documentado'],
      ['Prefactibilidad solar','Validar cubierta, sombras, tableros, conexión y autoconsumo frente al predimensionamiento preliminar.','Ingeniería / Administración','61–90 días','Validación técnica','Decisión documentada sobre siguiente etapa']
    ];
    return {hasData:energyRows.length>0,energyRows,energy,energyValue,tariff:safeTariff,avg,targetPct,targetMonthly,savingMonthly,actions};
  }

  function buildWaterServicePlan(ctx){
    const debug=window.simecoWaterDebug;
    const site=findServiceSite(debug,ctx);
    if(!site || !debug?.buildWaterPlan){
      return {site:null,plan:null,actions:[
        ['Establecer línea base','Registrar o validar la lectura de agua durante tres meses consecutivos.','Administración / Líder Ambiental','0–30 días','Meses con lectura válida','3 meses'],
        ['Inspección de fugas','Revisar sanitarios, llaves, tanques, flotadores y redes visibles; documentar hallazgos.','Mantenimiento','0–30 días','Fugas detectadas / corregidas','100% de hallazgos atendidos'],
        ['Protocolos de uso','Definir rutinas eficientes de aseo y lavado evitando flujo continuo sin control.','Servicios generales','31–60 días','Cumplimiento del protocolo','≥ 90%'],
        ['Aprovechamiento de lluvia','Evaluar usos no potables técnicamente seguros para agua lluvia.','PRAE / Área técnica','61–90 días','Estudio preliminar','Viabilidad documentada']
      ]};
    }
    const plan=debug.buildWaterPlan(site);
    const raw=debug.planActions?.(plan) || [];
    const actions=raw.map((a,i)=>[a[0].replace(/^\d+\.\s*/,''),a[1],a[2],phaseFromDeadline(a[3],i),a[4],waterTarget(plan,a[4])]);
    return {site,plan,actions};
  }

  function buildGasServicePlan(ctx){
    const debug=window.simecoGasDebug;
    const site=findServiceSite(debug,ctx);
    if(!site || !debug?.buildGasPlan){
      return {site:null,plan:null,actions:[
        ['Establecer línea base','Validar factura y lectura de gas durante tres meses consecutivos antes de fijar una meta cuantitativa.','Administración / Líder Ambiental','0–30 días','Meses con lectura válida','3 meses'],
        ['Verificación técnica segura','Solicitar revisión de medidor, conexiones, válvulas, equipos y ventilación únicamente a personal competente o autorizado.','Administración / Técnico autorizado','0–30 días','Revisión documentada','100% de equipos prioritarios'],
        ['Inventario de usos','Identificar equipos, horarios, frecuencia y responsables de operación.','Administración / Servicios generales','31–60 días','Inventario actualizado','100% de usos identificados'],
        ['Seguimiento y seguridad','Comparar consumos y mantener protocolo de reporte y emergencia.','Comité de Seguridad','61–90 días','Eventos y variación m³','Seguimiento mensual']
      ]};
    }
    const plan=debug.buildGasPlan(site);
    const raw=debug.gasPlanActions?.(plan) || [];
    const actions=raw.map((a,i)=>[a[0].replace(/^\d+\.\s*/,''),a[1],a[2],phaseFromDeadline(a[3],i),a[4],gasTarget(plan,a[4])]);
    return {site,plan,actions};
  }

  function phaseFromDeadline(deadline,index=0){
    const d=norm(deadline);
    if(d.includes('90')) return '61–90 días';
    if(d.includes('60') || d.includes('semestral')) return '31–60 días';
    if(d.includes('inmediato') || d.includes('30') || d.includes('semanal') || d.includes('diario')) return '0–30 días';
    if(d.includes('mensual') || d.includes('permanente')) return index<2?'0–30 días':'31–60 días';
    return index<2?'0–30 días':index<4?'31–60 días':'61–90 días';
  }
  function waterTarget(plan,indicator){
    if(plan?.targetPct!==null && plan?.targetPct!==undefined && /m³|variaci/i.test(indicator||'')) return `Reducir ${fmt(plan.targetPct,0)}%`; 
    return /fugas/i.test(indicator||'')?'100% atendidas':'Evidencia mensual';
  }
  function gasTarget(plan,indicator){
    if(plan?.targetPct!==null && plan?.targetPct!==undefined && /m³|variaci/i.test(indicator||'')) return `Reducir ${fmt(plan.targetPct,0)}%`;
    return /seguridad|event/i.test(indicator||'')?'100% de eventos atendidos':'Evidencia mensual';
  }

  function buildSolarPlan(ctx,energy){
    const actions=[
      ['Validar cubierta','Verificar área útil, orientación, sombras, estructura, impermeabilización y restricciones de acceso.','Ingeniería / Infraestructura','0–30 días','Visita técnica','Cubierta validada'],
      ['Validar sistema eléctrico','Revisar tableros, transformador, protecciones, puesta a tierra y punto de conexión.','Ingeniería eléctrica','31–60 días','Concepto eléctrico','Condiciones de conexión documentadas'],
      ['Perfil de autoconsumo','Contrastar generación horaria esperada con demanda real de la sede.','Gestión energética','31–60 días','% autoconsumo estimado','Escenario técnico definido'],
      ['Decisión de inversión','Comparar alternativas de compra, financiación, PPA, cero inversión o comunidad energética con propuestas formales vigentes.','Rectoría / Administración','61–90 días','Alternativas evaluadas','Decisión documentada']
    ];
    const monthly=energy.avg;
    if(!(monthly>0)) return {hasData:false,coveragePct:80,actions};
    const targetGeneration=monthly*SOLAR_COVERAGE;
    const rawKwp=targetGeneration/SOLAR_YIELD;
    const panels=Math.max(1,Math.ceil(rawKwp/SOLAR_PANEL_KWP));
    const kwp=panels*SOLAR_PANEL_KWP;
    const area=panels*SOLAR_PANEL_AREA_M2;
    const generationMonthly=kwp*SOLAR_YIELD;
    const usableGeneration=Math.min(monthly,generationMonthly);
    const coverageActual=Math.min(100,generationMonthly/monthly*100);
    const monthlySaving=energy.tariff ? usableGeneration*energy.tariff : null;
    const annualCo2=usableGeneration*12*(ctx.factorCo2||0.126)/1000;
    return {hasData:true,coveragePct:SOLAR_COVERAGE*100,targetGeneration,rawKwp,panels,kwp,area,generationMonthly,usableGeneration,coverageActual,monthlySaving,annualCo2,actions};
  }

  function buildCrossActions(){
    return [
      ['Comité de seguimiento','Asignar responsable del plan y revisar mensualmente Energía, Agua, Gas y Solar.','Rectoría / Comité Ambiental','0–30 días','Reuniones y actas','1 seguimiento mensual'],
      ['Evidencias','Adjuntar facturas, fotografías, inventarios, actas o registros que demuestren cada acción ejecutada.','Responsable de cada acción','31–60 días','% acciones con evidencia','100% de acciones cerradas'],
      ['Verificación de resultados','Comparar periodos equivalentes y separar ahorro real de cambios por calendario, ocupación o clima.','Comité Ambiental / Administración','61–90 días','Variación frente a línea base','Resultado documentado por servicio']
    ];
  }

  function normalizeActions(plan){
    const groups=[
      ['Energía',plan.energy.actions],['Agua',plan.water.actions],['Gas',plan.gas.actions],['Solar',plan.solar.actions||[]],['Seguimiento',plan.crossActions]
    ];
    const rows=[];
    groups.forEach(([service,actions])=>actions.forEach((a,index)=>{
      const id=actionId(service,index,a[0]);
      rows.push({id,service,title:a[0],detail:a[1],responsible:a[2],phase:a[3],indicator:a[4],target:a[5]||'Evidencia documentada'});
    }));
    return rows;
  }

  function buildPlan(){
    const context=getContext();
    if(!context) throw new Error('Selecciona primero una institución o sede en “Informe por sede”.');
    const energy=buildEnergyPlan(context);
    const water=buildWaterServicePlan(context);
    const gas=buildGasServicePlan(context);
    const solar=buildSolarPlan(context,energy);
    const plan={context,energy,water,gas,solar,crossActions:buildCrossActions(),generatedAt:new Date().toLocaleString('es-CO')};
    plan.actions=normalizeActions(plan);
    return plan;
  }

  function metricCard(label,value,detail=''){
    return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</article>`;
  }
  function actionTable(actions,service){
    if(!actions?.length) return '<p class="env-plan-empty">Sin acciones configuradas.</p>';
    const rows=actions.map((a,i)=>`<tr><td><strong>${esc(a[0])}</strong><small>${esc(a[1])}</small></td><td>${esc(a[2])}</td><td>${esc(a[3])}</td><td>${esc(a[4])}</td><td>${esc(a[5]||'Evidencia documentada')}</td></tr>`).join('');
    return `<div class="table-wrap"><table class="environmental-action-table"><thead><tr><th>Acción</th><th>Responsable</th><th>Ruta</th><th>Indicador</th><th>Meta</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function historyTable(rows,unit){
    if(!rows?.length) return '<p class="env-plan-empty">No hay lecturas suficientes para mostrar histórico.</p>';
    return `<div class="table-wrap"><table class="environmental-history-table"><thead><tr><th>Periodo</th><th>Consumo</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(monthLabel(r.period))}</td><td>${fmt(r.value)} ${esc(unit)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderEnergy(plan){
    const e=plan.energy,c=plan.context;
    return `<section class="env-plan-pane" data-pane="energy">
      <div class="environmental-metrics">
        ${metricCard('Consumo acumulado',e.hasData?`${fmt(e.energy)} kWh`:'N.I.',`${c.energyPeriods?.length||0} periodo(s) con energía`)}
        ${metricCard('Promedio mensual',e.avg!==null?`${fmt(e.avg)} kWh/mes`:'N.I.',c.intensity?.level||'Sin clasificación')}
        ${metricCard('Huella acumulada',c.co2t!==null?`${fmt(c.co2t,3)} t CO₂e`:'N.I.',`Factor ${fmt(c.factorCo2,3)} kg CO₂e/kWh`)}
        ${metricCard('Meta operativa',e.targetPct!==null?`-${fmt(e.targetPct,0)}%`:'Por definir',e.targetMonthly?`${fmt(e.targetMonthly)} kWh/mes objetivo`:'Completar línea base')}
        ${metricCard('Tarifa histórica aproximada',e.tariff?`${money(e.tariff)}/kWh`:'Pendiente','Derivada de valores energéticos disponibles; validar antes de decisiones financieras')}
      </div>
      <div class="env-plan-callout"><strong>Lectura ejecutiva.</strong> ${esc(c.intensity?.text||'La sede requiere consolidar información antes de fijar una meta definitiva.')} La meta es de planeación y debe verificarse con periodos comparables.</div>
      <h4>Ruta energética 30 / 60 / 90 días</h4>${actionTable(e.actions,'Energía')}
    </section>`;
  }

  function renderWater(plan){
    const p=plan.water.plan,s=plan.water.site;
    return `<section class="env-plan-pane" data-pane="water" hidden>
      <div class="environmental-metrics">
        ${metricCard('Consumo acumulado',s?.hasWater?`${fmt(s.waterM3)} m³`:'N.I.',s?`${s.waterPeriodCount}/${s.periodCount} periodos con dato`:'Sin coincidencia de agua')}
        ${metricCard('Promedio mensual',s?.hasWater?`${fmt(s.avgWaterMonth)} m³/mes`:'N.I.',p?`Prioridad ${p.priority}`:'Construir línea base')}
        ${metricCard('Meta preliminar',p?.targetPct!==null&&p?.targetPct!==undefined?`-${fmt(p.targetPct,0)}%`:'Por definir',p?.targetMonthly?`${fmt(p.targetMonthly)} m³/mes objetivo`:'3 meses válidos antes de meta')}
        ${metricCard('Último periodo',p?.latest?`${fmt(p.latest.value)} m³`:'N.I.',p?.latest?monthLabel(p.latest.period):'Sin lectura')}
      </div>
      <div class="env-plan-callout water"><strong>Uso eficiente del agua.</strong> El plan prioriza línea base, control de fugas, protocolos operativos, dispositivos ahorradores y evaluación de agua lluvia según la información disponible.</div>
      <h4>Ruta de ahorro de agua</h4>${actionTable(plan.water.actions,'Agua')}
      <h4>Histórico asociado</h4>${historyTable(p?.monthlyRows||[],'m³')}
    </section>`;
  }

  function renderGas(plan){
    const p=plan.gas.plan,s=plan.gas.site;
    return `<section class="env-plan-pane" data-pane="gas" hidden>
      <div class="environmental-metrics">
        ${metricCard('Consumo acumulado',s?.hasGas?`${fmt(s.gasM3)} m³`:'N.I.',s?`${s.gasPeriodCount}/${s.periodCount} periodos con dato`:'Sin coincidencia de gas')}
        ${metricCard('Promedio mensual',s?.hasGas?`${fmt(s.avgGasMonth)} m³/mes`:'N.I.',p?`Prioridad ${p.priority}`:'Construir línea base')}
        ${metricCard('Meta preliminar',p?.targetPct!==null&&p?.targetPct!==undefined?`-${fmt(p.targetPct,0)}%`:'Por definir',p?.targetMonthly?`${fmt(p.targetMonthly)} m³/mes objetivo`:'3 meses válidos antes de meta')}
        ${metricCard('Último periodo',p?.latest?`${fmt(p.latest.value)} m³`:'N.I.',p?.latest?monthLabel(p.latest.period):'Sin lectura')}
      </div>
      <div class="env-plan-callout gas"><strong>Seguridad primero.</strong> Las inspecciones, mantenimientos o intervenciones sobre redes, válvulas y equipos de gas deben realizarse únicamente por personal competente o autorizado.</div>
      <h4>Ruta de gestión y uso eficiente del gas</h4>${actionTable(plan.gas.actions,'Gas')}
      <h4>Histórico asociado</h4>${historyTable(p?.monthlyRows||[],'m³')}
    </section>`;
  }

  function renderSolar(plan){
    const s=plan.solar,e=plan.energy;
    if(!s.hasData) return `<section class="env-plan-pane" data-pane="solar" hidden><div class="env-plan-empty"><strong>Predimensionamiento solar pendiente.</strong><p>No existe una línea base eléctrica suficiente para calcular potencia, paneles y generación. Una ausencia de dato no se interpreta como consumo cero.</p></div>${actionTable(s.actions||[],'Solar')}</section>`;
    return `<section class="env-plan-pane" data-pane="solar" hidden>
      <div class="environmental-metrics solar">
        ${metricCard('Cobertura objetivo',`${fmt(s.coveragePct,0)}%`,`${fmt(s.targetGeneration)} kWh/mes a cubrir`)}
        ${metricCard('Potencia instalada preliminar',`${fmt(s.kwp,2)} kWp`,`${s.panels} paneles de 615 Wp`)}
        ${metricCard('Área aproximada',`${fmt(s.area,1)} m²`,'3,2 m² por módulo como referencia preliminar')}
        ${metricCard('Generación estimada',`${fmt(s.generationMonthly)} kWh/mes`,`${fmt(s.coverageActual,1)}% de cobertura energética teórica`)}
        ${metricCard('Ahorro mensual estimado',s.monthlySaving?money(s.monthlySaving):'Pendiente',e.tariff?'Con tarifa histórica aproximada':'Requiere tarifa validada')}
        ${metricCard('CO₂e evitado',`${fmt(s.annualCo2,3)} t/año`,'Estimación de alcance 2')}
      </div>
      <div class="env-plan-callout solar"><strong>Referencia preliminar.</strong> Cálculo con 4,2 h solares/día, 30 días/mes, módulos de 615 Wp y cobertura objetivo del 80%. No constituye diseño definitivo ni cotización. Debe validarse con cubierta, sombras, perfil de carga, red y condiciones comerciales vigentes.</div>
      <h4>Ruta para escalar el proyecto solar</h4>${actionTable(s.actions,'Solar')}
    </section>`;
  }

  function trackingSummary(plan){
    const counts={Pendiente:0,'En curso':0,Completada:0,'No aplica':0};
    plan.actions.forEach(a=>{const t=trackingFor(plan,a.id);counts[t.status]=(counts[t.status]||0)+1;});
    return counts;
  }
  function renderTracking(plan){
    const counts=trackingSummary(plan);
    const rows=plan.actions.map(a=>{
      const t=trackingFor(plan,a.id);
      const options=['Pendiente','En curso','Completada','No aplica'].map(v=>`<option value="${v}"${t.status===v?' selected':''}>${v}</option>`).join('');
      return `<tr data-action-id="${esc(a.id)}"><td><span class="env-service-chip ${slug(a.service)}">${esc(a.service)}</span></td><td><strong>${esc(a.title)}</strong><small>${esc(a.detail)}</small></td><td>${esc(a.responsible)}</td><td>${esc(a.phase)}</td><td>${esc(a.indicator)}</td><td>${esc(a.target)}</td><td><select class="env-action-status" aria-label="Estado de ${esc(a.title)}">${options}</select></td><td><input class="env-action-evidence" type="text" maxlength="240" value="${esc(t.evidence)}" placeholder="Factura, acta, foto, enlace o nota…"></td></tr>`;
    }).join('');
    return `<section class="env-plan-pane" data-pane="tracking" hidden>
      <div class="environmental-metrics tracking">
        ${metricCard('Acciones totales',String(plan.actions.length),'Plan Ambiental Integrado')}
        ${metricCard('Completadas',String(counts.Completada||0),'Con seguimiento guardado')}
        ${metricCard('En curso',String(counts['En curso']||0),'Acciones activas')}
        ${metricCard('Pendientes',String(counts.Pendiente||0),'Por iniciar o documentar')}
      </div>
      <div class="env-plan-callout"><strong>Plan vivo.</strong> Actualiza el estado y registra evidencias. El seguimiento se guarda localmente en este navegador para esta sede y puede exportarse como matriz CSV para abrirla en Excel o Google Sheets.</div>
      <div class="table-wrap env-tracking-wrap"><table class="environmental-tracking-table"><thead><tr><th>Servicio</th><th>Acción</th><th>Responsable</th><th>Ruta</th><th>Indicador</th><th>Meta</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="env-followup-actions"><button type="button" id="saveEnvironmentalTrackingBtn" class="primary">💾 Guardar seguimiento</button><span id="environmentalTrackingMessage" role="status"></span></div>
    </section>`;
  }

  function documentButtons(){
    return `<div class="environmental-doc-actions" aria-label="Documentos por sede">
      <button type="button" data-env-doc="energy">⚡ PDF energético</button>
      <button type="button" data-env-doc="water">💧 PDF agua</button>
      <button type="button" data-env-doc="gas">🔥 PDF gas</button>
      <button type="button" data-env-doc="solar">☀️ PDF solar</button>
      <button type="button" data-env-doc="matrix">📊 Matriz GEI CSV</button>
    </div>`;
  }

  function render(plan){
    currentPlan=plan;
    const preview=$('environmentalPlanPreview');
    if(!preview)return;
    preview.innerHTML=`<article class="environmental-plan-document">
      <header class="environmental-plan-header">
        <div><span>SiMeCO₂ · Plan de Acción Ambiental por sede</span><h3>${esc(plan.context.site)}</h3><p>${esc(plan.context.address||'Sin dirección registrada')}</p></div>
        <div class="environmental-plan-priority"><span>Prioridad eléctrica</span><strong>${esc(plan.context.intensity?.short||'Por definir')}</strong><small>Generado ${esc(plan.generatedAt)}</small></div>
      </header>
      ${documentButtons()}
      <nav class="environmental-plan-tabs" role="tablist" aria-label="Componentes del plan ambiental">
        <button type="button" class="env-plan-tab active" data-env-tab="energy" role="tab" aria-selected="true">⚡ Energía y GEI</button>
        <button type="button" class="env-plan-tab" data-env-tab="water" role="tab" aria-selected="false">💧 Agua</button>
        <button type="button" class="env-plan-tab" data-env-tab="gas" role="tab" aria-selected="false">🔥 Gas</button>
        <button type="button" class="env-plan-tab" data-env-tab="solar" role="tab" aria-selected="false">☀️ Solar</button>
        <button type="button" class="env-plan-tab" data-env-tab="tracking" role="tab" aria-selected="false">✅ Seguimiento</button>
      </nav>
      <div class="environmental-plan-panes">${renderEnergy(plan)}${renderWater(plan)}${renderGas(plan)}${renderSolar(plan)}${renderTracking(plan)}</div>
    </article>`;
    preview.classList.remove('plan-empty');
    const status=$('environmentalPlanStatus');
    if(status) status.innerHTML=`Plan integrado generado para <strong>${esc(plan.context.site)}</strong>: ${plan.actions.length} acciones estructuradas con responsables, plazos, indicadores, metas, estado y evidencia.`;
    ['downloadEnvironmentalPlanPdf','downloadEnvironmentalMatrixBtn'].forEach(id=>{if($(id))$(id).disabled=false;});
    activateTab(activeTab);
    bindDynamicControls();
  }

  function activateTab(tab){
    activeTab=tab;
    document.querySelectorAll('#environmentalPlanPreview [data-env-tab]').forEach(btn=>{
      const active=btn.dataset.envTab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active));
    });
    document.querySelectorAll('#environmentalPlanPreview .env-plan-pane').forEach(pane=>{pane.hidden=pane.dataset.pane!==tab;});
  }

  function bindDynamicControls(){
    const root=$('environmentalPlanPreview');if(!root)return;
    root.querySelectorAll('[data-env-tab]').forEach(btn=>btn.addEventListener('click',()=>activateTab(btn.dataset.envTab)));
    root.querySelector('#saveEnvironmentalTrackingBtn')?.addEventListener('click',saveTrackingFromTable);
    root.querySelectorAll('[data-env-doc]').forEach(btn=>btn.addEventListener('click',()=>openDocument(btn.dataset.envDoc)));
  }

  function saveTrackingFromTable(){
    if(!currentPlan)return;
    const store=loadStore(),key=siteStoreKey(currentPlan);
    store[key]=store[key]||{};
    document.querySelectorAll('#environmentalPlanPreview tr[data-action-id]').forEach(row=>{
      const id=row.dataset.actionId;
      store[key][id]={status:row.querySelector('.env-action-status')?.value||'Pendiente',evidence:String(row.querySelector('.env-action-evidence')?.value||'').trim(),updatedAt:new Date().toISOString()};
    });
    const ok=saveStore(store);
    const msg=$('environmentalTrackingMessage');if(msg)msg.textContent=ok?'✅ Seguimiento guardado en este navegador.':'⚠️ El navegador no permitió guardar el seguimiento.';
    if(ok){const scrollY=window.scrollY;render(currentPlan);activateTab('tracking');window.scrollTo({top:scrollY});}
  }

  function trackingRowsForPrint(plan){
    return plan.actions.map(a=>{const t=trackingFor(plan,a.id);return `<tr><td>${esc(a.service)}</td><td><strong>${esc(a.title)}</strong><br><small>${esc(a.detail)}</small></td><td>${esc(a.responsible)}</td><td>${esc(a.phase)}</td><td>${esc(a.indicator)}</td><td>${esc(a.target)}</td><td>${esc(t.status)}</td><td>${esc(t.evidence||'—')}</td></tr>`;}).join('');
  }

  function printablePlan(plan){
    const c=plan.context,e=plan.energy,w=plan.water.plan,g=plan.gas.plan,s=plan.solar;
    return `<article class="environmental-plan-document environmental-print">
      <header class="environmental-plan-header"><div><span>SiMeCO₂ · Plan de Acción Ambiental Integrado</span><h3>${esc(c.site)}</h3><p>${esc(c.address)}</p></div><div class="environmental-plan-priority"><span>Prioridad eléctrica</span><strong>${esc(c.intensity?.short||'Por definir')}</strong></div></header>
      <h3>1. Diagnóstico energético y GEI</h3><div class="environmental-metrics">${metricCard('Promedio eléctrico',e.avg!==null?`${fmt(e.avg)} kWh/mes`:'N.I.')}${metricCard('CO₂e acumulado',c.co2t!==null?`${fmt(c.co2t,3)} t`:'N.I.')}${metricCard('Meta',e.targetPct!==null?`-${fmt(e.targetPct,0)}%`:'Por definir')}</div>${actionTable(e.actions)}
      <h3>2. Plan de ahorro de agua</h3><div class="environmental-metrics">${metricCard('Promedio',w?.site?.avgWaterMonth?`${fmt(w.site.avgWaterMonth)} m³/mes`:'N.I.')}${metricCard('Prioridad',w?.priority||'Sin línea base')}${metricCard('Meta',w?.targetPct!==null&&w?.targetPct!==undefined?`-${fmt(w.targetPct,0)}%`:'Por definir')}</div>${actionTable(plan.water.actions)}
      <h3>3. Plan de gestión y uso eficiente del gas</h3><div class="environmental-metrics">${metricCard('Promedio',g?.site?.avgGasMonth?`${fmt(g.site.avgGasMonth)} m³/mes`:'N.I.')}${metricCard('Prioridad',g?.priority||'Sin línea base')}${metricCard('Meta',g?.targetPct!==null&&g?.targetPct!==undefined?`-${fmt(g.targetPct,0)}%`:'Por definir')}</div>${actionTable(plan.gas.actions)}
      <h3>4. Predimensionamiento solar preliminar</h3>${s.hasData?`<div class="environmental-metrics">${metricCard('Potencia',`${fmt(s.kwp,2)} kWp`)}${metricCard('Paneles',String(s.panels))}${metricCard('Área',`${fmt(s.area,1)} m²`)}${metricCard('Generación',`${fmt(s.generationMonthly)} kWh/mes`)}${metricCard('CO₂e evitado',`${fmt(s.annualCo2,3)} t/año`)}</div>`:'<p>Sin línea base eléctrica suficiente.</p>'}${actionTable(s.actions||[])}
      <h3>5. Seguimiento 30 / 60 / 90 días</h3><div class="table-wrap"><table class="environmental-tracking-table"><thead><tr><th>Servicio</th><th>Acción</th><th>Responsable</th><th>Ruta</th><th>Indicador</th><th>Meta</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>${trackingRowsForPrint(plan)}</tbody></table></div>
      <p class="env-plan-disclaimer"><strong>Alcance:</strong> este documento usa los históricos disponibles en SiMeCO₂ para planeación preliminar. No sustituye auditorías, inspecciones especializadas, certificaciones de seguridad, diseños definitivos ni cotizaciones comerciales.</p>
    </article>`;
  }

  function printIntegrated(){
    if(!currentPlan)return alert('Primero genera el Plan de Acción Ambiental.');
    if(typeof window.openPdfPrintDocument==='function') window.openPdfPrintDocument('Plan de Acción Ambiental por sede','Energía y GEI · Agua · Gas · Solar · Seguimiento 30/60/90',printablePlan(currentPlan));
    else window.print();
  }
  function printSolar(){
    if(!currentPlan)return;
    const s=currentPlan.solar,c=currentPlan.context;
    const html=s.hasData?`<article class="environmental-plan-document environmental-print"><header class="environmental-plan-header"><div><span>SiMeCO₂ · Predimensionamiento Solar</span><h3>${esc(c.site)}</h3><p>${esc(c.address)}</p></div></header>${renderSolar(currentPlan).replace(' hidden>','>')}<p class="env-plan-disclaimer"><strong>Importante:</strong> referencia preliminar. No es cotización ni diseño definitivo. Validar cubierta, sombras, estructura, red, protecciones y condiciones comerciales antes de ejecutar.</p></article>`:`<p>No hay línea base eléctrica suficiente para predimensionar.</p>`;
    if(typeof window.openPdfPrintDocument==='function') window.openPdfPrintDocument('Predimensionamiento Solar de Líderes Ambientales','Referencia preliminar desde históricos SiMeCO₂',html);
    else window.print();
  }
  function downloadCsv(){
    if(!currentPlan)return alert('Primero genera el Plan de Acción Ambiental.');
    const headers=['Sede','Dirección','Servicio','Acción','Detalle','Responsable','Ruta','Indicador','Meta','Estado','Evidencia','Última actualización'];
    const csv=[headers].concat(currentPlan.actions.map(a=>{const t=trackingFor(currentPlan,a.id);return [currentPlan.context.site,currentPlan.context.address,a.service,a.title,a.detail,a.responsible,a.phase,a.indicator,a.target,t.status,t.evidence,t.updatedAt];})).map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`plan-reducciones-gei-${slug(currentPlan.context.site)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function openDocument(type){
    if(!currentPlan)return;
    if(type==='energy'){
      window.generateManagementPlan?.(currentPlan.context.key);
      window.printCurrentPlan?.();
      return;
    }
    if(type==='water'){
      const site=currentPlan.water.site;
      if(site && window.simecoWaterDebug?.generateWaterPlanForSite){window.simecoWaterDebug.generateWaterPlanForSite(site);window.simecoWaterDebug.downloadWaterPlanPdf?.();}
      else {window.simecoOpenSection?.('seccion-7');alert('No se encontró una lectura de agua asociada automáticamente a esta sede. Puedes buscarla manualmente en el módulo Agua.');}
      return;
    }
    if(type==='gas'){
      const site=currentPlan.gas.site;
      if(site && window.simecoGasDebug?.generateGasPlanForSite){window.simecoGasDebug.generateGasPlanForSite(site);window.simecoGasDebug.downloadGasPlanPdf?.();}
      else {window.simecoOpenSection?.('seccion-8');alert('No se encontró una lectura de gas asociada automáticamente a esta sede. Puedes buscarla manualmente en el módulo Gas.');}
      return;
    }
    if(type==='solar') return printSolar();
    if(type==='matrix') return downloadCsv();
  }

  async function generate(){
    const btn=$('generateEnvironmentalPlanBtn');
    if(btn){btn.disabled=true;btn.textContent='⏳ Construyendo plan…';}
    const status=$('environmentalPlanStatus');if(status)status.textContent='Integrando históricos de electricidad, agua y gas y construyendo la ruta 30/60/90…';
    try{
      const plan=buildPlan();render(plan);$('environmentalPlanPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
      return plan;
    }catch(err){console.error('[SiMeCO₂] Plan ambiental:',err);if(status)status.textContent=err?.message||String(err);throw err;}
    finally{if(btn){btn.disabled=!window.simecoGetSelectedSiteContext?.();btn.textContent='🌱 Generar / actualizar Plan Ambiental';}}
  }

  function bindStatic(){
    $('downloadEnvironmentalPlanPdf')?.addEventListener('click',printIntegrated);
    $('downloadEnvironmentalMatrixBtn')?.addEventListener('click',downloadCsv);
  }

  bindStatic();
  window.simecoGenerateEnvironmentalPlan=generate;
  window.simecoEnvironmentalPlanDebug={buildPlan,buildSolarPlan,printablePlan,downloadCsv,trackingFor};
  window.SIMECO_ENVIRONMENTAL_PLAN_READY=true;
})();
