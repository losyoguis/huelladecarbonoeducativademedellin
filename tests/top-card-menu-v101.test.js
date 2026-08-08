const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

const start=html.indexOf('id="topCardMenu"'),end=html.indexOf('</nav>',start);
ok(start>=0&&end>start,'No existe topCardMenu');
const menu=html.slice(start,end);
const labels=[...menu.matchAll(/data-section="seccion-(\d+)"[\s\S]*?<strong>(.*?)<\/strong>/g)].map(m=>`${m[1]}. ${m[2]}`);
const expected=['1. Analizar Datos','2. Histórico','3. Ranking','4. Informe por sede','5. Estado de Información','6. Aula','7. Agua','8. Gas','9. Facturas por I.E.'];
ok(JSON.stringify(labels)===JSON.stringify(expected),`Orden incorrecto: ${labels.join(' | ')}`);
ok(menu.includes('id="scanDataBtn"'),'Analizar Datos perdió scanDataBtn');
ok(menu.includes('class="section-tab electricity-section-tab active"'),'Primera tarjeta no inicia activa');
ok(menu.includes('aria-current="page"'),'Tarjeta inicial no tiene aria-current');
ok(menu.includes('menu-resource')&&menu.includes('menu-detail'),'No se separa recurso/detalle');
ok(css.includes('.top-card-menu .electricity-section-tab.active'),'Falta activo eléctrico');
ok(css.includes('.top-card-menu .water-section-tab.active'),'Falta activo Agua');
ok(css.includes('.top-card-menu .gas-section-tab.active'),'Falta activo Gas');
ok(css.includes('.top-card-menu .neutral-section-tab.active'),'Falta activo transversal');
console.log(JSON.stringify({ok:true,labels,resourceMarked:true}));
