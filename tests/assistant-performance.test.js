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

  r=await assistant.answerAssistant({message:'¿Por qué el INEM no aparece en el ranking de energía?',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/contrato separado/i.test(r.text));
  assert(!/0 kWh/i.test(r.text),'INEM no debe convertirse en 0 kWh');

  r=await assistant.answerAssistant({message:'Muéstrame el top 10 de energía en julio de 2026',history:[],apiKey:'',model:'gpt-5-mini'});
  assert.equal(r.mode,'data');
  assert(/julio de 2026/i.test(r.text));
  assert(/11\.880 kWh/.test(r.text),'Debe aplicar filtro mensual, no solo anual');

  // Todos los schemas strict deben declarar como required cada propiedad.
  for(const tool of assistant.TOOL_DEFS){
    const props=Object.keys(tool.parameters?.properties||{}).sort();
    const required=[...(tool.parameters?.required||[])].sort();
    assert.deepStrictEqual(required,props,`Schema incompleto en ${tool.name}`);
    assert.strictEqual(tool.parameters.additionalProperties,false,`additionalProperties debe ser false en ${tool.name}`);
  }

  // El bundle compacto del navegador debe reconstruir los mismos 9.147 registros.
  const code=fs.readFileSync(path.join(__dirname,'..','data','registros.compact.js'),'utf8');
  const context={window:{}}; vm.createContext(context); vm.runInContext(code,context,{timeout:5000});
  assert.equal(context.window.SIMECO_REGISTROS.length,9147);
  assert.equal(context.window.SIMECO_REGISTROS[0].period,'2025-01');

  const oldSize=fs.statSync(path.join(__dirname,'..','data','registros.js')).size;
  const compactSize=fs.statSync(path.join(__dirname,'..','data','registros.compact.js')).size;
  assert(compactSize < oldSize*0.5,`El bundle compacto debe pesar menos del 50% (${compactSize}/${oldSize})`);

  console.log(JSON.stringify({ok:true,mode:'data-first',compactBytes:compactSize,legacyBytes:oldSize,reductionPct:Math.round((1-compactSize/oldSize)*1000)/10},null,2));
})().catch(err=>{console.error(err);process.exit(1);});
