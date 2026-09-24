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
res=makeRes(); institution(req('GET',{q:'INEM José Félix de Restrepo'}),res); assert.equal(res.statusCode,200); assert(Math.abs(res.body.totals.energyKwh-258461.17)<0.001); assert.equal(res.body.quality.status,'cobertura_electrica_parcial');
res=makeRes(); ranking(req('GET',{metric:'energyKwh',period:'2026-07',limit:'5'}),res); assert.equal(res.statusCode,200); assert.equal(res.body.ranking.length,5); assert(/INEM/i.test(res.body.ranking[0].name)); assert(Math.abs(res.body.ranking[0].value-39643.75)<0.001);
console.log(JSON.stringify({ok:true,handlers:['health','institutions','institution','ranking']},null,2));
