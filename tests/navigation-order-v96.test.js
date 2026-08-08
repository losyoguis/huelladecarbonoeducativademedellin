const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const navStart=html.indexOf('<nav class="section-switcher"'),navEnd=html.indexOf('</nav>',navStart);
const nav=html.slice(navStart,navEnd);
const labels=[...nav.matchAll(/data-section="seccion-(\d+)"[\s\S]*?<strong>(.*?)<\/strong>/g)].map(m=>`${m[1]}. ${m[2]}`);
const expected=['1. Analizar Datos','2. Histórico','3. Ranking','4. Informe por sede','5. Estado de Información','6. Aula','7. Agua','8. Gas','9. Facturas por I.E.'];
ok(JSON.stringify(labels)===JSON.stringify(expected),`Orden del menú: ${labels.join(' | ')}`);
ok(nav.includes('class="section-tab neutral-section-tab" data-section="seccion-9"'),'Facturas no usa pestaña neutral');
ok(nav.includes('📄 Módulo transversal · Fuentes PDF'),'Facturas no se declara transversal');
console.log(JSON.stringify({ok:true,labels}));
