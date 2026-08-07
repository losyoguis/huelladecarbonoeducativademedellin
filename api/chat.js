'use strict';
const {answerWithOpenAI} = require('./_lib/assistant-core');
const crypto = require('crypto');
const {enforceOrigin,rateLimit} = require('./_lib/http');

module.exports = async function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'POST') return res.status(405).json({error:'Usa POST.'});
  if (!rateLimit(req,res)) return;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({error:'El Asistente IA todavía no está configurado en el servidor.',code:'OPENAI_API_KEY_MISSING'});
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const message = String(body.message || '').trim();
  if (!message) return res.status(400).json({error:'Escribe una pregunta.'});
  if (message.length > 1800) return res.status(400).json({error:'La pregunta es demasiado larga.'});
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  try {
    const rawSession=String(body.sessionId || req.headers['x-forwarded-for'] || 'anonymous').slice(0,200);
    const safetyIdentifier='simeco2_'+crypto.createHash('sha256').update(rawSession).digest('hex').slice(0,32);
    const result = await answerWithOpenAI({message,history:body.history,apiKey,model,safetyIdentifier});
    return res.status(200).json({ok:true,...result,dataVersion:'v63-api-model-fix-20260807'});
  } catch (error) {
    console.error('SiMeCO2 chat error', error);
    const msg=String(error?.message||'');
    let code='OPENAI_REQUEST_FAILED';
    if(error.status===429 || /quota|billing|credit|rate limit/i.test(msg)) code='OPENAI_QUOTA_OR_RATE_LIMIT';
    else if(error.status===401 || /api key|authentication/i.test(msg)) code='OPENAI_AUTH_ERROR';
    else if(error.status===403 || /permission|access/i.test(msg)) code='OPENAI_ACCESS_ERROR';
    else if(error.status===400 || /model/i.test(msg)) code='OPENAI_BAD_REQUEST';
    const safeDetail = code==='OPENAI_QUOTA_OR_RATE_LIMIT' ? 'La API de OpenAI rechazó la consulta por cuota, crédito o límite de uso.' :
      code==='OPENAI_AUTH_ERROR' ? 'La clave de OpenAI no fue aceptada.' :
      code==='OPENAI_ACCESS_ERROR' ? 'La cuenta o el proyecto de OpenAI no tiene acceso suficiente.' :
      code==='OPENAI_BAD_REQUEST' ? 'OpenAI rechazó la solicitud o la configuración del modelo.' : 'La consulta de IA falló en el servidor.';
    return res.status(error.status && error.status>=400 && error.status<600 ? error.status : 500).json({error:'No fue posible completar la consulta con IA.',code,detail:safeDetail});
  }
};
