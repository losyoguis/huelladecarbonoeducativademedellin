'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin,getQuery} = require('./_lib/http');
module.exports = function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');
  const q=String(getQuery(req,'q','')).trim();
  if(!q) return res.status(400).json({error:'Falta el parámetro q.'});
  res.status(200).json(data.history(q,getQuery(req,'metric','energyKwh'),{year:getQuery(req,'year')||undefined}));
};
