'use strict';
const assert = require('assert');
const data = require('../api/_lib/simeco-data');

assert(data.records.length >= 9000, 'Debe cargar los registros consolidados');
assert(data.institutions.length > 200, 'Debe construir instituciones/sedes');

const fe = data.institutionReport('Fe y Alegría Santo Domingo Savio');
assert(fe.institution && /Santo Domingo Savio/i.test(fe.institution.name), 'Debe resolver Fe y Alegría');
assert.strictEqual(fe.institution.members.length, 2, 'Fe y Alegría debe integrar dos sedes verificadas');
assert(Math.abs(fe.totals.energyKwh - 73924) < 0.001, `Energía Fe y Alegría esperada 73924, recibida ${fe.totals.energyKwh}`);
assert(!Object.prototype.hasOwnProperty.call(fe.totals,'waterM3'),'La API pública debe exponer únicamente métricas eléctricas');

const inem = data.institutionReport('INEM José Félix de Restrepo');
assert(inem.institution && /INEM/i.test(inem.institution.name), 'Debe resolver INEM');
assert(Math.abs(inem.totals.energyKwh - 258461.17) < 0.001, `Energía INEM esperada 258461.17, recibida ${inem.totals.energyKwh}`);
assert.strictEqual(inem.quality.status, 'cobertura_electrica_parcial', 'INEM debe quedar con cobertura eléctrica parcial enero-julio 2026');
assert(inem.quality.exceptions.some(x => x.status === 'external_contract_integrated'), 'INEM debe conservar trazabilidad del contrato separado integrado');

const rank = data.ranking('energyKwh',{period:'2026-07',limit:10});
assert(rank.ranking.length > 0, 'Ranking debe devolver resultados');
assert(/INEM/i.test(rank.ranking[0].name), 'INEM debe aparecer primero en el ranking energético de julio de 2026');
assert(Math.abs(rank.ranking[0].value - 39643.75) < 0.001, `Consumo INEM julio esperado 39643.75, recibido ${rank.ranking[0].value}`);

const search = data.searchInstitutions('Cr 29 Cl 110 A -83',3);
assert(search.length && /Santo Domingo Savio/i.test(search[0].name), 'Debe buscar por dirección');

console.log(JSON.stringify({ok:true,records:data.records.length,institutions:data.institutions.length,feEnergy:fe.totals.energyKwh,inemStatus:inem.quality.status,ranking:rank.ranking.length},null,2));
