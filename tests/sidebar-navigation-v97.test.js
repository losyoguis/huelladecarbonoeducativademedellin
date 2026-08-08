const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

const a=html.indexOf('<aside class="side-navigation"'),b=html.indexOf('</aside>',a);
ok(a>=0&&b>a,'Falta aside lateral');
const side=html.slice(a,b);
const labels=[...side.matchAll(/data-section="seccion-(\d+)"[\s\S]*?<strong>(.*?)<\/strong>/g)].map(m=>`${m[1]}. ${m[2]}`);
const expected=['1. Analizar Datos','2. Histórico','3. Ranking','4. Informe por sede','5. Estado de Información','6. Aula','7. Agua','8. Gas','9. Facturas por I.E.'];
ok(JSON.stringify(labels)===JSON.stringify(expected),`Orden lateral: ${labels.join(' | ')}`);
ok(side.includes('⚡')&&side.includes('💧')&&side.includes('🔥')&&side.includes('📄'),'Faltan identidades por recurso');
ok(side.includes('id="scanDataBtn"'),'Analizar Datos perdió scanDataBtn');
ok(html.includes("localStorage.setItem(STORAGE_KEY"),'Estado colapsado no se persiste');
ok(html.includes("event.key === 'Escape'"),'Drawer móvil no responde a Escape');
ok(html.includes("target.scrollIntoView"),'Cambio de sección no desplaza contenido');
ok(css.includes('.side-navigation .section-tab.active small'),'Falta contraste de subtítulo activo');
console.log(JSON.stringify({ok:true,labels,groups:3,collapsible:true}));
