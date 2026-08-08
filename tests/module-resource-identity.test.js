const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

for(let i=1;i<=6;i++){
  ok(new RegExp(`<div class="app-section(?: active)? electricity-module" id="seccion-${i}" data-resource="electricidad"`).test(html),`Módulo ${i} no identificado como Electricidad`);
  ok(html.includes(`<span>⚡</span><strong>Electricidad</strong><small>Módulo ${i} de 9</small>`),`Falta insignia eléctrica ${i}`);
}
ok(html.includes('id="seccion-7" data-resource="agua"') && html.includes('<span>💧</span><strong>Agua</strong><small>Módulo 7 de 9</small>'),'Módulo 7 no identificado como Agua');
ok(html.includes('id="seccion-8" data-resource="gas"') && html.includes('<span>🔥</span><strong>Gas</strong><small>Módulo 8 de 9</small>'),'Módulo 8 no identificado como Gas');
ok(html.includes('id="seccion-9" data-resource="transversal"') && html.includes('<span>📄</span><strong>Facturas por I.E.</strong><small>Módulo transversal · 9 de 9</small>'),'Módulo 9 no es transversal');
ok(css.includes('.electricity-identity')&&css.includes('.water-identity')&&css.includes('.gas-identity')&&css.includes('.neutral-identity'),'Faltan estilos de identidad');
ok((html.match(/resource-module-identity/g)||[]).length===9,'Deben existir 9 insignias');
console.log(JSON.stringify({ok:true,electricityModules:6,waterModule:7,gasModule:8,invoicesModule:9,neutralInvoices:true}));
