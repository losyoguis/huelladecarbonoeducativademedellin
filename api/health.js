'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin} = require('./_lib/http');
module.exports = function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  res.status(200).json({
    ok:true,
    service:'SiMeCO2 API',
    version:'v61-api-assistant-20260807',
    aiConfigured:Boolean(process.env.OPENAI_API_KEY),
    model:process.env.OPENAI_MODEL || 'gpt-5.6-terra',
    records:data.records.length,
    institutions:data.institutions.length,
  });
};
