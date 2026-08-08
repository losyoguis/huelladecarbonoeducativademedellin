'use strict';
const {answerAssistant} = require('./_lib/assistant-core');
const crypto = require('crypto');
const {enforceOrigin,rateLimit} = require('./_lib/http');

const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map();
function cacheKey(message){ return String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
function readCache(key){
  const item=responseCache.get(key);
  if(!item || Date.now()-item.at>CACHE_TTL_MS){ if(item) responseCache.delete(key); return null; }
  return item.value;
}
function writeCache(key,value){
  responseCache.set(key,{at:Date.now(),value});
  if(responseCache.size>200){ const first=responseCache.keys().next().value; responseCache.delete(first); }
}

module.exports = async function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'POST') return res.status(405).json({error:'Usa POST.'});
  if (!rateLimit(req,res)) return;
  res.setHeader('Cache-Control','no-store');
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const message = String(body.message || '').trim();
  if (!message) return res.status(400).json({error:'Escribe una pregunta.'});
  if (message.length > 1600) return res.status(400).json({error:'La pregunta es demasiado larga.'});
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const key=cacheKey(message);
  const cached=!Array.isArray(body.history) || body.history.length===0 ? readCache(key) : null;
  if(cached) return res.status(200).json({...cached,cached:true});
  try {
    const rawSession=String(body.sessionId || req.headers['x-forwarded-for'] || 'anonymous').slice(0,200);
    const safetyIdentifier='simeco2_'+crypto.createHash('sha256').update(rawSession).digest('hex').slice(0,32);
    const result = await answerAssistant({message,history:body.history,apiKey,model,safetyIdentifier});
    const payload={ok:true,...result,dataVersion:'v65-rendimiento-consultas-20260807'};
    if(result.mode==='data' && (!Array.isArray(body.history) || body.history.length===0)) writeCache(key,payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('SiMeCO2 chat error', error);
    const msg=String(error?.message||'');
    let code='OPENAI_REQUEST_FAILED';
    if(error.status===429 || /quota|billing|credit|rate limit/i.test(msg)) code='OPENAI_QUOTA_OR_RATE_LIMIT';
    else if(error.status===401 || /api key|authentication/i.test(msg)) code='OPENAI_AUTH_ERROR';
    else if(error.status===403 || /permission|access/i.test(msg)) code='OPENAI_ACCESS_ERROR';
    else if(error.status===400 || /model/i.test(msg)) code='OPENAI_BAD_REQUEST';
    else if(/OPENAI_API_KEY_MISSING/.test(msg)) code='OPENAI_API_KEY_MISSING';
    const safeDetail = code==='OPENAI_QUOTA_OR_RATE_LIMIT' ? 'La IA no está disponible por cuota o límite de uso; las consultas estructuradas de SiMeCO₂ siguen funcionando sin consumir OpenAI.' :
      code==='OPENAI_AUTH_ERROR' ? 'La clave de OpenAI no fue aceptada.' :
      code==='OPENAI_ACCESS_ERROR' ? 'La cuenta o el proyecto de OpenAI no tiene acceso suficiente.' :
      code==='OPENAI_BAD_REQUEST' ? 'OpenAI rechazó la solicitud o la configuración del modelo.' :
      code==='OPENAI_API_KEY_MISSING' ? 'La IA no está configurada; las consultas estructuradas siguen disponibles desde la API de datos.' : 'La consulta de IA falló en el servidor.';
    return res.status(error.status && error.status>=400 && error.status<600 ? error.status : 500).json({error:'No fue posible completar esta consulta con IA.',code,detail:safeDetail});
  }
};
