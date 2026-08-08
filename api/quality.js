'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin,getQuery} = require('./_lib/http');
module.exports = function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');
  res.status(200).json(data.qualityReport(String(getQuery(req,'q','')).trim() || undefined));
};
