const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const inst=fs.readFileSync('institucional.js','utf8');
const terr=fs.readFileSync('territorial.js','utf8');
ok(app.includes("function googleMapsAddressUrl(address,schoolName='')"),'Google Maps no recibe nombre del colegio');
ok(app.includes("[school,raw,'Medellín','Antioquia','Colombia']"),'Consulta de Maps no combina colegio y dirección');
ok(app.includes('🏫 ${escapeHtml(text)}'),'Falta icono de colegio');
ok(app.includes('schoolName:row.displaySite||row.site'),'Canvas no conserva el nombre del colegio');
ok(app.includes('openAddressInGoogleMaps(zone.address,zone.schoolName)'),'Canvas no abre colegio + dirección');
ok(inst.includes("[school,raw,'Medellín','Antioquia','Colombia']"),'Búsqueda institucional no combina colegio + dirección');
ok(terr.includes("[school,raw,'Medellín','Antioquia','Colombia']"),'Territorial no combina colegio + dirección');
console.log('OK school-map-location');
