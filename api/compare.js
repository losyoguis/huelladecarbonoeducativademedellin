'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin,getQuery} = require('./_lib/http');
module.exports = function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');
  const q=String(getQuery(req,'q','')).split('|').map(x=>x.trim()).filter(Boolean);
  if(q.length<2) return res.status(400).json({error:'Usa q=Institución 1|Institución 2'});
  res.status(200).json(data.compareInstitutions(q,getQuery(req,'metric','energyKwh'),{period:getQuery(req,'period')||undefined,year:getQuery(req,'year')||undefined}));
};
