const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');

ok(css.includes('@media(min-width:761px) and (max-width:1120px)'),'Falta rail para iframe/tablet');
ok(css.includes('grid-template-columns:86px minmax(0,1fr)!important'),'Rail no reserva contenido fluido');
ok(css.includes('@media(max-width:760px)'),'Falta drawer móvil');
ok(css.includes('width:min(86vw,320px)!important'),'Drawer móvil no limita ancho');
ok(css.includes('transform:translateX(-105%)'),'Drawer no inicia fuera de pantalla');
ok(css.includes('.workspace-shell.sidebar-mobile-open .side-navigation'),'Falta estado abierto');
ok(css.includes('max-width:100%'),'No hay protección de ancho');
ok(css.includes('min-width:0!important'),'Contenido no protege overflow');
ok(html.includes('aria-controls="sideNavigation"'),'Lanzador móvil no es accesible');
ok(html.includes('aria-expanded="false"'),'Falta estado ARIA inicial');
ok(!html.includes('mobile-bottom-nav'),'No debe coexistir bottom nav');
console.log(JSON.stringify({ok:true,desktopSidebar:true,tabletRail:true,mobileDrawer:true,googleSitesIframe:true}));
