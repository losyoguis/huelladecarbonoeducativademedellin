'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin} = require('./_lib/http');

module.exports = async function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
  const probe = String(req.query?.probe || '') === '1';
  const payload = {
    ok:true,
    service:'SiMeCO2 API',
    version:'v62-grounded-assistant-20260807',
    aiConfigured:Boolean(apiKey),
    model,
    records:data.records.length,
    institutions:data.institutions.length,
  };
  if (probe) {
    if (!apiKey) {
      payload.aiReachable = false;
      payload.aiProbe = 'OPENAI_API_KEY_MISSING';
    } else {
      try {
        const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
          method:'GET', headers:{Authorization:`Bearer ${apiKey}`}
        });
        payload.aiReachable = response.ok;
        payload.aiProbeStatus = response.status;
        if (!response.ok) {
          const body = await response.json().catch(()=>({}));
          payload.aiProbe = body?.error?.code || body?.error?.type || 'OPENAI_MODEL_PROBE_FAILED';
        } else payload.aiProbe = 'OK';
      } catch (error) {
        payload.aiReachable = false;
        payload.aiProbe = 'OPENAI_NETWORK_ERROR';
      }
    }
  }
  res.status(200).json(payload);
};
