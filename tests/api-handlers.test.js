'use strict';
const assert=require('assert');

function makeRes(){
  return {
    statusCode:200, headers:{}, body:null, ended:false,
    setHeader(k,v){this.headers[k]=v;},
    status(n){this.statusCode=n;return this;},
    json(v){this.body=v;this.ended=true;return this;},
    end(){this.ended=true;return this;}
  };
}
function req(method,query={}){return {method,query,headers:{host:'simeco.test',origin:'https://simeco.test'},socket:{remoteAddress:'127.0.0.1'}};}

const health=require('../api/health');
const institutions=require('../api/institutions');
const institution=require('../api/institution');
const ranking=require('../api/ranking');

let res=makeRes(); health(req('GET'),res); assert.equal(res.statusCode,200); assert.equal(res.body.ok,true); assert(res.body.records>=9000);
res=makeRes(); institutions(req('GET',{q:'Fe y Alegría Santo Domingo Savio'}),res); assert.equal(res.statusCode,200); assert(/Santo Domingo/i.test(res.body.results[0].name));
res=makeRes(); institution(req('GET',{q:'INEM José Félix de Restrepo'}),res); assert.equal(res.statusCode,200); assert.equal(res.body.totals.energyKwh,null); assert.equal(res.body.quality.status,'energia_contrato_separado');
res=makeRes(); ranking(req('GET',{metric:'energyKwh',period:'2026-07',limit:'5'}),res); assert.equal(res.statusCode,200); assert.equal(res.body.ranking.length,5); assert(!res.body.ranking.some(x=>/INEM/i.test(x.name)));
console.log(JSON.stringify({ok:true,handlers:['health','institutions','institution','ranking']},null,2));
