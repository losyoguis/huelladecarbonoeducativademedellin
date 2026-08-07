'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin,getQuery} = require('./_lib/http');
module.exports = function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  const q = String(getQuery(req,'q','')).trim();
  if (!q) return res.status(400).json({error:'Falta el parámetro q.'});
  res.status(200).json({query:q,results:data.searchInstitutions(q,Number(getQuery(req,'limit',8)))});
};
