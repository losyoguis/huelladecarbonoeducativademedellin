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
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
  try {
    const rawSession=String(body.sessionId || req.headers['x-forwarded-for'] || 'anonymous').slice(0,200);
    const safetyIdentifier='simeco2_'+crypto.createHash('sha256').update(rawSession).digest('hex').slice(0,32);
    const result = await answerWithOpenAI({message,history:body.history,apiKey,model,safetyIdentifier});
    return res.status(200).json({ok:true,...result,dataVersion:'v61-api-assistant-20260807'});
  } catch (error) {
    console.error('SiMeCO2 chat error', error);
    return res.status(error.status === 429 ? 429 : 500).json({error:'No fue posible completar la consulta con IA.',detail:process.env.NODE_ENV==='development'?error.message:undefined});
  }
};
