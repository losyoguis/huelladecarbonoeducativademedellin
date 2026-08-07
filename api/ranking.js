'use strict';
const data = require('./_lib/simeco-data');
const {enforceOrigin,getQuery} = require('./_lib/http');
module.exports = function handler(req,res) {
  if (!enforceOrigin(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Usa GET.'});
  const metric = getQuery(req,'metric','energyKwh');
  res.status(200).json(data.ranking(metric,{period:getQuery(req,'period')||undefined,year:getQuery(req,'year')||undefined,limit:Number(getQuery(req,'limit',10))}));
};
