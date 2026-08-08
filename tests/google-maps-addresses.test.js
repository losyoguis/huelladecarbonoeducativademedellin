const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const inst=fs.readFileSync('institucional.js','utf8');
const terr=fs.readFileSync('territorial.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
ok(app.includes('https://www.google.com/maps/search/?api=1&query='),'Falta URL de Google Maps en app');
ok(app.includes('mapAddressLink'),'Falta helper central de direcciones');
ok(app.includes('rankingMapHitZones') && app.includes('savingsMapHitZones'),'Faltan zonas clicables en rankings canvas');
ok(app.includes("bindEvent('siteChart','click',handleRankingCanvasMapClick)"),'Ranking principal no abre Maps');
ok(app.includes("bindEvent('savingsSiteChart','click',handleSavingsCanvasMapClick)"),'Ranking de ahorro no abre Maps');
ok(inst.includes('mapsUrl') && inst.includes('institutionAddress').toString(),'Búsqueda institucional sin Maps');
ok(terr.includes('googleMapsUrl') && terr.includes('mapAddressLink'),'Módulo territorial sin Maps');
ok(css.includes('.map-address'),'Faltan estilos de enlaces');
console.log('OK google-maps-addresses');
