const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('app.js','utf8');
function ok(v,m){if(!v)throw new Error(m);}
ok(html.includes('savingsTop3Interpretation'),'Falta contenedor Top 3');
ok(js.includes('function renderSavingsTop3Interpretation(rows)'),'Falta función de interpretación');
ok(js.includes('rows.slice(0,3)'),'No se limitan los ejemplos al Top 3');
ok(js.includes('70%') && js.includes('30%'),'Falta explicación del índice 70/30');
ok(js.includes('Interpretación:'),'Falta texto interpretativo');
console.log('OK ranking-top3-interpretation');
