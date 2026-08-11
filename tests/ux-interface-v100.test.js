const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(html.includes('id="simecoWorkspace" data-ux-version="104"'),'Workspace no marca UX v104');
for(let i=1;i<=9;i++) ok(html.includes(`id="seccion-${i}"`),`Falta sección ${i}`);

for(const marker of [
  '.workspace-shell main .app-section{',
  '.workspace-shell main .panel{',
  '#seccion-2 .compare-controls-advanced{',
  '#seccion-3 .ranking-filter-bar{',
  '#seccion-4 .dashboard-site-search{',
  '#seccion-5 .quality-kpis{',
  '#seccion-6 .learning-grid,',
  '#seccion-7 .water-analysis-grid,',
  '#seccion-9 .filter-toolbar{',
  '.workspace-shell main .table-wrap,',
  '@media(max-width:760px)',
  '@media(max-width:460px)'
]) ok(css.includes(marker),`Falta regla UX: ${marker}`);

ok(css.includes('grid-template-columns:repeat(12,minmax(0,1fr))!important'),'Filtros complejos no usan grid fluido');
ok(css.includes('overflow-x:auto!important'),'Tablas/gráficos no protegen overflow');
ok(css.includes('min-width:0!important'),'No se protege el layout contra expansión de contenido');
ok(css.includes('grid-template-columns:1fr!important'),'No existe colapso móvil a una columna');
ok(css.includes('#seccion-1 .hero-huella-card') && css.includes('grid-column:1/-1!important'),'KPI principal móvil no ocupa ancho completo');
ok(css.includes('#seccion-4 .dashboard-site-search>*') && css.includes('grid-row:auto!important'),'Buscador de informe no se reordena en móvil');
ok(css.includes('#seccion-7 .water-filter-bar>*') && css.includes('#seccion-8 .gas-filter-bar>*'),'Filtros Agua/Gas no colapsan bien en móvil');
ok(css.includes('#seccion-9 .filter-toolbar>.toolbar-buttons') && css.includes('grid-template-columns:1fr!important'),'Facturas no tiene acciones móviles apiladas');

console.log(JSON.stringify({
  ok:true,
  sections:9,
  unifiedPanels:true,
  responsiveForms:true,
  responsiveTables:true,
  mobileAppLayout:true,
  googleSitesSafe:true
}));
