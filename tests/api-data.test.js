'use strict';
const assert = require('assert');
const data = require('../api/_lib/simeco-data');

assert(data.records.length >= 9000, 'Debe cargar los registros consolidados');
assert(data.institutions.length > 200, 'Debe construir instituciones/sedes');

const fe = data.institutionReport('Fe y Alegría Santo Domingo Savio');
assert(fe.institution && /Santo Domingo Savio/i.test(fe.institution.name), 'Debe resolver Fe y Alegría');
assert.strictEqual(fe.institution.members.length, 2, 'Fe y Alegría debe integrar dos sedes verificadas');
assert(Math.abs(fe.totals.energyKwh - 73924) < 0.001, `Energía Fe y Alegría esperada 73924, recibida ${fe.totals.energyKwh}`);
assert(Math.abs(fe.totals.waterM3 - 14600) < 0.001, 'Agua Fe y Alegría debe ser 14600 m3');

const inem = data.institutionReport('INEM José Félix de Restrepo');
assert(inem.institution && /INEM/i.test(inem.institution.name), 'Debe resolver INEM');
assert.strictEqual(inem.totals.energyKwh, null, 'INEM no debe convertir energía ausente en 0');
assert.strictEqual(inem.quality.status, 'energia_contrato_separado', 'INEM debe conservar excepción de contrato separado');

const rank = data.ranking('energyKwh',{period:'2026-07',limit:10});
assert(rank.ranking.length > 0, 'Ranking debe devolver resultados');
assert(!rank.ranking.some(x => /INEM/i.test(x.name)), 'INEM no debe aparecer con 0 en ranking energético');

const search = data.searchInstitutions('Cr 29 Cl 110 A -83',3);
assert(search.length && /Santo Domingo Savio/i.test(search[0].name), 'Debe buscar por dirección');

console.log(JSON.stringify({ok:true,records:data.records.length,institutions:data.institutions.length,feEnergy:fe.totals.energyKwh,inemStatus:inem.quality.status,ranking:rank.ranking.length},null,2));
