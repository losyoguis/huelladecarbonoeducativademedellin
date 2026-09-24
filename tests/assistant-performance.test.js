'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assistant=require('../api/_lib/assistant-core');

(async()=>{
  // Las consultas frecuentes deben funcionar sin OpenAI: menor latencia, costo y riesgo de cuota.
  let r=await assistant.answerAssistant({message:'¿Cuántas sedes hay?',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/567/.test(r.text),'Debe responder el conteo desde la API de datos');

  r=await assistant.answerAssistant({message:'Dame un informe de Fe y Alegría Santo Domingo Savio',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/73\.924/.test(r.text),'El informe grounded debe conservar 73.924 kWh');

  r=await assistant.answerAssistant({message:'Dame un informe de la electricidad del INEM José Félix de Restrepo',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/258\.461,17 kWh/.test(r.text),'El informe del INEM debe usar los 258.461,17 kWh integrados');
  assert(/cobertura eléctrica parcial/i.test(r.text),'Debe advertir que la cobertura eléctrica del INEM es parcial');

  r=await assistant.answerAssistant({message:'Muéstrame el top 10 de energía en julio de 2026',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/julio de 2026/i.test(r.text));
  assert(/11\.880 kWh/.test(r.text),'Debe aplicar filtro mensual, no solo anual');
  assert(/t CO₂e/.test(r.text),'El ranking del asistente debe incluir huella de carbono');

  r=await assistant.answerAssistant({message:'¿Cuánta energía total registra Medellín?',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/19\.058\.890,53 kWh/.test(r.text),'El total integrado debe sumar el consolidado oficial y el INEM');
  assert(/18\.800\.429,36 kWh/.test(r.text),'Debe conservar visible el consolidado oficial');
  assert(/258\.461,17 kWh/.test(r.text),'Debe identificar la energía integrada de contratos separados');

  // Todos los schemas strict deben declarar como required cada propiedad.
  for(const tool of assistant.TOOL_DEFS){
    const props=Object.keys(tool.parameters?.properties||{}).sort();
    const required=[...(tool.parameters?.required||[])].sort();
    assert.deepStrictEqual(required,props,`Schema incompleto en ${tool.name}`);
    assert.strictEqual(tool.parameters.additionalProperties,false,`additionalProperties debe ser false en ${tool.name}`);
  }

  // El bundle compacto del navegador debe reconstruir los mismos 9.147 registros.
  const code=fs.readFileSync(path.join(__dirname,'..','data','registros.electricidad.min.js'),'utf8');
  const context={window:{}}; vm.createContext(context); vm.runInContext(code,context,{timeout:5000});
  const fullCount=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','registros.json'),'utf8')).records.length;
  assert.equal(context.window.SIMECO_REGISTROS.length,fullCount);
  assert.equal(context.window.SIMECO_REGISTROS[0].period,'2025-01');

  const oldSize=fs.statSync(path.join(__dirname,'..','data','registros.js')).size;
  const compactSize=fs.statSync(path.join(__dirname,'..','data','registros.electricidad.min.js')).size;
  assert(compactSize < 500000,`El bundle eléctrico activo debe pesar menos de 500 KB (${compactSize})`);

  console.log(JSON.stringify({ok:true,mode:'data-first',compactBytes:compactSize,legacyBytes:oldSize,reductionPct:Math.round((1-compactSize/oldSize)*1000)/10},null,2));
})().catch(err=>{console.error(err);process.exit(1);});
