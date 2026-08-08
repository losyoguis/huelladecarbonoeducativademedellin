const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

for(let i=1;i<=7;i++){
  ok(new RegExp(`<div class="app-section(?: active)? electricity-module" id="seccion-${i}" data-resource="electricidad"`).test(html),`Módulo ${i} no identificado como Electricidad`);
  ok(html.includes(`<span>⚡</span><strong>Electricidad</strong><small>Módulo ${i} de 9</small>`),`Falta insignia eléctrica ${i}`);
  ok(new RegExp(`data-section="seccion-${i}"[^>]*>[\\s\\S]*?<small>⚡ Electricidad ·`).test(html),`Pestaña ${i} no dice Electricidad`);
}
ok(html.includes('id="seccion-8" data-resource="agua"') && html.includes('<span>💧</span><strong>Agua</strong><small>Módulo 8 de 9</small>'),'Módulo 8 no identificado como Agua');
ok(html.includes('id="seccion-9" data-resource="gas"') && html.includes('<span>🔥</span><strong>Gas</strong><small>Módulo 9 de 9</small>'),'Módulo 9 no identificado como Gas');
ok(css.includes('.electricity-identity')&&css.includes('.water-identity')&&css.includes('.gas-identity'),'Faltan estilos de identidad');
ok((html.match(/resource-module-identity/g)||[]).length===9,'Deben existir 9 insignias de recurso');
ok(html.includes('Electricidad · Actualizar')&&html.includes('Electricidad · Aula'),'Navegación móvil no identifica Electricidad');
console.log(JSON.stringify({ok:true,electricityModules:7,waterModule:8,gasModule:9,identityBadges:9}));
