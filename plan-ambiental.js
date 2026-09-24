/* SiMeCO₂ v109 · Plan Ambiental + predimensionamiento solar completo + documentos/e-mail · carga bajo demanda */
(() => {
  'use strict';

  const STORAGE_KEY = 'simeco2_plan_ambiental_seguimiento_v109';
  const DOC_SETTINGS_KEY = 'simeco2_documentos_v109';
  const SOLAR_IRRADIANCE_H_DAY = 4.2;
  const SOLAR_DAYS_MONTH = 30;
  const SOLAR_SPECIFIC_YIELD_KWH_KWP_MONTH = SOLAR_IRRADIANCE_H_DAY * SOLAR_DAYS_MONTH;
  const SOLAR_PANEL_WP = 615;
  const SOLAR_PANEL_KWP = SOLAR_PANEL_WP / 1000;
  const SOLAR_PANEL_AREA_M2 = 3.2;
  const SOLAR_TREE_CAPTURE_KG_YEAR = 12;
  const SOLAR_DC_AC_RATIO_LARGE = 1.24;
  const SOLAR_FINANCE_RATE_MV = 0.015;
  const SOLAR_FINANCE_RATE_EA = Math.pow(1 + SOLAR_FINANCE_RATE_MV, 12) - 1;
  const SOLAR_ECONOMIC_REFERENCE_VERSION = 'SIMECO2-ECO-2026.09-v1';
  const SOLAR_FINANCE_MODEL_VERSION = 'SIMECO2-FIN-2026.09-v1';
  const SOLAR_PRICE_REFERENCE_NOTE = 'Valores económicos de referencia para sistemas solares On-Grid en el Área Metropolitana de Medellín. Fuente: insumo técnico suministrado al proyecto; fecha original no documentada. Versión SiMeCO₂: ' + SOLAR_ECONOMIC_REFERENCE_VERSION + ', integrada el 2026-09-04. No constituye cotización vigente y debe validarse según ubicación, cubierta, alcance, impuestos, equipos y condiciones eléctricas.';
  const SOLAR_FINANCE_METHOD = 'Anualidad vencida; 1,50% M.V.; E.A. = (1 + 0,015)^12 - 1 = 19,5618%; simulación sobre 100% del valor referencial, sin cuota inicial.';
  const SOLAR_PRICE_TABLE = [[1.2,6,141,13310019,11573930],[1.7,9,212,14797710,8578383],[2.3,12,283,18014529,7832404],[2.9,15,354,18836207,6551724],[3.5,18,424,20824882,6036198],[4.0,21,495,22400858,5565431],[4.6,24,566,23986545,5214466],[5.2,27,637,26637225,5147290],[5.8,30,707,28347326,4929970],[6.3,33,778,29456410,4657140],[6.9,36,849,30820162,4466690],[7.5,39,919,33813795,4523585],[8.1,42,990,36620887,4549178],[8.6,45,1061,37460021,4343191],[9.2,48,1132,38092500,4140489],[9.8,51,1202,40551464,4148487],[10.4,54,1273,45689490,4414443],[10.9,57,1344,47220117,4322207],[11.5,60,1415,48644673,4229972],[12.1,63,1485,49963157,4137736],[12.7,66,1556,53267116,4210839],[13.2,69,1627,56655143,4283943],[13.8,72,1697,58551104,4242834],[14.4,75,1768,59016684,4105508],[15.0,78,1839,59324340,3968183],[15.5,81,1910,60838541,3918747],[16.1,84,1980,62295889,3869310],[16.7,87,2051,63696385,3819873],[17.3,90,2122,65040029,3770436],[17.8,93,2192,66326821,3721000],[18.4,96,2263,67556760,3671563],[19.0,99,2334,68729847,3622126],[19.6,102,2405,69846082,3572690],[20.1,105,2475,70905465,3523253],[20.7,108,2546,71907996,3473816],[21.3,111,2617,73808199,3469246],[21.9,114,2688,75703146,3464675],[22.4,117,2758,77592837,3460104],[23.0,120,2829,79477271,3455534],[23.6,123,2900,81356450,3450963],[24.2,126,2970,83230372,3446392],[24.7,129,3041,85099037,3441822],[25.3,132,3112,86962447,3437251],[25.9,135,3183,88820600,3432680],[26.5,138,3253,90673497,3428110],[27.0,141,3324,92521138,3423539],[27.6,144,3395,94363522,3418968],[28.2,147,3466,96200650,3414398],[28.8,150,3536,99418194,3458024],[29.3,153,3607,101406558,3458024],[29.9,156,3678,103394922,3458024],[30.5,159,3748,105383286,3458024],[31.1,162,3819,107371649,3458024],[31.6,165,3890,109360013,3458024],[32.2,168,3961,111348377,3458024],[32.8,171,4031,113336741,3458024],[33.4,174,4102,115325105,3458024],[33.9,177,4173,117313469,3458024],[34.5,180,4244,119301833,3458024],[35.1,183,4314,121290197,3458024],[35.7,186,4385,123278560,3458024],[36.2,189,4456,125266924,3458024],[36.8,192,4526,127255288,3458024],[37.4,195,4597,129243652,3458024],[38.0,198,4668,131232016,3458024],[38.5,201,4739,133220380,3458024],[39.1,204,4809,135208744,3458024],[39.7,207,4880,137197108,3458024],[40.3,210,4951,139185472,3458024],[40.8,213,5021,141173835,3458024],[41.4,216,5092,144968341,3501651],[42.0,219,5163,146935314,3500544],[42.6,222,5234,148901014,3499436],[43.1,225,5304,150865440,3498329],[43.7,228,5375,152828593,3497222],[44.3,231,5446,154790473,3496115],[44.9,234,5517,156751079,3495007],[45.4,237,5587,158710412,3493900],[46.0,240,5658,160668472,3492793],[46.6,243,5729,162625259,3491686],[47.2,246,5799,164580772,3490578],[47.7,249,5870,166535012,3489471],[48.3,252,5941,168487978,3488364],[48.9,255,6012,170439671,3487257],[49.5,258,6082,172390091,3486149],[50.0,261,6153,174339237,3485042],[50.6,264,6224,176287111,3483935],[51.2,267,6295,178233711,3482828],[51.8,270,6365,180179037,3481721],[52.3,273,6436,182123090,3480613],[52.9,276,6507,184065870,3479506],[53.5,279,6577,186007377,3478399],[54.1,282,6648,187947610,3477292],[54.6,285,6719,189886570,3476184],[55.2,288,6790,191824257,3475077],[55.8,291,6860,193760670,3473970],[56.4,294,6931,195695810,3472863],[56.9,297,7002,197629677,3471755],[57.5,300,7073,199562270,3470648],[58.1,302,7143,201493590,3469541],[58.7,305,7214,203423637,3468434],[59.2,308,7285,205352410,3467326],[59.8,311,7355,207279910,3466219],[60.4,314,7426,209206137,3465112],[61.0,317,7497,211177453,3464765],[61.5,320,7568,213148371,3464419],[62.1,323,7638,215118890,3464072],[62.7,326,7709,217089011,3463726],[63.3,329,7780,219058733,3463379],[63.8,332,7850,221028056,3463033],[64.4,335,7921,222996981,3462686],[65.0,338,7992,224965508,3462339],[65.6,341,8063,226933636,3461993],[66.1,344,8133,228901365,3461646],[66.7,347,8204,230868696,3461300],[67.3,350,8275,232835628,3460953],[67.9,353,8346,234802162,3460607],[68.4,356,8416,236768297,3460260],[69.0,359,8487,238734033,3459914],[69.6,362,8558,240699371,3459567],[70.2,365,8628,242664311,3459220],[70.7,368,8699,244628852,3458874],[71.3,371,8770,246592994,3458527],[71.9,374,8841,248556738,3458181],[72.5,377,8911,250520083,3457834],[73.0,380,8982,252483030,3457488],[73.6,383,9053,254445578,3457141],[74.2,386,9124,256407728,3456794],[74.8,389,9194,258369479,3456448],[75.3,392,9265,260330831,3456101],[75.9,395,9336,262291785,3455755],[76.5,398,9406,264252341,3455408],[77.1,401,9477,266212498,3455062],[77.6,404,9548,268172256,3454715],[78.2,407,9619,270131616,3454368],[78.8,410,9689,272090577,3454022],[79.4,413,9760,274049140,3453675],[79.9,416,9831,276007304,3453329],[80.5,419,9902,277965069,3452982],[81.1,422,9972,279689595,3449764],[81.7,425,10043,281410419,3446545],[82.2,428,10114,283127542,3443327],[82.8,431,10184,284840963,3440108],[83.4,434,10255,286550683,3436890],[84.0,437,10326,288256702,3433671],[84.5,440,10397,289959020,3430453],[85.1,443,10467,291657637,3427234],[85.7,446,10538,293352552,3424016],[86.3,449,10609,295043766,3420797],[86.8,452,10679,296731279,3417579],[87.4,455,10750,298415090,3414360],[88.0,458,10821,300095200,3411142],[88.6,461,10892,301771609,3407923],[89.1,464,10962,303444316,3404705],[89.7,467,11033,305113323,3401486],[90.3,470,11104,306778628,3398268],[90.9,473,11175,308440232,3395049],[91.4,476,11245,310098134,3391831],[92.0,479,11316,311752335,3388612],[92.6,482,11387,313402835,3385394],[93.2,485,11457,315049634,3382175],[93.7,488,11528,316692732,3378957],[94.3,491,11599,318332128,3375738],[94.9,494,11670,319967823,3372520],[95.5,497,11740,321599816,3369301],[96.0,500,11811,323228109,3366083],[96.6,503,11882,324852700,3362864],[97.2,506,11953,326473590,3359646],[97.8,509,12023,328090778,3356427],[98.3,512,12094,329704265,3353209],[98.9,515,12165,331314051,3349990],[99.5,518,12235,332920136,3346772],[100.1,521,12306,334200509,3340335],[100.6,524,12377,335936984,3338504],[101.2,527,12448,337671353,3336673],[101.8,530,12518,339403617,3334843],[102.4,533,12589,341133775,3333012],[102.9,536,12660,342861829,3331181],[103.5,539,12731,344587776,3329350],[104.1,542,12801,346311619,3327520],[104.7,545,12872,348033356,3325689],[105.2,548,12943,349752988,3323858],[105.8,551,13013,351470514,3322028],[106.4,554,13084,353185935,3320197],[107.0,557,13155,354899251,3318366],[107.5,560,13226,356610461,3316535],[108.1,563,13296,358319566,3314705],[108.7,566,13367,360026566,3312874],[109.3,569,13438,361731460,3311043],[109.8,572,13508,363434249,3309212],[110.4,575,13579,365134933,3307382],[111.0,578,13650,366833511,3305551],[111.6,581,13721,368529984,3303720],[112.1,584,13791,370224351,3301889],[112.7,587,13862,371916614,3300059],[113.3,590,13933,373606771,3298228],[113.9,593,14004,375294822,3296397],[114.4,596,14074,376980768,3294566],[115.0,599,14145,378664609,3292736],[115.6,601,14216,380346345,3290905],[116.2,604,14286,382025975,3289074],[116.7,607,14357,383703499,3287244],[117.3,610,14428,385378919,3285413],[117.9,613,14499,387052233,3283582],[118.5,616,14569,388723442,3281751],[119.0,619,14640,390392545,3279921],[119.6,622,14711,392059543,3278090],[120.2,625,14782,393724436,3276259],[120.8,628,14852,395387223,3274428],[121.3,631,14923,397047905,3272598],[121.9,634,14994,398706482,3270767],[122.5,637,15064,400362953,3268936],[123.1,640,15135,402017319,3267105],[123.6,643,15206,403669579,3265275],[124.2,646,15277,405319735,3263444],[124.8,649,15347,406967785,3261613],[125.4,652,15418,408613729,3259782],[125.9,655,15489,410257568,3257952],[126.5,658,15560,411899302,3256121],[127.1,661,15630,413538931,3254290],[127.7,664,15701,415176454,3252459],[128.2,667,15772,416811872,3250629],[128.8,670,15842,418445184,3248798],[129.4,673,15913,420076391,3246967],[130.0,676,15984,421705493,3245137]];
  let solarCoveragePct = Math.min(100, Math.max(1, Number(localStorage.getItem('simeco2_solar_coverage_v109') || 80)));
  let tariffOverride = Number(localStorage.getItem('simeco2_tariff_override_v109') || 0) || 0;
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
    const computedTariff=tariff && tariff>=80 && tariff<=4000 ? tariff : null;
    const safeTariff=tariffOverride>=80 && tariffOverride<=4000 ? tariffOverride : computedTariff;
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
    return {hasData:energyRows.length>0,energyRows,energy,energyValue,tariff:safeTariff,tariffSource:tariffOverride?'Tarifa confirmada manualmente':'Tarifa histórica aproximada',avg,targetPct,targetMonthly,savingMonthly,actions};
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

  function selectSolarPricePackage(targetEnergyMonthly){
    const target=Math.max(0,Number(targetEnergyMonthly)||0);
    if(!target)return null;
    for(const row of SOLAR_PRICE_TABLE){
      if(row[2]>=target) return {kwp:row[0],area:row[1],energy:row[2],projectValue:row[3],pricePerKwp:row[4],referenceType:'Tabla de referencia · Área Metropolitana de Medellín',extrapolated:false};
    }
    const last=SOLAR_PRICE_TABLE[SOLAR_PRICE_TABLE.length-1];
    const specificYield=last[2]/last[0];
    const requiredKwp=target/specificYield;
    const panels=Math.max(1,Math.ceil(requiredKwp*1000/SOLAR_PANEL_WP));
    const moduleDcKwp=panels*SOLAR_PANEL_WP/1000;
    return {kwp:Number(moduleDcKwp.toFixed(2)),area:Math.ceil(panels*SOLAR_PANEL_AREA_M2),energy:Math.round(moduleDcKwp*specificYield),projectValue:Math.round(moduleDcKwp*last[4]),pricePerKwp:last[4],referenceType:'Extrapolación sobre el último tramo de la tabla · Área Metropolitana de Medellín',extrapolated:true};
  }

  function financePayment(principal,months){
    const p=Math.max(0,Number(principal)||0),n=Math.max(1,Math.round(Number(months)||1)),r=SOLAR_FINANCE_RATE_MV;
    if(!p)return 0;
    return p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  }

  function buildInverterPlan(panels,dcKwp){
    panels=Math.max(0,Math.round(Number(panels)||0));dcKwp=Math.max(0,Number(dcKwp)||0);
    if(!panels)return {rows:[],summary:'Por definir'};
    if(panels<=40){const qty=Math.max(1,Math.ceil(panels/4));return {rows:[['Microinversor On-Grid 2,00 kW (selección preliminar)',String(qty)]],summary:`${qty} microinversor(es) de 2,00 kW, sujeto a validación eléctrica`};}
    const targetAc=dcKwp/SOLAR_DC_AC_RATIO_LARGE;let best=null;
    for(let n30=0;n30<=30;n30++)for(let n25=0;n25<=30;n25++){if(!n30&&!n25)continue;const total=n30*30+n25*25,diff=Math.abs(total-targetAc),pieces=n30+n25;if(!best||diff<best.diff-.001||(Math.abs(diff-best.diff)<.001&&pieces<best.pieces))best={n30,n25,total,diff,pieces};}
    const rows=[];if(best.n30)rows.push(['Inversor On-Grid 30,00 kW (referencial)',String(best.n30)]);if(best.n25)rows.push(['Inversor On-Grid 25,00 kW (referencial)',String(best.n25)]);
    return {rows,summary:`${fmt(best.total,0)} kW AC aproximados; selección final según tensión, fase y operador de red`};
  }

  function buildSolarPlan(ctx,energy){
    const actions=[
      ['Validar cubierta','Verificar área útil, orientación, sombras, estructura, impermeabilización y restricciones de acceso.','Ingeniería / Infraestructura','0–30 días','Visita técnica','Cubierta validada'],
      ['Validar sistema eléctrico','Revisar tableros, transformador, protecciones, puesta a tierra y punto de conexión.','Ingeniería eléctrica','31–60 días','Concepto eléctrico','Condiciones de conexión documentadas'],
      ['Perfil de autoconsumo','Contrastar generación horaria esperada con demanda real de la sede.','Gestión energética','31–60 días','% autoconsumo estimado','Escenario técnico definido'],
      ['Decisión de inversión','Comparar compra, créditos verdes, PPA, CERO inversión y comunidades energéticas con propuestas formales vigentes.','Rectoría / Administración','61–90 días','Alternativas evaluadas','Decisión documentada']
    ];
    const consumption=Number(energy.avg)||0;
    const tariff=Number(energy.tariff)||0;
    const coverage=Math.min(100,Math.max(1,Number(solarCoveragePct)||80));
    if(!(consumption>0))return {hasData:false,coveragePct:coverage,actions};
    const targetEnergyMonthly=consumption*coverage/100;
    const pkg=selectSolarPricePackage(targetEnergyMonthly);
    if(!pkg)return {hasData:false,coveragePct:coverage,actions};
    const panels=Math.max(1,Math.ceil(pkg.kwp*1000/SOLAR_PANEL_WP));
    const moduleDcKwp=panels*SOLAR_PANEL_WP/1000;
    const generationMonthly=pkg.energy;
    const generationAnnual=generationMonthly*12;
    const actualCoverage=generationMonthly/consumption*100;
    const effectiveCoverage=Math.min(100,actualCoverage);
    const usedSolarEnergy=Math.min(consumption,generationMonthly);
    const excessPotential=Math.max(0,generationMonthly-consumption);
    const monthlySaving=tariff?usedSolarEnergy*tariff:0;
    const annualSaving=monthlySaving*12;
    const factor=Number(ctx.factorCo2)||0.126;
    const solarCo2=generationAnnual*factor/1000;
    const solarTrees=solarCo2*1000/SOLAR_TREE_CAPTURE_KG_YEAR;
    const projectValue=Number(pkg.projectValue)||0;
    const simplePayback=projectValue>0&&annualSaving>0?projectValue/annualSaving:0;
    const simpleRoi=projectValue>0?annualSaving/projectValue*100:0;
    const finance48=financePayment(projectValue,48),finance60=financePayment(projectValue,60),finance120=financePayment(projectValue,120);
    return {hasData:true,actions,coveragePct:coverage,consumption,tariff,targetEnergyMonthly,requiredKwp:targetEnergyMonthly/SOLAR_SPECIFIC_YIELD_KWH_KWP_MONTH,kwp:pkg.kwp,moduleDcKwp,panelWp:SOLAR_PANEL_WP,panels,area:pkg.area,generationMonthly,generationAnnual,actualCoverage,effectiveCoverage,usedSolarEnergy,excessPotential,monthlySaving,annualSaving,solarCo2,solarTrees,irradiance:SOLAR_IRRADIANCE_H_DAY,specificYield:generationMonthly/Math.max(pkg.kwp,.001),inverterPlan:buildInverterPlan(panels,moduleDcKwp),projectValue,valuePerKwp:Number(pkg.pricePerKwp)||0,priceReferenceType:pkg.referenceType,priceExtrapolated:!!pkg.extrapolated,priceReferenceNote:SOLAR_PRICE_REFERENCE_NOTE,economicReferenceVersion:SOLAR_ECONOMIC_REFERENCE_VERSION,simplePayback,simpleRoi,financeRateMV:SOLAR_FINANCE_RATE_MV*100,financeRateEA:SOLAR_FINANCE_RATE_EA*100,financeModelVersion:SOLAR_FINANCE_MODEL_VERSION,financeMethod:SOLAR_FINANCE_METHOD,finance48,finance60,finance120,financeTotal48:finance48*48,financeTotal60:finance60*60,financeTotal120:finance120*120};
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

  function dataTable(headers,rows,cls='environmental-detail-table'){
    const head=headers.map(h=>`<th>${esc(h)}</th>`).join('');
    const body=rows.map(row=>`<tr>${row.map(v=>`<td>${v===null||v===undefined?'—':esc(v)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="${cls}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function solarSection(title,content){return `<section class="solar-detail-section"><h4>${esc(title)}</h4>${content}</section>`;}

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
    const s=plan.solar,e=plan.energy,c=plan.context;
    if(!s.hasData)return `<section class="env-plan-pane" data-pane="solar" hidden><div class="env-plan-empty"><strong>Predimensionamiento solar pendiente.</strong><p>No existe una línea base eléctrica suficiente para calcular potencia, paneles y generación. Una ausencia de dato no se interpreta como consumo cero.</p></div>${actionTable(s.actions||[],'Solar')}</section>`;
    const equipment=[
      ['Panel solar fotovoltaico bifacial 615 Wp',String(s.panels)],
      ['Estructuras para paneles solares','1'],['Adecuaciones eléctricas internas y medidor','1'],['Certificación RETIE / inspección aplicable','1'],['Trámites con comercializador / operador de red','1'],['Evaluación de trámites UPME / Ley 1715','1'],['Sistema de monitoreo','1'],['Ingeniería de detalle y mano de obra','1'],...(s.inverterPlan?.rows||[])
    ];
    const financeRows=[
      ['48 meses',`${fmt(s.financeRateMV,2)}%`,`${fmt(s.financeRateEA,2)}%`,money(s.finance48),money(s.financeTotal48)],
      ['60 meses',`${fmt(s.financeRateMV,2)}%`,`${fmt(s.financeRateEA,2)}%`,money(s.finance60),money(s.financeTotal60)],
      ['120 meses',`${fmt(s.financeRateMV,2)}%`,`${fmt(s.financeRateEA,2)}%`,money(s.finance120),money(s.financeTotal120)]
    ];
    const schedule=[['Mes 1','Visita técnica, levantamiento de cargas, cubierta y red eléctrica.'],['Mes 2','Ingeniería de detalle, selección definitiva de equipos y trámites iniciales.'],['Mes 2–3','Suministro e instalación, sujeto a contratación y disponibilidad.'],['Mes 4','Inspección / certificación RETIE cuando aplique.'],['Mes 5','Proceso con comercializador u operador de red, sujeto a sus tiempos.']];
    return `<section class="env-plan-pane" data-pane="solar" hidden>
      <div class="solar-full-title"><div><span>SiMeCO₂ · Predimensionamiento Solar On-Grid</span><h3>${esc(c.site)}</h3><p>${esc(c.address||'Dirección no identificada')}</p></div><strong>${fmt(s.coveragePct,0)}% cobertura objetivo</strong></div>
      <div class="solar-controls-inline"><label>Cobertura objetivo <input id="solarCoverageInput" type="number" min="1" max="100" step="1" value="${fmt(s.coveragePct,0)}"> %</label><label>Tarifa COP/kWh <input id="solarTariffInput" type="number" min="80" max="4000" step="1" value="${s.tariff?Math.round(s.tariff):''}" placeholder="Ej. 980"></label><button type="button" id="recalculateSolarBtn" class="secondary">↻ Recalcular</button></div>
      ${solarSection('1. Antecedentes y línea base',`<div class="environmental-metrics solar">${metricCard('Consumo mensual',`${fmt(s.consumption)} kWh/mes`,'Promedio histórico SiMeCO₂')}${metricCard('Tarifa utilizada',s.tariff?`${money(s.tariff)}/kWh`:'Pendiente',e.tariffSource||'Validar tarifa')}${metricCard('Gasto energético mensual',s.tariff?money(s.consumption*s.tariff):'Pendiente','Consumo × tarifa')}${metricCard('Energía solar objetivo',`${fmt(s.targetEnergyMonthly)} kWh/mes`,`${fmt(s.coveragePct,0)}% del consumo`)}</div>`)}
      ${solarSection('2. Tipo de sistema y dimensionamiento',`<div class="environmental-metrics solar">${metricCard('Sistema','On-Grid','Paralelo con la red, sin baterías')}${metricCard('Potencia nominal de referencia',`${fmt(s.kwp,1)} kWp`,s.priceReferenceType)}${metricCard('Potencia DC por módulos',`${fmt(s.moduleDcKwp,2)} kWp`,`${s.panels} × ${s.panelWp} Wp`)}${metricCard('Número de paneles',String(s.panels),'Módulos bifaciales de 615 Wp')}${metricCard('Área necesaria',`${fmt(s.area,0)} m²`,'Referencia de tabla económica')}${metricCard('Irradiancia de referencia',`${fmt(s.irradiance,1)} h/día`,`${fmt(s.specificYield,0)} kWh/kWp-mes`)}</div><div class="env-plan-callout solar"><strong>Selección preliminar de inversores:</strong> ${esc(s.inverterPlan?.summary||'Por definir')}.</div>`)}
      ${solarSection('3. Generación, ahorro y efecto climático',`<div class="environmental-metrics solar">${metricCard('Generación estimada',`${fmt(s.generationMonthly)} kWh/mes`,`${fmt(s.generationAnnual)} kWh/año`)}${metricCard('Cobertura energética teórica',`${fmt(s.actualCoverage,1)}%`,`${fmt(s.effectiveCoverage,1)}% efectiva hasta el consumo actual`)}${metricCard('Excedente potencial',`${fmt(s.excessPotential)} kWh/mes`,'Validar perfil horario y reglas de conexión')}${metricCard('Ahorro mensual estimado',s.tariff?money(s.monthlySaving):'Pendiente','No incluye inflación ni cambios tarifarios')}${metricCard('Ahorro anual estimado',s.tariff?money(s.annualSaving):'Pendiente','Prefactibilidad simple')}${metricCard('CO₂e evitado',`${fmt(s.solarCo2,3)} t/año`,`${fmt(s.solarTrees,0)} árboles/año equivalentes`)}</div>`)}
      ${solarSection('4. Equipos y alcance preliminar',dataTable(['Descripción','Cantidad'],equipment))}
      ${solarSection('5. Presupuesto y retorno simple',`<div class="environmental-metrics solar finance">${metricCard('Valor referencial del proyecto',money(s.projectValue),s.priceExtrapolated?'Valor extrapolado':'Tomado de tabla de referencia')}${metricCard('Valor referencial por kWp',money(s.valuePerKwp),s.economicReferenceVersion)}${metricCard('Rentabilidad simple año 1',s.simpleRoi?`${fmt(s.simpleRoi,1)}%`:'Pendiente','Ahorro anual ÷ inversión')}${metricCard('Recuperación simple',s.simplePayback?`${fmt(s.simplePayback,1)} años`:'Pendiente','Sin inflación, degradación ni incentivos')}</div><div class="env-plan-callout solar"><strong>Referencia económica:</strong> ${esc(s.priceReferenceNote)}</div>`)}
      ${solarSection('6. Simulación de financiación',`${dataTable(['Plazo','Tasa M.V.','Tasa E.A. equivalente','Cuota mensual estimada','Total pagado'],financeRows)}<div class="env-plan-callout"><strong>Modelo ${esc(s.financeModelVersion)}.</strong> ${esc(s.financeMethod)} Esta tasa reproduce la lógica de los ejemplos suministrados; no es una tasa bancaria vigente ni una oferta de crédito.</div><div class="solar-finance-options"><strong>Alternativas para solicitar cotización formal:</strong><span>Créditos verdes</span><span>PPA</span><span>CERO inversión</span><span>Comunidades energéticas</span></div>`)}
      ${solarSection('7. Cronograma referencial',dataTable(['Etapa','Actividad referencial'],schedule))}
      ${solarSection('8. Validaciones antes de invertir',`<ul class="solar-validation-list"><li>Validar cubierta, sombras, orientación, estructura e impermeabilización.</li><li>Revisar tensión, fase, transformador, tableros, protecciones y puesta a tierra.</li><li>Contrastar generación horaria con el perfil real de autoconsumo.</li><li>Confirmar RETIE, trámites con comercializador/operador de red y posibles requisitos UPME.</li><li>Actualizar precios, financiación, impuestos, garantías y mantenimiento mediante propuestas vigentes.</li><li>Revisar caso por caso la posible aplicación de beneficios de Ley 1715 y normas relacionadas.</li></ul><p class="env-plan-disclaimer"><strong>Alcance:</strong> predimensionamiento educativo y de prefactibilidad. No reemplaza ingeniería de detalle, visita técnica, certificación, estudio estructural ni cotización comercial definitiva.</p>`)}
      <h4>9. Ruta para escalar el proyecto solar</h4>${actionTable(s.actions,'Solar')}
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
      <button type="button" data-env-doc="solar">☀️ Vista/PDF solar</button>
      <button type="button" data-env-doc="matrix">📊 Matriz GEI CSV</button>
      <button type="button" class="doc-package-btn" data-doc-action="generate">🗂️ Crear 4 PDF + Google Sheets</button>
      <button type="button" class="doc-email-btn" data-doc-action="send">📧 Enviar todo por e-mail</button>
    </div>`;
  }

  function loadDocSettings(){
    try{return JSON.parse(localStorage.getItem(DOC_SETTINGS_KEY)||'{}')||{};}catch(_err){return {};}
  }
  function saveDocSettings(settings){try{localStorage.setItem(DOC_SETTINGS_KEY,JSON.stringify(settings));}catch(_err){}}
  function documentCenter(plan){
    const s=loadDocSettings();
    return `<details class="environmental-document-center" ${s.open?'open':''}>
      <summary>📨 Centro documental: PDF + Google Sheets + e-mail</summary>
      <div class="document-center-grid">
        <label>Nombre de quien recibe<input id="docRecipientName" type="text" maxlength="120" value="${esc(s.recipientName||'')}" placeholder="Nombre del rector(a), responsable o solicitante"></label>
        <label>Cargo / rol<input id="docRecipientRole" type="text" maxlength="100" value="${esc(s.recipientRole||'')}" placeholder="Rector(a), líder ambiental, administración…"></label>
        <label>Correo destinatario<input id="docRecipientEmail" type="email" maxlength="180" value="${esc(s.email||'')}" placeholder="correo@institucion.edu.co"></label>
        <label>Número de estudiantes<input id="docStudentCount" type="number" min="0" step="1" value="${esc(s.studentCount||'')}" placeholder="Opcional"></label>
      </div>
      <label class="document-notes-label">Observaciones<input id="docNotes" type="text" maxlength="400" value="${esc(s.notes||'')}" placeholder="Observaciones para incluir en el expediente"></label>
      <div class="document-consents"><label><input id="docPrivacyConsent" type="checkbox" ${s.consent?'checked':''}> Autorizo la generación, almacenamiento en Drive y envío de estos documentos al correo indicado.</label><label><input id="docGsvConsent" type="checkbox" ${s.gsvConsent?'checked':''}> Autorizo, de forma opcional, que el predimensionamiento pueda escalarse a GSV Ingeniería.</label></div>
      <details class="document-backend-config"><summary>⚙️ Configuración del motor Google Apps Script</summary><label>URL de implementación /exec<input id="docBackendUrl" type="url" value="${esc(s.backendUrl||window.SIMECO_DOCUMENT_BACKEND_URL||'')}" placeholder="https://script.google.com/macros/s/.../exec"></label><p>Se configura una sola vez en este navegador. El motor se incluye en la carpeta <code>apps-script-documentos</code> de la v109.</p></details>
      <div class="document-center-actions"><button type="button" class="primary" data-doc-action="generate">🗂️ Crear expediente documental</button><button type="button" class="primary email" data-doc-action="send">📧 Crear y enviar por e-mail</button></div>
      <div id="documentCenterStatus" class="document-center-status" role="status">Los documentos se crean solo cuando los solicitas.</div>
      <div id="documentCenterResult" class="document-center-result" hidden></div>
    </details>`;
  }

  function collectDocumentSettings(){
    const backendUrl=String($('docBackendUrl')?.value||window.SIMECO_DOCUMENT_BACKEND_URL||'').trim();
    const settings={open:true,backendUrl,recipientName:String($('docRecipientName')?.value||'').trim(),recipientRole:String($('docRecipientRole')?.value||'').trim(),email:String($('docRecipientEmail')?.value||'').trim(),studentCount:String($('docStudentCount')?.value||'').trim(),notes:String($('docNotes')?.value||'').trim(),consent:Boolean($('docPrivacyConsent')?.checked),gsvConsent:Boolean($('docGsvConsent')?.checked)};
    saveDocSettings(settings);return settings;
  }

  function buildDocumentPayload(plan,settings,action){
    const c=plan.context,e=plan.energy,w=plan.water,g=plan.gas,s=plan.solar;
    const latest=(c.energyPeriods||[]).slice().sort().pop()||new Date().toISOString().slice(0,7);
    return {action:'simeco2-documents',mode:action==='send'?'send':'generate',fullName:settings.recipientName||c.site,email:settings.email,requesterType:'Institución Educativa',offerRecipientName:settings.recipientName||c.site,offerRecipientRole:settings.recipientRole||'',notes:settings.notes,institutionName:c.site,serviceAddress:c.address||'',city:'Medellín',billingPeriod:latest,billingDays:30,contractNumber:'',analysisConfidence:'alta',source:'Histórico consolidado SiMeCO₂',consent:settings.consent,gsvConsent:settings.gsvConsent,studentCount:Number(settings.studentCount)||0,consumption:Number(e.avg)||0,tariff:Number(e.tariff)||0,monthlyBillApprox:(Number(e.avg)||0)*(Number(e.tariff)||0),coverage:Number(s.coveragePct)||80,factor:Number(c.factorCo2)||0.126,annualCarbon:(Number(e.avg)||0)*12*(Number(c.factorCo2)||0.126)/1000,waterM3:Number(w.site?.avgWaterMonth)||0,gasM3:Number(g.site?.avgGasMonth)||0,clientVersion:'SiMeCO₂ v109',historyPeriods:(c.energyPeriods||[]).length};
  }

  function renderDocumentResult(result){
    const box=$('documentCenterResult');if(!box)return;
    const links=result?.links||result?.expediente||{};
    const labels=[['folderUrl','📁 Expediente Drive'],['energyUrl','⚡ PDF Energía/GEI'],['waterUrl','💧 PDF Agua'],['gasUrl','🔥 PDF Gas'],['solarUrl','☀️ PDF Solar'],['sheetUrl','📊 Google Sheets Reducciones GEI']];
    const html=labels.filter(([k])=>links[k]).map(([k,l])=>`<a href="${esc(links[k])}" target="_blank" rel="noopener">${l}</a>`).join('');
    box.innerHTML=`<strong>✅ ${result?.emailed?'Documentos creados y correo enviado.':'Expediente documental creado.'}</strong>${result?.code?`<span>Código: ${esc(result.code)}</span>`:''}<div class="document-result-links">${html}</div>`;box.hidden=false;
  }

  async function createOrSendDocuments(action){
    if(!currentPlan)return alert('Primero genera el Plan de Acción Ambiental.');
    const center=document.querySelector('.environmental-document-center');if(center)center.open=true;
    const settings=collectDocumentSettings();
    const status=$('documentCenterStatus');
    const endpoint=settings.backendUrl;
    if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(endpoint)){if(status)status.innerHTML='⚠️ Configura primero la URL <strong>/exec</strong> del Google Apps Script incluido en la v109.';document.querySelector('.environmental-document-center')?.setAttribute('open','');return;}
    if(action==='send'&&!settings.email){if(status)status.textContent='⚠️ Escribe el correo destinatario.';return;}
    if(!settings.consent){if(status)status.textContent='⚠️ Debes autorizar la generación y almacenamiento de los documentos.';return;}
    const payload=buildDocumentPayload(currentPlan,settings,action);
    if(!(payload.consumption>0)){if(status)status.textContent='⚠️ La sede no tiene una línea base eléctrica mensual válida.';return;}
    const buttons=[...document.querySelectorAll('[data-doc-action]')];buttons.forEach(b=>b.disabled=true);
    if(status)status.textContent=action==='send'?'Generando 4 PDF, Google Sheets, expediente Drive y enviando e-mail…':'Generando 4 PDF, Google Sheets y expediente Drive…';
    try{
      const response=await fetch(endpoint,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      const raw=await response.text();let result;try{result=JSON.parse(raw);}catch(_err){throw new Error('El motor respondió en un formato no reconocido. Verifica que la implementación corresponda a la carpeta apps-script-documentos de la v109.');}
      if(!result?.ok)throw new Error(result?.error||'No fue posible crear los documentos.');
      renderDocumentResult(result);if(status)status.textContent=result.emailed?`✅ Correo enviado a ${result.sentTo}.`:'✅ Expediente documental creado correctamente.';
    }catch(err){console.error('[SiMeCO₂] Documentos:',err);if(status)status.textContent='❌ '+(err?.message||String(err));}
    finally{buttons.forEach(b=>b.disabled=false);}
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
      ${documentCenter(plan)}
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
    root.querySelectorAll('[data-doc-action]').forEach(btn=>btn.addEventListener('click',()=>createOrSendDocuments(btn.dataset.docAction)));
    root.querySelector('#recalculateSolarBtn')?.addEventListener('click',()=>{
      solarCoveragePct=Math.min(100,Math.max(1,Number(root.querySelector('#solarCoverageInput')?.value)||80));
      const t=Number(root.querySelector('#solarTariffInput')?.value)||0;tariffOverride=t>=80&&t<=4000?t:0;
      localStorage.setItem('simeco2_solar_coverage_v109',String(solarCoveragePct));
      if(tariffOverride)localStorage.setItem('simeco2_tariff_override_v109',String(tariffOverride));else localStorage.removeItem('simeco2_tariff_override_v109');
      const settings=collectDocumentSettings();const plan=buildPlan();currentPlan=plan;render(plan);activateTab('solar');
    });
    root.querySelector('.environmental-document-center')?.addEventListener('toggle',ev=>{const s=loadDocSettings();s.open=ev.target.open;saveDocSettings(s);});
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
      <h3>4. Predimensionamiento solar completo</h3>${s.hasData?renderSolar(plan).replace(' hidden>','>').replace(/<div class="solar-controls-inline">[\s\S]*?<\/div>/,''):'<p>Sin línea base eléctrica suficiente.</p>'}
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
  window.simecoEnvironmentalPlanDebug={buildPlan,buildSolarPlan,selectSolarPricePackage,financePayment,printablePlan,downloadCsv,trackingFor,buildDocumentPayload};
  window.SIMECO_ENVIRONMENTAL_PLAN_READY=true;
})();
