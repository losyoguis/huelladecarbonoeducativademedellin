'use strict';

const data = require('./simeco-data');

const TOOL_DEFS = [
  {
    type:'function', name:'buscar_institucion',
    description:'Busca una institución o sede de SiMeCO₂ por nombre oficial, alias de factura, dirección, código o núcleo. Úsala si el nombre es ambiguo o no estás seguro de la coincidencia.',
    parameters:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:10,description:'Máximo de coincidencias a devolver. Usa 8 salvo que la pregunta requiera otra cantidad.'}},required:['query','limit'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'obtener_informe_institucion',
    description:'Obtiene la ficha integral y los consumos reales de una institución, agrupando sus sedes verificadas sin perder trazabilidad. Devuelve totales, histórico mensual, calidad de datos, comparación anual y evidencias.',
    parameters:{type:'object',properties:{query:{type:'string'},period:{type:['string','null'],description:'Periodo YYYY-MM o null'},year:{type:['string','null'],description:'Año YYYY o null'}},required:['query','period','year'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'obtener_historico',
    description:'Obtiene el histórico mensual de una institución para energía, agua, alcantarillado, gas o residuos.',
    parameters:{type:'object',properties:{query:{type:'string'},metric:{type:'string',enum:['energyKwh','waterM3','alcM3','gasM3','wasteTon']},year:{type:['string','null']}},required:['query','metric','year'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'obtener_ranking',
    description:'Obtiene el ranking institucional por servicio. Las instituciones sin dato no se convierten en cero y se reportan como excluidas con su estado de calidad.',
    parameters:{type:'object',properties:{metric:{type:'string',enum:['energyKwh','waterM3','alcM3','gasM3','wasteTon']},period:{type:['string','null']},year:{type:['string','null']},limit:{type:'integer',minimum:1,maximum:50}},required:['metric','period','year','limit'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'obtener_posicion_institucion',
    description:'Indica si una institución entra o no en el ranking de un servicio, su posición cuando aplica y la razón exacta cuando queda excluida. Úsala para preguntas como por qué una I.E. no aparece en el ranking.',
    parameters:{type:'object',properties:{query:{type:'string'},metric:{type:'string',enum:['energyKwh','waterM3','alcM3','gasM3','wasteTon']},period:{type:['string','null']},year:{type:['string','null']}},required:['query','metric','period','year'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'comparar_instituciones',
    description:'Compara hasta ocho instituciones usando un mismo indicador y periodo/año.',
    parameters:{type:'object',properties:{queries:{type:'array',items:{type:'string'},minItems:2,maxItems:8},metric:{type:'string',enum:['energyKwh','waterM3','alcM3','gasM3','wasteTon']},period:{type:['string','null']},year:{type:['string','null']}},required:['queries','metric','period','year'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'obtener_calidad_datos',
    description:'Explica la cobertura y calidad de los datos. Puede consultar una institución específica o el panorama general del sistema.',
    parameters:{type:'object',properties:{query:{type:['string','null']}},required:['query'],additionalProperties:false},
    strict:true,
  },
  {
    type:'function', name:'obtener_indicadores_ciudad',
    description:'Obtiene agregados del conjunto de registros de SiMeCO₂ para un periodo o año. Incluye los resúmenes oficiales de factura disponibles.',
    parameters:{type:'object',properties:{period:{type:['string','null']},year:{type:['string','null']}},required:['period','year'],additionalProperties:false},
    strict:true,
  },
];

function runTool(name,args={}) {
  switch(name) {
    case 'buscar_institucion': return data.searchInstitutions(args.query,args.limit);
    case 'obtener_informe_institucion': return data.institutionReport(args.query,{period:args.period||undefined,year:args.year||undefined});
    case 'obtener_historico': return data.history(args.query,args.metric,{year:args.year||undefined});
    case 'obtener_ranking': return data.ranking(args.metric,{period:args.period||undefined,year:args.year||undefined,limit:args.limit});
    case 'obtener_posicion_institucion': return data.rankingStatusForInstitution(args.query,args.metric,{period:args.period||undefined,year:args.year||undefined});
    case 'comparar_instituciones': return data.compareInstitutions(args.queries,args.metric,{period:args.period||undefined,year:args.year||undefined});
    case 'obtener_calidad_datos': return data.qualityReport(args.query||undefined);
    case 'obtener_indicadores_ciudad': return data.cityIndicators({period:args.period||undefined,year:args.year||undefined});
    default: return {error:`Herramienta desconocida: ${name}`};
  }
}

const SYSTEM_PROMPT = `Eres el Asistente Ambiental oficial de SiMeCO₂, un sistema educativo de Medellín que analiza consumos de servicios públicos de instituciones educativas.

REGLAS DE DATOS:
1. Para cualquier cifra, ranking, histórico, ficha o comparación debes usar las herramientas de SiMeCO₂ antes de responder. No calcules cifras desde memoria.
2. null, dato ausente, energía no identificada y contrato separado NO significan cero. Nunca conviertas null en 0.
3. Si la calidad indica "energia_contrato_separado", explica que el consumo no está integrado en el consolidado y no atribuyas kWh, CO₂e ni ranking energético.
4. Respeta las agrupaciones institucionales verificadas. Una institución puede tener varias sedes/cuentas.
5. Si la búsqueda es ambigua, presenta las coincidencias y pide al usuario escoger; no adivines.
6. Los datos estructurados son la fuente de verdad para valores numéricos. Las evidencias sirven para trazabilidad.
7. Si falta información, dilo explícitamente. No inventes productos, direcciones, contratos, costos ni consumos.
8. Si recibes un bloque DATOS PRECONSULTADOS, úsalo como fuente de verdad y no sustituyas ninguna cifra por una estimación.
9. Para preguntas '¿por qué [institución] no aparece en el ranking?', responde sobre ESA institución usando su estado de inclusión/exclusión; no devuelvas un top 10 salvo que el usuario lo pida.
10. No inventes niveles como 'Preventiva', 'Alta' o similares si no vienen en los datos estructurados de la consulta.

ESTILO:
- Responde en español claro, útil para estudiantes, docentes, rectores y líderes ambientales.
- Empieza por la conclusión.
- Para un "informe", incluye: identificación, cobertura/calidad, consumos, tendencia, hallazgos y acciones recomendadas, separando lo observado de las recomendaciones.
- Cuando haya evidencia, menciona factura/periodo/página de forma breve si aporta valor.
- Las equivalencias ambientales son pedagógicas y no compensaciones certificadas.
- Mantén respuestas normales entre 120 y 450 palabras salvo que el usuario pida más detalle.`;

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function metricFromMessage(message) {
  const q = normalizeText(message);
  if (/agua|acueducto/.test(q)) return 'waterM3';
  if (/alcantarillado/.test(q)) return 'alcM3';
  if (/gas/.test(q)) return 'gasM3';
  if (/residuo|aseo/.test(q)) return 'wasteTon';
  return 'energyKwh';
}

function periodHints(message) {
  const q = normalizeText(message);
  const iso = q.match(/\b(20\d{2})[ -](0?[1-9]|1[0-2])\b/);
  if (iso) return {period:`${iso[1]}-${String(iso[2]).padStart(2,'0')}`,year:null};
  const year = (q.match(/\b20\d{2}\b/) || [])[0] || null;
  if(year){
    const months={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',setiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
    for(const [name,month] of Object.entries(months)) if(q.includes(name)) return {period:`${year}-${month}`,year:null};
  }
  return {period:null,year};
}

function institutionCandidateFromMessage(message) {
  let q = normalizeText(message);
  q = q.replace(/\b(dame|hazme|genera|generame|un|una|el|la|los|las|informe|reporte|analisis|analiza|porque|por|que|no|aparece|esta|en|del|de|ranking|top|puesto|posicion|energia|energetico|electrica|consumo|consumio|agua|acueducto|alcantarillado|gas|residuos|aseo|co2|huella|institucion|institucional|sede|ie|i e)\b/g,' ').replace(/\s+/g,' ').trim();
  return q;
}

function preconsultData(message) {
  const raw = String(message || '');
  const q = normalizeText(raw);
  const metric = metricFromMessage(raw);
  const hints = periodHints(raw);
  const candidate = institutionCandidateFromMessage(raw);
  let institution = null;
  if (candidate && candidate.length >= 3) {
    const resolved = data.resolveInstitution(candidate);
    if (resolved && !resolved.notFound && !resolved.ambiguous) institution = resolved.displayName;
  }
  const out = { intent:'general', metric, filter:hints };
  if (/(cuantos|cuantas|cantidad|numero).*(sedes|instituciones)/.test(q)) {
    out.intent='system_counts';
    out.systemCounts={
      institutions:data.institutions.length,
      records:data.records.length,
      periods:new Set(data.records.map(r=>r.period).filter(Boolean)).size
    };
    return out;
  }
  if (institution && /ranking|puesto|posicion|aparece/.test(q)) {
    out.intent='institution_ranking_status';
    out.rankingStatus=data.rankingStatusForInstitution(institution,metric,{period:hints.period||undefined,year:hints.year||undefined});
    out.institutionReport=data.institutionReport(institution,{period:hints.period||undefined,year:hints.year||undefined});
    return out;
  }
  if (institution && /calidad|cobertura|complet/.test(q)) {
    out.intent='institution_quality';
    out.quality=data.qualityReport(institution);
    return out;
  }
  if (institution && /informe|reporte|analisis|analiza|consumo|consumio|huella|co2|agua|energia|gas|residuo|aseo|historico|evolucion|tendencia/.test(q)) {
    out.intent='institution_report';
    out.institutionReport=data.institutionReport(institution,{period:hints.period||undefined,year:hints.year||undefined});
    return out;
  }
  if (/calidad|cobertura|datos incompletos|problemas de datos/.test(q)) {
    out.intent='quality';
    out.quality=data.qualityReport();
    return out;
  }
  if (/ranking|top/.test(q)) {
    out.intent='ranking';
    out.ranking=data.ranking(metric,{period:hints.period||undefined,year:hints.year||undefined,limit:10});
    return out;
  }
  if (/medellin|ciudad|total general|indicadores/.test(q) && /(consumo|energia|agua|gas|residuo|aseo|co2|total)/.test(q)) {
    out.intent='city_indicators';
    out.city=data.cityIndicators({period:hints.period||undefined,year:hints.year||undefined});
    return out;
  }
  return out;
}

const numberFmt = new Intl.NumberFormat('es-CO',{maximumFractionDigits:2});
function fmt(value){ return value===null || value===undefined || value==='' ? 'Sin dato' : numberFmt.format(Number(value)); }
function metricMeta(field){ return data.METRICS[field] || data.METRICS.energyKwh; }
function periodName(value){
  const m=String(value||'').match(/^(20\d{2})-(\d{2})$/); if(!m) return value||'todos los periodos';
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${months[Number(m[2])-1]||m[2]} de ${m[1]}`;
}
function percentChange(a,b){ if(a===null||a===undefined||!Number.isFinite(Number(a))||!Number(b)) return null; return ((Number(a)-Number(b))/Number(b))*100; }
function signText(value){ if(value===null) return ''; const abs=Math.abs(value); return `${value<0?'disminuyó':'aumentó'} ${numberFmt.format(abs)} %`; }

function reportAnswer(report,message=''){
  if(!report?.institution) return null;
  const q=normalizeText(message);
  const name=report.institution.name;
  const t=report.totals||{};
  const quality=report.quality||{};
  const latest=report.latest||null;
  const monthly=Array.isArray(report.monthly)?report.monthly:[];
  const metric=metricFromMessage(message);
  const meta=metricMeta(metric);
  if(/(cuanto|cuanta|consumo|consumio)/.test(q) && !/informe|reporte|analisis|analiza/.test(q)){
    const val=t[metric];
    const scope=report.filter?.period ? `en ${periodName(report.filter.period)}` : report.filter?.year ? `durante ${report.filter.year}` : `en ${report.periodCount} periodos disponibles`;
    if(val===null || val===undefined) return `**${name}** no tiene un valor identificado de ${meta.label.toLowerCase()} ${scope}. Estado de calidad: **${quality.label||'Datos parciales'}**.`;
    return `**${name}** registra **${fmt(val)} ${meta.unit}** de ${meta.label.toLowerCase()} ${scope}. Estado de calidad: **${quality.label||'Datos disponibles'}**.`;
  }
  const previous=monthly.length>1?monthly[monthly.length-2]:null;
  const change=latest && previous ? percentChange(latest.energyKwh,previous.energyKwh) : null;
  const members=(report.institution.members||[]).map(m=>m.role?`${m.name} (${m.role})`:m.name).join('; ');
  const lines=[`**${name}** tiene **${report.periodCount} periodos** y ${report.institution.members?.length||1} sede(s)/cuenta(s) agrupada(s) en SiMeCO₂.`];
  if(members) lines.push(`**Identificación:** ${members}.`);
  lines.push(`**Calidad de datos:** ${quality.label||'Datos parciales'}.`);
  const vals=[];
  if(t.energyKwh!==null) vals.push(`energía **${fmt(t.energyKwh)} kWh**`); else vals.push('energía **no identificada**');
  if(t.waterM3!==null) vals.push(`agua **${fmt(t.waterM3)} m³**`);
  if(t.alcM3!==null) vals.push(`alcantarillado **${fmt(t.alcM3)} m³**`);
  if(t.gasM3!==null) vals.push(`gas **${fmt(t.gasM3)} m³**`);
  if(t.wasteTon!==null) vals.push(`residuos/aseo **${fmt(t.wasteTon)} t**`);
  lines.push(`**Acumulado disponible:** ${vals.join(', ')}.`);
  if(t.co2kg!==null) lines.push(`**Huella eléctrica estimada:** **${fmt(Number(t.co2kg)/1000)} t CO₂e**.`);
  if(latest){
    const latestVals=[];
    if(latest.energyKwh!==null) latestVals.push(`${fmt(latest.energyKwh)} kWh`);
    if(latest.waterM3!==null) latestVals.push(`${fmt(latest.waterM3)} m³ de agua`);
    lines.push(`**Último periodo (${periodName(latest.period)}):** ${latestVals.length?latestVals.join(' y '):'sin datos de los indicadores principales'}.`);
  }
  if(change!==null) lines.push(`**Tendencia reciente:** frente al periodo anterior, la energía ${signText(change)}.`);
  if(quality.status==='energia_contrato_separado') lines.push('**Hallazgo:** la energía se gestiona en una fuente/contrato separado y no debe interpretarse como 0 kWh ni incluirse en el ranking eléctrico hasta integrar esa fuente.');
  else if(t.energyKwh!==null) lines.push('**Acción prioritaria:** revisar los meses de mayor consumo, horarios de equipos e iluminación, y fijar una meta de reducción medible con seguimiento mensual.');
  if(t.waterM3!==null) lines.push('En agua, conviene revisar picos mensuales, fugas, sanitarios, tanques y rutinas de limpieza para explicar variaciones.');
  return lines.join('\n\n');
}

function deterministicAnswer(grounded,message=''){
  if(!grounded || grounded.intent==='general') return null;
  if(grounded.intent==='system_counts'){
    const c=grounded.systemCounts;
    return `SiMeCO₂ tiene **${fmt(c.institutions)} instituciones/sedes agrupadas para consulta**, construidas a partir de **${fmt(c.records)} registros** distribuidos en **${fmt(c.periods)} periodos**. La cifra corresponde al índice institucional actual del sistema; algunas instituciones agrupan más de una sede o cuenta cuando la equivalencia está verificada.`;
  }
  if(grounded.intent==='institution_report') return reportAnswer(grounded.institutionReport,message);
  if(grounded.intent==='institution_quality'){
    const x=grounded.quality;
    if(!x?.institution) return null;
    const c=x.quality?.coverage||{};
    return `**${x.institution.name}** está clasificada como **${x.quality?.label||'Datos parciales'}**. Cobertura: energía ${fmt(c.energyKwh?.percent)} %, agua ${fmt(c.waterM3?.percent)} %, alcantarillado ${fmt(c.alcM3?.percent)} %, gas ${fmt(c.gasM3?.percent)} % y residuos ${fmt(c.wasteTon?.percent)} %.`;
  }
  if(grounded.intent==='institution_ranking_status'){
    const r=grounded.rankingStatus; if(!r?.institution) return null;
    if(r.included) return `**${r.institution.name}** sí está incluida en el ranking de ${r.metric?.label?.toLowerCase()||'servicio'} y ocupa el **puesto ${r.position} de ${r.totalRanked}**, con **${fmt(r.value)} ${r.metric?.unit||''}** en el alcance consultado.`;
    return `**${r.institution.name} no aparece en el ranking de ${r.metric?.label?.toLowerCase()||'servicio'} porque ${String(r.reason||r.qualityLabel||'no tiene un dato válido para clasificar').toLowerCase()}**. Esto **no significa consumo cero**. Estado de calidad: **${r.qualityLabel||r.qualityStatus||'Datos parciales'}**.`;
  }
  if(grounded.intent==='ranking'){
    const r=grounded.ranking; if(!r) return null;
    const rows=(r.ranking||[]).slice(0,10).map(x=>`${x.position}. ${x.name}: **${fmt(x.value)} ${r.metric?.unit||''}**`).join('\n');
    const filter=r.filter?.period?` en ${periodName(r.filter.period)}`:r.filter?.year?` en ${r.filter.year}`:'';
    return `**Top ${Math.min(10,(r.ranking||[]).length)} de ${r.metric?.label||'servicio'}${filter}:**\n\n${rows}\n\nSe clasificaron ${fmt(r.totalRanked)} instituciones/sedes con dato disponible; ${fmt(r.totalExcluded)} quedaron fuera por ausencia o estado de calidad del dato.`;
  }
  if(grounded.intent==='quality'){
    const t=grounded.quality?.totals||{};
    return `**Calidad de datos de SiMeCO₂:** ${fmt(t.datos_principales_completos||0)} con datos principales completos, ${fmt(t.datos_parciales||0)} con datos parciales, ${fmt(t.energia_no_identificada||0)} con energía no identificada y ${fmt(t.energia_contrato_separado||0)} con energía en contrato separado. Ninguna ausencia se convierte automáticamente en 0.`;
  }
  if(grounded.intent==='city_indicators'){
    const c=grounded.city||{}, t=c.totals||{};
    return `En el alcance consultado, SiMeCO₂ consolida **${fmt(c.institutionCount)} instituciones/sedes**, **${fmt(c.recordCount)} registros** y **${fmt(c.periodCount)} periodos**. Totales disponibles: energía **${fmt(t.energyKwh)} kWh**, agua **${fmt(t.waterM3)} m³**, alcantarillado **${fmt(t.alcM3)} m³** y residuos **${fmt(t.wasteTon)} t**.`;
  }
  return null;
}

function wantsDeepAI(message,grounded){
  const q=normalizeText(message);
  if(grounded?.intent==='general') return true;
  if(grounded?.intent==='institution_ranking_status' || grounded?.intent==='system_counts' || grounded?.intent==='ranking' || grounded?.intent==='quality' || grounded?.intent==='institution_quality') return false;
  return /(profund|explica las causas|causas|estrateg|plan de accion detall|recomendaciones detall|interpreta|analisis comparativo|analiza profundamente|propuesta pedagog|redacta)/.test(q);
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-4).filter(m => m && ['user','assistant'].includes(m.role) && typeof m.text === 'string')
    .map(m => ({role:m.role, content:m.text.slice(0,900)}));
}

function extractText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if ((content.type === 'output_text' || content.type === 'text') && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function openAIRequest(payload, apiKey) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify(payload),
  });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) {
    const message = body?.error?.message || `OpenAI API respondió ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.openaiCode = body?.error?.code || body?.error?.type || '';
    throw error;
  }
  return body;
}

async function answerWithOpenAI({message,history,apiKey,model,safetyIdentifier,grounded:providedGrounded}) {
  const grounded = providedGrounded || preconsultData(message);
  const groundText = `DATOS PRECONSULTADOS SIMECO2 (fuente de verdad):\n${JSON.stringify(grounded)}`;
  const input = [...sanitizeHistory(history), {role:'developer',content:groundText.slice(0,9000)}, {role:'user',content:String(message).slice(0,1200)}];
  const groundedEnough=grounded.intent!=='general';
  let response = await openAIRequest({
    model,
    instructions:SYSTEM_PROMPT,
    input,
    ...(groundedEnough ? {} : {tools:TOOL_DEFS,tool_choice:'auto'}),
    reasoning:{effort:'low'},
    text:{verbosity:'low'},
    max_output_tokens:900,
    ...(safetyIdentifier ? {safety_identifier:safetyIdentifier} : {}),
  }, apiKey);

  let rounds = 0;
  while (!groundedEnough && rounds < 2) {
    const calls = (response.output || []).filter(item => item.type === 'function_call');
    if (!calls.length) break;
    const outputs = calls.map(call => {
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch { args = {}; }
      let result;
      try { result = runTool(call.name,args); }
      catch (error) { result = {error:error.message || String(error)}; }
      return {type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)};
    });
    response = await openAIRequest({
      model,
      previous_response_id:response.id,
      input:outputs,
      tools:TOOL_DEFS,
      tool_choice:'auto',
      instructions:SYSTEM_PROMPT,
      reasoning:{effort:'low'},
      text:{verbosity:'low'},
      max_output_tokens:900,
      ...(safetyIdentifier ? {safety_identifier:safetyIdentifier} : {}),
    }, apiKey);
    rounds += 1;
  }
  return { text: extractText(response) || deterministicAnswer(grounded,message) || 'No pude construir una respuesta con los datos disponibles.', responseId:response.id, model, groundedIntent:grounded.intent, mode:'ai' };
}

async function answerAssistant({message,history,apiKey,model,safetyIdentifier}){
  const grounded=preconsultData(message);
  const deterministic=deterministicAnswer(grounded,message);
  if(deterministic && !wantsDeepAI(message,grounded)) return {text:deterministic,model:'SiMeCO2 Data Engine',groundedIntent:grounded.intent,mode:'data'};
  if(!apiKey){
    if(deterministic) return {text:deterministic,model:'SiMeCO2 Data Engine',groundedIntent:grounded.intent,mode:'data'};
    const error=new Error('OPENAI_API_KEY_MISSING'); error.status=503; throw error;
  }
  try{
    return await answerWithOpenAI({message,history,apiKey,model,safetyIdentifier,grounded});
  }catch(error){
    // Una consulta estructurada nunca queda inutilizable por cuota o indisponibilidad de IA.
    if(deterministic) return {text:deterministic,model:'SiMeCO2 Data Engine',groundedIntent:grounded.intent,mode:'data',aiFallback:true,aiErrorStatus:error.status||null};
    throw error;
  }
}

module.exports = {TOOL_DEFS,SYSTEM_PROMPT,runTool,preconsultData,deterministicAnswer,answerWithOpenAI,answerAssistant};
