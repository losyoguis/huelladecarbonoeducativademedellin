const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const app=fs.readFileSync('app.js','utf8');
const inst=fs.readFileSync('institucional.js','utf8');
const terr=fs.readFileSync('territorial.js','utf8');
ok(app.includes('const recordSearchTextCache = new WeakMap()'),'Falta caché de texto de búsqueda');
ok(app.includes('const siteSearchOptionsCache = new Map()'),'Falta caché de opciones de sedes');
ok(app.includes('let recordsBySiteKeyCache = null'),'Falta índice por sede');
ok(app.includes("scheduleAutocomplete('main-site-search'"),'Búsqueda principal no está diferida');
ok(app.includes("applyFilters(false,220)"),'Filtro de tabla no está desacoplado del teclado');
ok(app.includes("scheduleAutocomplete(`field:${config.inputId}`"),'Autocompletados de dashboard/comparación no están diferidos');
ok(app.includes("filteredRecordsCache={key:cacheKey,rows}") || app.includes("filteredRecordsCache={key:cacheKey,rows};"),'Falta caché de resultados filtrados');
ok(!/input\.addEventListener\('input',\(\)=>\{[\s\S]{0,500}renderDashboard\(\)/.test(app),'El dashboard todavía se recalcula directamente al escribir');
ok(inst.includes('institutionSearchTimer=setTimeout'),'Búsqueda institucional no tiene debounce');
ok(terr.includes('inputTimer=setTimeout'),'Búsqueda territorial no tiene debounce');
console.log('OK search-performance');
