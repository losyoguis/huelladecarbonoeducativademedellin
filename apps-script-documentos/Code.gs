/**
 * SiMeCO₂ · factura -> OCR -> planes -> predimensionamiento técnico
 * Google Apps Script V8
 *
 * Esta versión conserva el flujo del código suministrado por el usuario y:
 * - genera 4 PDF personalizados + factura original;
 * - reproduce la estructura de los planes SiMeCO₂ de Energía y Agua;
 * - infiere un plan equivalente para Gas;
 * - marca todos los PDF con Juan Carlos Blandón Vargas, URL y correo;
 * - incorpora una tabla económica de referencia para sistemas On-Grid del Área Metropolitana de Medellín;
 * - genera un predimensionamiento solar inspirado en los ejemplos técnicos aportados, con marca exclusiva de Líderes Ambientales;
 * - simula financiación con la tasa inferida de los ejemplos: 1,50% M.V. (≈19,56% E.A.);
 * - calcula/extrae la tarifa desde la fila real de energía de la factura (Costo $/kWh o valor bruto de energía ÷ kWh), evitando lecturas de medidor, códigos y totales con subsidios.
 * - convierte una sola factura en diagnósticos preliminares profesionales con trazabilidad de datos, normalización por días, escenarios, matrices de acción y rutas 30/60/90;
 * - distingue explícitamente datos observados, indicadores calculados, proyecciones y campos pendientes;
 * - nunca presenta una sola factura como auditoría, ahorro verificado, diagnóstico de fugas o certificación de seguridad;
 * - alinea el correo de entrega con la narrativa posterior al evento de Climate Week Medellín;
 * - presenta de forma clara los cinco beneficios principales prometidos al enviar la factura;
 * - identifica el predimensionamiento solar como referencia preliminar diseñada por Líderes Ambientales;
 * - solo escala información a GSV Ingeniería cuando existe autorización expresa del solicitante.
 * - enlaza GSV Ingeniería desde la narrativa del formulario;
 * - muestra el aviso de privacidad contraído por defecto para facilitar la lectura;
 * - permite nombres de solicitante desde 2 caracteres, manteniendo validación backend.
 */

'use strict';

const APP_NAME = 'SiMeCO₂ · Huella de Carbono Educativa de Medellín';
const COPY_EMAIL = 'lideres.ambientales@iemanueljbetancur.edu.co';
const AUTHOR_NAME = 'Juan Carlos Blandón Vargas';
const PROJECT_URL = 'https://sites.google.com/iemanueljbetancur.edu.co/lideres-ambientales';
const GSV_URL = 'https://www.gsvingenieria.com/';
const CLIMATE_WEEK_URL = 'https://www.climateweekmedellin.com/';
const CONTACT_EMAIL = 'lideres.ambientales@iemanueljbetancur.edu.co';
const CONTACT_PHONE = '3015262740';
const CONTACT_PHONE_DISPLAY = '301-5262740';
const REDUCTION_PLAN_FORMAT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vROy43UO0t01fHOsw3hkcBFZtF_s_56UskA2RMYo_gxVjNGmQOroqUl-D1c8cRUz11TgiLHvr-dlVnl/pubhtml?gid=1056875832&single=true&widget=true&headers=false';
const WHATSAPP_MESSAGE = 'Hola. Recibí mi estudio ambiental de Líderes Ambientales de Medellín y quisiera conocer cómo escalar el predimensionamiento solar a una propuesta técnico-comercial con GSV Ingeniería.';
const WHATSAPP_URL = 'https://wa.me/57' + CONTACT_PHONE + '?text=' + encodeURIComponent(WHATSAPP_MESSAGE);
const SOLAR_INITIAL_NOTE = 'Este predimensionamiento es un punto de referencia preliminar diseñado por Líderes Ambientales para facilitar la comprensión del potencial solar de la sede. No constituye una cotización ni un diseño definitivo. Si el solicitante lo desea y autoriza expresamente el intercambio de información, el estudio podrá escalarse a GSV Ingeniería para elaborar una propuesta técnico-comercial formal, sujeta a visita técnica, ingeniería de detalle y condiciones vigentes.';
const DATABASE_FOLDER_ID = '1FSOB0B3wgGzVvkAqd16kc0UXkMVYJDZx';
const DATABASE_SPREADSHEET_ID = '1MkfmeIMUQ0PzEwygmUsuw62PK0DH2Jlv1fwhjpzUdSg';
const DATABASE_SHEET_NAME = 'Solicitudes SiMeCO₂';
const DASHBOARD_SPREADSHEET_ID = '1GgE1rNfvhx1l2FtJRTwtebaxMvsWAk6FZlC6mp1H3us';
const DASHBOARD_SHEET_NAME = 'Respuestas';
const DASHBOARD_GSV_HEADER = 'Autorización GSV Ingeniería';
const DASHBOARD_GSV_PRIORITY_STATUS = 'GSV autorizado · Prioridad comercial';
const DRIVE_LINK_COLUMN_START = 58; // BF
const DRIVE_LINK_HEADERS = [
  'Carpeta Drive expediente',
  'PDF factura servicio',
  'PDF informe detallado PGEE-UPME',
  'PDF ahorro de agua',
  'PDF ahorro de gas',
  'PDF predimensionamiento solar',
  'Google Sheets plan reducciones GEI'
];
const EDUCATIONAL_METRIC_COLUMN_START = DRIVE_LINK_COLUMN_START + DRIVE_LINK_HEADERS.length; // BM
const EDUCATIONAL_METRIC_HEADERS = [
  'Número de estudiantes',
  'kWh/mes por estudiante'
];
const TIMEZONE = 'America/Bogota';
const TEMP_FOLDER_NAME = 'SiMeCO2_TEMP_FACTURAS';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_INVOICE_FILES = 5;
const TOKEN_TTL_SECONDS = 21600;
const PAGE_SESSION_TTL_SECONDS = 21600;
const PAGE_SESSION_MAX_OCR_ATTEMPTS = 3;
const OCR_LIMIT_PER_MINUTE = 0;
const OCR_LIMIT_PER_HOUR = 0;
const OCR_LIMIT_PER_DAY = 0;
const STUDY_LIMIT_PER_MINUTE = 0;
const STUDY_LIMIT_PER_DAY = 0;
const STUDY_LIMIT_PER_EMAIL_DAY = 0;
const RATE_LIMIT_PROPERTY = 'SIMECO2_RATE_LIMITS_V1';
const PROCESSING_MARKER_TTL_SECONDS = 600;
const PRIVACY_NOTICE_VERSION = 'Aviso de privacidad SiMeCO₂ · v2 · 2026-09-11';
const DATA_RETENTION_MONTHS = 24;
const REQUESTER_TYPES = [
  'Institución Educativa','Colegio Privado','Universidad','Empresa',
  'Propiedad Horizontal','Apartamento','Casa','Finca','Cabaña','Otros'
];

// Rango de validación técnica para evitar que el OCR confunda códigos, estrato,
// números de contrato o valores totales con una tarifa COP/kWh.
// Si la factura no permite obtener una tarifa dentro de este rango, el campo
// queda para confirmación manual en vez de mostrar un valor erróneo.
const TARIFF_MIN_COP_KWH = 80;
const TARIFF_MAX_COP_KWH = 4000;

const ELECTRIC_FACTOR_KG_CO2_KWH = 0.126;
const TREE_CAPTURE_KG_YEAR = 22;
const GAS_FACTOR_KG_CO2_M3 = 2.00;
const GAS_KWH_EQUIVALENT_PER_M3 = 10.55;
const STANDARD_MONTH_DAYS = 30.44;
const REPORT_VERSION = 'SiMeCO₂ · Informe detallado PGEE-UPME v2.2';
const APP_BUILD = 'SIMECO2-CLIMATEWEEK-2026.09.13-DASHBOARD-HEADER-REAL-V6';
const DEFAULT_ANALYSIS_CONFIDENCE = 'media';

// Parámetros del predimensionamiento solar inferidos de los ejemplos aportados.
// Los documentos de referencia usan de forma recurrente 4,2 h/día y una
// producción cercana a 126 kWh/kWp-mes (= 4,2 x 30). En los ejemplos más
// recientes se usan módulos bifaciales de 615 Wp y un área de ~3,2 m²/módulo.
const SOLAR_IRRADIANCE_H_DAY = 4.2;
const SOLAR_DAYS_MONTH = 30;
const SOLAR_SPECIFIC_YIELD_KWH_KWP_MONTH = SOLAR_IRRADIANCE_H_DAY * SOLAR_DAYS_MONTH; // referencia física simple
const SOLAR_PANEL_WP = 615;
const SOLAR_AREA_PER_PANEL_M2 = 3.2;
const SOLAR_TREE_CAPTURE_KG_YEAR = 12; // criterio de compensación usado en los ejemplos solares
const SOLAR_LIFE_YEARS = 25;
const SOLAR_DC_AC_RATIO_LARGE = 1.24;

// Tabla económica de referencia para sistemas On-Grid del Área Metropolitana de Medellín.
// Formato de cada fila: [potencia_kWp, area_m2, energia_kWh_mes, valor_proyecto_COP, COP_por_kWp].
// Punto 9 · Trazabilidad de la referencia económica. La fecha original del
// insumo no fue documentada; se conserva la fecha verificable de integración.
const SOLAR_PRICE_TABLE = [[1.2,6,141,13310019,11573930],[1.7,9,212,14797710,8578383],[2.3,12,283,18014529,7832404],[2.9,15,354,18836207,6551724],[3.5,18,424,20824882,6036198],[4.0,21,495,22400858,5565431],[4.6,24,566,23986545,5214466],[5.2,27,637,26637225,5147290],[5.8,30,707,28347326,4929970],[6.3,33,778,29456410,4657140],[6.9,36,849,30820162,4466690],[7.5,39,919,33813795,4523585],[8.1,42,990,36620887,4549178],[8.6,45,1061,37460021,4343191],[9.2,48,1132,38092500,4140489],[9.8,51,1202,40551464,4148487],[10.4,54,1273,45689490,4414443],[10.9,57,1344,47220117,4322207],[11.5,60,1415,48644673,4229972],[12.1,63,1485,49963157,4137736],[12.7,66,1556,53267116,4210839],[13.2,69,1627,56655143,4283943],[13.8,72,1697,58551104,4242834],[14.4,75,1768,59016684,4105508],[15.0,78,1839,59324340,3968183],[15.5,81,1910,60838541,3918747],[16.1,84,1980,62295889,3869310],[16.7,87,2051,63696385,3819873],[17.3,90,2122,65040029,3770436],[17.8,93,2192,66326821,3721000],[18.4,96,2263,67556760,3671563],[19.0,99,2334,68729847,3622126],[19.6,102,2405,69846082,3572690],[20.1,105,2475,70905465,3523253],[20.7,108,2546,71907996,3473816],[21.3,111,2617,73808199,3469246],[21.9,114,2688,75703146,3464675],[22.4,117,2758,77592837,3460104],[23.0,120,2829,79477271,3455534],[23.6,123,2900,81356450,3450963],[24.2,126,2970,83230372,3446392],[24.7,129,3041,85099037,3441822],[25.3,132,3112,86962447,3437251],[25.9,135,3183,88820600,3432680],[26.5,138,3253,90673497,3428110],[27.0,141,3324,92521138,3423539],[27.6,144,3395,94363522,3418968],[28.2,147,3466,96200650,3414398],[28.8,150,3536,99418194,3458024],[29.3,153,3607,101406558,3458024],[29.9,156,3678,103394922,3458024],[30.5,159,3748,105383286,3458024],[31.1,162,3819,107371649,3458024],[31.6,165,3890,109360013,3458024],[32.2,168,3961,111348377,3458024],[32.8,171,4031,113336741,3458024],[33.4,174,4102,115325105,3458024],[33.9,177,4173,117313469,3458024],[34.5,180,4244,119301833,3458024],[35.1,183,4314,121290197,3458024],[35.7,186,4385,123278560,3458024],[36.2,189,4456,125266924,3458024],[36.8,192,4526,127255288,3458024],[37.4,195,4597,129243652,3458024],[38.0,198,4668,131232016,3458024],[38.5,201,4739,133220380,3458024],[39.1,204,4809,135208744,3458024],[39.7,207,4880,137197108,3458024],[40.3,210,4951,139185472,3458024],[40.8,213,5021,141173835,3458024],[41.4,216,5092,144968341,3501651],[42.0,219,5163,146935314,3500544],[42.6,222,5234,148901014,3499436],[43.1,225,5304,150865440,3498329],[43.7,228,5375,152828593,3497222],[44.3,231,5446,154790473,3496115],[44.9,234,5517,156751079,3495007],[45.4,237,5587,158710412,3493900],[46.0,240,5658,160668472,3492793],[46.6,243,5729,162625259,3491686],[47.2,246,5799,164580772,3490578],[47.7,249,5870,166535012,3489471],[48.3,252,5941,168487978,3488364],[48.9,255,6012,170439671,3487257],[49.5,258,6082,172390091,3486149],[50.0,261,6153,174339237,3485042],[50.6,264,6224,176287111,3483935],[51.2,267,6295,178233711,3482828],[51.8,270,6365,180179037,3481721],[52.3,273,6436,182123090,3480613],[52.9,276,6507,184065870,3479506],[53.5,279,6577,186007377,3478399],[54.1,282,6648,187947610,3477292],[54.6,285,6719,189886570,3476184],[55.2,288,6790,191824257,3475077],[55.8,291,6860,193760670,3473970],[56.4,294,6931,195695810,3472863],[56.9,297,7002,197629677,3471755],[57.5,300,7073,199562270,3470648],[58.1,302,7143,201493590,3469541],[58.7,305,7214,203423637,3468434],[59.2,308,7285,205352410,3467326],[59.8,311,7355,207279910,3466219],[60.4,314,7426,209206137,3465112],[61.0,317,7497,211177453,3464765],[61.5,320,7568,213148371,3464419],[62.1,323,7638,215118890,3464072],[62.7,326,7709,217089011,3463726],[63.3,329,7780,219058733,3463379],[63.8,332,7850,221028056,3463033],[64.4,335,7921,222996981,3462686],[65.0,338,7992,224965508,3462339],[65.6,341,8063,226933636,3461993],[66.1,344,8133,228901365,3461646],[66.7,347,8204,230868696,3461300],[67.3,350,8275,232835628,3460953],[67.9,353,8346,234802162,3460607],[68.4,356,8416,236768297,3460260],[69.0,359,8487,238734033,3459914],[69.6,362,8558,240699371,3459567],[70.2,365,8628,242664311,3459220],[70.7,368,8699,244628852,3458874],[71.3,371,8770,246592994,3458527],[71.9,374,8841,248556738,3458181],[72.5,377,8911,250520083,3457834],[73.0,380,8982,252483030,3457488],[73.6,383,9053,254445578,3457141],[74.2,386,9124,256407728,3456794],[74.8,389,9194,258369479,3456448],[75.3,392,9265,260330831,3456101],[75.9,395,9336,262291785,3455755],[76.5,398,9406,264252341,3455408],[77.1,401,9477,266212498,3455062],[77.6,404,9548,268172256,3454715],[78.2,407,9619,270131616,3454368],[78.8,410,9689,272090577,3454022],[79.4,413,9760,274049140,3453675],[79.9,416,9831,276007304,3453329],[80.5,419,9902,277965069,3452982],[81.1,422,9972,279689595,3449764],[81.7,425,10043,281410419,3446545],[82.2,428,10114,283127542,3443327],[82.8,431,10184,284840963,3440108],[83.4,434,10255,286550683,3436890],[84.0,437,10326,288256702,3433671],[84.5,440,10397,289959020,3430453],[85.1,443,10467,291657637,3427234],[85.7,446,10538,293352552,3424016],[86.3,449,10609,295043766,3420797],[86.8,452,10679,296731279,3417579],[87.4,455,10750,298415090,3414360],[88.0,458,10821,300095200,3411142],[88.6,461,10892,301771609,3407923],[89.1,464,10962,303444316,3404705],[89.7,467,11033,305113323,3401486],[90.3,470,11104,306778628,3398268],[90.9,473,11175,308440232,3395049],[91.4,476,11245,310098134,3391831],[92.0,479,11316,311752335,3388612],[92.6,482,11387,313402835,3385394],[93.2,485,11457,315049634,3382175],[93.7,488,11528,316692732,3378957],[94.3,491,11599,318332128,3375738],[94.9,494,11670,319967823,3372520],[95.5,497,11740,321599816,3369301],[96.0,500,11811,323228109,3366083],[96.6,503,11882,324852700,3362864],[97.2,506,11953,326473590,3359646],[97.8,509,12023,328090778,3356427],[98.3,512,12094,329704265,3353209],[98.9,515,12165,331314051,3349990],[99.5,518,12235,332920136,3346772],[100.1,521,12306,334200509,3340335],[100.6,524,12377,335936984,3338504],[101.2,527,12448,337671353,3336673],[101.8,530,12518,339403617,3334843],[102.4,533,12589,341133775,3333012],[102.9,536,12660,342861829,3331181],[103.5,539,12731,344587776,3329350],[104.1,542,12801,346311619,3327520],[104.7,545,12872,348033356,3325689],[105.2,548,12943,349752988,3323858],[105.8,551,13013,351470514,3322028],[106.4,554,13084,353185935,3320197],[107.0,557,13155,354899251,3318366],[107.5,560,13226,356610461,3316535],[108.1,563,13296,358319566,3314705],[108.7,566,13367,360026566,3312874],[109.3,569,13438,361731460,3311043],[109.8,572,13508,363434249,3309212],[110.4,575,13579,365134933,3307382],[111.0,578,13650,366833511,3305551],[111.6,581,13721,368529984,3303720],[112.1,584,13791,370224351,3301889],[112.7,587,13862,371916614,3300059],[113.3,590,13933,373606771,3298228],[113.9,593,14004,375294822,3296397],[114.4,596,14074,376980768,3294566],[115.0,599,14145,378664609,3292736],[115.6,601,14216,380346345,3290905],[116.2,604,14286,382025975,3289074],[116.7,607,14357,383703499,3287244],[117.3,610,14428,385378919,3285413],[117.9,613,14499,387052233,3283582],[118.5,616,14569,388723442,3281751],[119.0,619,14640,390392545,3279921],[119.6,622,14711,392059543,3278090],[120.2,625,14782,393724436,3276259],[120.8,628,14852,395387223,3274428],[121.3,631,14923,397047905,3272598],[121.9,634,14994,398706482,3270767],[122.5,637,15064,400362953,3268936],[123.1,640,15135,402017319,3267105],[123.6,643,15206,403669579,3265275],[124.2,646,15277,405319735,3263444],[124.8,649,15347,406967785,3261613],[125.4,652,15418,408613729,3259782],[125.9,655,15489,410257568,3257952],[126.5,658,15560,411899302,3256121],[127.1,661,15630,413538931,3254290],[127.7,664,15701,415176454,3252459],[128.2,667,15772,416811872,3250629],[128.8,670,15842,418445184,3248798],[129.4,673,15913,420076391,3246967],[130.0,676,15984,421705493,3245137]];
const SOLAR_ECONOMIC_REFERENCE_VERSION = 'SIMECO2-ECO-2026.09-v1';
const SOLAR_ECONOMIC_REFERENCE_SOURCE = 'Tabla económica de sistemas On-Grid para el Área Metropolitana de Medellín suministrada por el usuario como insumo técnico del proyecto.';
const SOLAR_ECONOMIC_REFERENCE_SOURCE_DATE = 'No documentada en el insumo suministrado';
const SOLAR_ECONOMIC_REFERENCE_INTEGRATED_AT = '2026-09-04';
const SOLAR_ECONOMIC_REFERENCE_SCOPE = 'Tabla original: 1,2 a 130,0 kWp. SiMeCO₂ interpola o extrapola únicamente el valor económico para la potencia DC física calculada con módulos de 615 Wp.';
const SOLAR_PRICE_REFERENCE_NOTE = 'Valores económicos de referencia para sistemas solares On-Grid en el Área Metropolitana de Medellín. Fuente: insumo técnico suministrado al proyecto; fecha original no documentada. Versión SiMeCO₂: ' + SOLAR_ECONOMIC_REFERENCE_VERSION + ', integrada el ' + SOLAR_ECONOMIC_REFERENCE_INTEGRATED_AT + '. No constituye cotización vigente y debe validarse según ubicación, cubierta, alcance, impuestos, equipos y condiciones eléctricas.';

// Punto 9 · Trazabilidad del modelo financiero. La tasa no es una tasa
// bancaria vigente: se infiere matemáticamente de los ejemplos suministrados.
const SOLAR_FINANCE_MODEL_VERSION = 'SIMECO2-FIN-2026.09-v1';
const SOLAR_FINANCE_REFERENCE_SOURCE = 'Tasa inferida matemáticamente a partir de los ejemplos de financiación suministrados por el usuario.';
const SOLAR_FINANCE_REFERENCE_SOURCE_DATE = 'No documentada en los ejemplos suministrados';
const SOLAR_FINANCE_REFERENCE_INTEGRATED_AT = '2026-09-04';
const SOLAR_FINANCE_METHOD = 'Anualidad vencida; 1,50% M.V.; E.A. = (1 + 0,015)^12 - 1 = 19,5618%; simulación sobre 100% del valor referencial, sin cuota inicial.';
const SOLAR_FINANCE_RATE_MV = 0.015;
const SOLAR_FINANCE_RATE_EA = Math.pow(1 + SOLAR_FINANCE_RATE_MV, 12) - 1;
const SOLAR_FINANCE_TERMS = [48, 60, 120];

const TARGET_SHORT = 0.15;
const TARGET_MEDIUM = 0.40;
const TARGET_SOLAR = 0.80;
const TARGET_WATER = 0.15;
const TARGET_GAS = 0.10;

const BRAND_GREEN = '#0B5D45';
const BRAND_DARK = '#17352E';
const LIGHT_GREEN = '#E8F5EE';
const LIGHT_LIME = '#F1F8D8';
const WATER_BLUE = '#0B67A3';
const LIGHT_BLUE = '#E8F4FB';
const GAS_ORANGE = '#A65312';
const LIGHT_ORANGE = '#FFF1E5';
const GRID = '#D7E1DD';

// Identidad visual del correo de entrega · continuidad Climate Week Medellín.
const EMAIL_NAVY = '#003A5D';
const EMAIL_GREEN = '#0B6B4B';
const EMAIL_BG = '#F5FAF7';
const EMAIL_SOFT_GREEN = '#EEF8F2';
const EMAIL_BORDER = '#DCEBE4';
const EMAIL_TEXT = '#17231F';
const EMAIL_MUTED = '#586962';

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.pageSessionToken = createPageSession_();
  return template
    .evaluate()
    .setTitle('SiMeCO2 · Estudio desde factura')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Recibe la factura desde el navegador, la guarda temporalmente,
 * aplica OCR con Drive API v3 y extrae energia, agua y gas.
 */
function analyzeInvoice(inputFiles, pageSessionToken) {
  consumePageSessionForOcr_(pageSessionToken);
  enforceRateLimit_('ocr');
  cleanupOldTempFiles_();
  const received = Array.isArray(inputFiles) ? inputFiles : [inputFiles];
  if (!received.length || received.length > MAX_INVOICE_FILES) {
    throw new Error('Selecciona entre 1 y ' + MAX_INVOICE_FILES + ' archivos de la misma factura.');
  }
  const files = received.map(normalizeIncomingFile_);
  files.forEach(validateIncomingFile_);

  const tempFolder = getTempFolder_();
  const originalFiles = [];
  const ocrDocIds = [];
  try {
    const extractedTexts = [];
    files.forEach(function(file, index) {
      const bytes = Utilities.base64Decode(file.base64);
      if (!bytes.length) throw new Error('El archivo “' + file.name + '” llegó vacío. Vuelve a seleccionarlo.');

      const blob = Utilities.newBlob(bytes, file.mimeType, file.name);
      const originalFile = tempFolder.createFile(blob).setName(file.name);
      originalFiles.push(originalFile);

      const imported = Drive.Files.create({
        name: 'OCR_' + Date.now() + '_' + index + '_' + file.name,
        mimeType: 'application/vnd.google-apps.document'
      }, blob, {
        ocrLanguage: 'es',
        fields: 'id,name,mimeType'
      });
      ocrDocIds.push(imported.id);

      let text = '';
      for (let attempt = 0; attempt < 7; attempt++) {
        Utilities.sleep(attempt === 0 ? 1200 : 650);
        try {
          text = DocumentApp.openById(imported.id).getBody().getText() || '';
          if (text.trim().length > 30) break;
        } catch (err) {
          if (attempt === 6) throw err;
        }
      }
      if (!text || text.trim().length < 10) {
        throw new Error('El OCR no encontró texto legible en “' + file.name + '”. Usa una imagen más nítida o un PDF original.');
      }
      extractedTexts.push('ARCHIVO ' + (index + 1) + ': ' + file.name + '\n' + text);
    });

    const parsed = extractInvoiceData_(extractedTexts.join('\n\n'));
    const token = Utilities.getUuid();

    const invoiceMeta = {
      fileId: originalFiles[0].getId(),
      fileName: originalFiles[0].getName(),
      mimeType: files[0].mimeType,
      fileIds: originalFiles.map(function(f) { return f.getId(); }),
      fileNames: originalFiles.map(function(f) { return f.getName(); }),
      mimeTypes: files.map(function(f) { return f.mimeType; }),
      createdAt: Date.now(),
      consumption: parsed.energyKwh || 0,
      energyKwh: parsed.energyKwh || 0,
      tariff: parsed.energyTariff || 0,
      energyTariff: parsed.energyTariff || 0,
      energyCharge: parsed.energyCharge || 0,
      tariffMethod: parsed.tariffMethod || 'none',
      tariffSource: parsed.tariffSource || '',
      tariffExplanation: parsed.tariffExplanation || '',
      totalBill: parsed.totalBill || 0,
      waterM3: parsed.waterM3 || 0,
      waterCharge: parsed.waterCharge || 0,
      gasM3: parsed.gasM3 || 0,
      gasCharge: parsed.gasCharge || 0,
      institutionName: parsed.institutionName || '',
      serviceAddress: parsed.serviceAddress || '',
      city: parsed.city || '',
      municipio: parsed.city || '',
      municipality: parsed.city || '',
      billingPeriod: parsed.billingPeriod || '',
      billingStart: parsed.billingStart || '',
      billingEnd: parsed.billingEnd || '',
      billingDays: parsed.billingDays || 0,
      contractNumber: parsed.contractNumber || '',
      customerName: parsed.customerName || '',
      confidence: parsed.confidence,
      pageSessionToken: String(pageSessionToken || '')
    };

    CacheService.getScriptCache().put(
      'invoice:' + token,
      JSON.stringify(invoiceMeta),
      TOKEN_TTL_SECONDS
    );

    ocrDocIds.forEach(trashQuietly_);

    const warnings = [];
    if (!parsed.energyKwh) warnings.push('No se identificó el consumo eléctrico con suficiente confianza. Confírmalo manualmente.');
    if (!parsed.energyTariff) warnings.push('No se pudo calcular una tarifa eléctrica confiable con los datos visibles de la factura. Confirma manualmente el costo COP/kWh antes de continuar.');
    if (!parsed.city) warnings.push('No se identificó la ciudad o municipio con suficiente confianza. Confírmala manualmente.');
    if (!parsed.waterM3) warnings.push('Agua: consumo no identificado o el servicio no aparece en esta factura.');
    if (!parsed.gasM3) warnings.push('Gas: consumo no identificado o el servicio no aparece en esta factura.');
    if (!warnings.length) warnings.push('Datos detectados por OCR. Verifica visualmente la factura antes de enviar el estudio.');

    return {
      ok: true,
      build: APP_BUILD,
      token: token,
      fileName: originalFiles.map(function(f) { return f.getName(); }).join(', '),
      fileNames: originalFiles.map(function(f) { return f.getName(); }),
      fileCount: originalFiles.length,
      consumption: parsed.energyKwh || 0,
      energyKwh: parsed.energyKwh || 0,
      tariff: parsed.energyTariff || 0,
      energyTariff: parsed.energyTariff || 0,
      energyCharge: parsed.energyCharge || 0,
      tariffMethod: parsed.tariffMethod || 'none',
      tariffSource: parsed.tariffSource || '',
      tariffExplanation: parsed.tariffExplanation || '',
      totalBill: parsed.totalBill || 0,
      waterM3: parsed.waterM3 || 0,
      waterCharge: parsed.waterCharge || 0,
      gasM3: parsed.gasM3 || 0,
      gasCharge: parsed.gasCharge || 0,
      institutionName: parsed.institutionName || '',
      serviceAddress: parsed.serviceAddress || '',
      city: parsed.city || '',
      municipio: parsed.city || '',
      municipality: parsed.city || '',
      billingPeriod: parsed.billingPeriod || '',
      billingStart: parsed.billingStart || '',
      billingEnd: parsed.billingEnd || '',
      billingDays: parsed.billingDays || 0,
      contractNumber: parsed.contractNumber || '',
      confidence: parsed.confidence,
      warning: warnings.join(' ')
    };

  } catch (err) {
    ocrDocIds.forEach(trashQuietly_);
    originalFiles.forEach(function(f) { trashQuietly_(f.getId()); });
    throw new Error('No fue posible procesar la factura: ' + (err && err.message ? err.message : err));
  }
}

/**
 * Compatible con el submit actual del Index.html.
 * Usa los datos solares que ya calcula la interfaz y complementa
 * energia/agua/gas con lo extraido directamente de la factura.
 */
function generateAndSendStudy(payload) {
  validateStudyPayload_(payload);

  const cache = CacheService.getScriptCache();
  const raw = cache.get('invoice:' + payload.invoiceToken);
  if (!raw) throw new Error('La sesión de la factura venció. Vuelve a cargarla y procesa nuevamente.');

  const invoiceMeta = JSON.parse(raw);
  validatePageSessionForStudy_(payload.pageSessionToken, invoiceMeta.pageSessionToken);
  assertMailQuotaAvailable_(payload.email);
  let invoiceFiles;
  try {
    const fileIds = Array.isArray(invoiceMeta.fileIds) && invoiceMeta.fileIds.length
      ? invoiceMeta.fileIds
      : [invoiceMeta.fileId];
    invoiceFiles = fileIds.map(function(id) { return DriveApp.getFileById(id); });
  } catch (err) {
    throw new Error('No se encontraron todos los archivos temporales de la factura. Vuelve a cargarlos.');
  }

  const data = normalizeStudyPayload_(payload);
  data.consentVersion = PRIVACY_NOTICE_VERSION;
  data.gsvConsent = payload.gsvConsent === true;
  data.retentionUntil = new Date();
  data.retentionUntil.setMonth(data.retentionUntil.getMonth() + DATA_RETENTION_MONTHS);
  data.invoiceFileName = Array.isArray(invoiceMeta.fileNames) && invoiceMeta.fileNames.length
    ? invoiceMeta.fileNames.join(', ')
    : (invoiceMeta.fileName || data.invoiceFileName || 'Factura_servicios_publicos');
  data.waterM3 = Object.prototype.hasOwnProperty.call(payload, 'waterM3')
    ? finiteOrZero_(payload.waterM3)
    : finiteOrZero_(invoiceMeta.waterM3);
  data.gasM3 = Object.prototype.hasOwnProperty.call(payload, 'gasM3')
    ? finiteOrZero_(payload.gasM3)
    : finiteOrZero_(invoiceMeta.gasM3);
  data.waterCharge = finiteOrZero_(invoiceMeta.waterCharge);
  data.gasCharge = finiteOrZero_(invoiceMeta.gasCharge);

  data.institutionName = cleanText_(data.institutionName) || cleanText_(invoiceMeta.institutionName) || cleanText_(invoiceMeta.customerName) || 'Sede educativa / solicitante';
  data.serviceAddress = cleanText_(data.serviceAddress) || cleanText_(invoiceMeta.serviceAddress) || 'Dirección no identificada en OCR';
  data.ocrCity = cleanText_(invoiceMeta.city);
  data.city = cleanText_(data.city) || data.ocrCity;
  data.cityWasCorrected = !!data.ocrCity && normalizeComparisonText_(data.city) !== normalizeComparisonText_(data.ocrCity);
  data.citySource = data.ocrCity
    ? (data.cityWasCorrected ? 'Municipio corregido y confirmado por el usuario' : 'Municipio OCR confirmado por el usuario')
    : 'Municipio ingresado y confirmado manualmente';
  data.billingPeriod = cleanText_(data.billingPeriod) || cleanText_(invoiceMeta.billingPeriod) || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  data.billingStart = cleanText_(invoiceMeta.billingStart);
  data.billingEnd = cleanText_(invoiceMeta.billingEnd);
  data.billingDays = finiteOrZero_(invoiceMeta.billingDays) || billingDaysFromPeriod_(data.billingPeriod);
  data.analysisConfidence = normalizeConfidence_(invoiceMeta.confidence || DEFAULT_ANALYSIS_CONFIDENCE);
  data.contractNumber = cleanText_(data.contractNumber) || cleanText_(invoiceMeta.contractNumber);
  data.totalBill = finiteOrZero_(invoiceMeta.totalBill);

  // El valor confirmado en el formulario es definitivo. El OCR se conserva
  // por separado para trazabilidad y nunca vuelve a sobrescribir al usuario.
  data.ocrConsumption = finiteOrZero_(invoiceMeta.consumption);
  data.ocrTariff = finiteOrZero_(invoiceMeta.tariff);
  data.ocrEnergyCharge = finiteOrZero_(invoiceMeta.energyCharge);
  data.consumptionWasCorrected = data.ocrConsumption > 0 && Math.abs(data.consumption - data.ocrConsumption) > 0.001;
  data.tariffWasCorrected = data.ocrTariff > 0 && Math.abs(data.tariff - data.ocrTariff) > 0.01;
  data.consumptionSource = data.ocrConsumption > 0
    ? (data.consumptionWasCorrected ? 'Valor corregido y confirmado por el usuario' : 'Valor OCR confirmado por el usuario')
    : 'Valor ingresado y confirmado manualmente';
  data.tariffFinalSource = data.ocrTariff > 0
    ? (data.tariffWasCorrected ? 'Tarifa corregida y confirmada por el usuario' : 'Tarifa OCR confirmada por el usuario')
    : 'Tarifa ingresada y confirmada manualmente';

  data.energyCharge = finiteOrZero_(invoiceMeta.energyCharge);
  data.tariffMethod = data.tariffWasCorrected || !data.ocrTariff
    ? 'manual_user_confirmed'
    : String(invoiceMeta.tariffMethod || 'manual_user_confirmed');
  data.tariffSource = data.tariffFinalSource;
  data.tariffExplanation = data.tariffWasCorrected
    ? 'El OCR detectó ' + fmt_(data.ocrTariff, 2) + ' COP/kWh y el usuario confirmó ' + fmt_(data.tariff, 2) + ' COP/kWh. Para todos los cálculos se usa el valor confirmado.'
    : String(invoiceMeta.tariffExplanation || data.tariffFinalSource);
  if (data.consumption && data.tariff) {
    const computedGross = data.consumption * data.tariff;
    data.monthlyBillApprox = data.consumptionWasCorrected || data.tariffWasCorrected || !data.ocrConsumption || !data.ocrTariff || !data.energyCharge
      ? computedGross
      : data.energyCharge;
  }
  applyStudentMetrics_(data);

  // El backend recalcula el predimensionamiento antes de guardar o generar PDF.
  applySolarPredimensioning_(data);

  // Evita dos envíos simultáneos con el mismo token de factura.
  acquireInvoiceProcessing_(payload.invoiceToken);
  try {
    enforceRateLimit_('study', payload.email);
  } catch (rateErr) {
    releaseInvoiceProcessing_(payload.invoiceToken);
    throw rateErr;
  }

  const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss');
  const codeId = 'SIMECO2-' + stamp + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();

  // CRÍTICO: registrar PRIMERO. Si la base no puede escribirse, no se envía el
  // correo silenciosamente. Así una solicitud nunca se considera completada
  // sin quedar registrada en la hoja solicitada.
  let dbRef;
  let dashboardRef;
  let dashboardFinalized = false;
  let dashboardWarning = '';
  try {
    dbRef = registerStudyRequest_(data, codeId, 'Procesando');
  } catch (dbErr) {
    invoiceFiles.forEach(function(file) { trashQuietly_(file.getId()); });
    cache.remove('invoice:' + payload.invoiceToken);
    releaseInvoiceProcessing_(payload.invoiceToken);
    throw new Error(
      'No fue posible registrar la solicitud en “Base de datos solicitudes SiMeCO₂”. ' +
      'No se enviaron los documentos para evitar perder el registro. Detalle: ' +
      (dbErr && dbErr.message ? dbErr.message : dbErr)
    );
  }

  try {
    const energyPlan = buildEnergyManagementPdf_(data, codeId);
    const waterPlan = buildWaterPlanPdf_(data, codeId);
    const gasPlan = buildGasPlanPdf_(data, codeId);
    const solarPdf = buildSolarPdf_(data, codeId);
    const invoiceBlobs = invoiceFiles.map(function(file, index) {
      const originalName = Array.isArray(invoiceMeta.fileNames) && invoiceMeta.fileNames[index]
        ? invoiceMeta.fileNames[index]
        : file.getName();
      return file.getBlob().setName(safeAttachmentName_(originalName, 'Factura_servicio_' + (index + 1) + '.pdf'));
    });
    const attachmentSelection = selectEmailAttachments_([energyPlan, waterPlan, gasPlan, solarPdf], invoiceBlobs);
    const attachments = attachmentSelection.attachments;

    const expediente = createStudyExpediente_(data, codeId, {
      invoiceBlobs: invoiceBlobs,
      energyPlan: energyPlan,
      waterPlan: waterPlan,
      gasPlan: gasPlan,
      solarPdf: solarPdf
    });
    writeStudyDriveLinks_(dbRef, expediente);

    // El dashboard comercial usa otra hoja y un esquema histórico de 40
    // columnas. Esta escritura inicial es obligatoria: si falla, el correo no
    // se envía y el usuario puede volver a intentarlo sin perder seguimiento.
    try {
      dashboardRef = registerDashboardRequest_(data, codeId, expediente);
    } catch (dashboardErr) {
      throw new Error(
        'La solicitud quedó guardada en la base técnica, pero no fue posible registrarla en el dashboard. ' +
        'No se envió el correo para evitar que el seguimiento comercial quede incompleto. Detalle: ' +
        (dashboardErr && dashboardErr.message ? dashboardErr.message : dashboardErr)
      );
    }

    const attachedInvoiceHtml = attachmentSelection.includedInvoiceNames.length
      ? '<li><strong>Factura(s) original(es) adjunta(s):</strong> ' + attachmentSelection.includedInvoiceNames.map(escapeHtml_).join(', ') + '.</li>'
      : '';
    const omittedInvoiceHtml = attachmentSelection.omittedInvoiceNames.length
      ? '<p><strong>Factura(s) no adjunta(s) por tamaño:</strong> ' + attachmentSelection.omittedInvoiceNames.map(escapeHtml_).join(', ') + '.</p>' +
        (expediente.requesterAccessGranted
          ? '<p>Estas facturas y todos los documentos del estudio están disponibles en el <a href="' + escapeHtml_(expediente.folderUrl) + '">expediente privado de Drive</a>, compartido con ' + escapeHtml_(data.email) + '.</p>'
          : '<p>La configuración de Drive no permitió compartir automáticamente el expediente. Solicita una copia escribiendo a <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> e indicando el código ' + escapeHtml_(codeId) + '.</p>')
      : '';
    const driveAccessHtml = !attachmentSelection.omittedInvoiceNames.length && expediente.requesterAccessGranted
      ? '<p>También puedes consultar los documentos en el <a href="' + escapeHtml_(expediente.folderUrl) + '">expediente privado de Drive</a>, compartido con tu correo.</p>'
      : '';
    const reductionPlanSheetHtml = expediente.reductionPlanSheetUrl
      ? '<p><strong>Google Sheets editable:</strong> completa el <a href="' + escapeHtml_(expediente.reductionPlanSheetUrl) + '">Plan de Reducciones GEI de ' + escapeHtml_(data.institutionName) + '</a>. Esta hoja de cálculo quedó guardada en el mismo expediente de Drive y compartida para edición con el correo solicitante.</p>'
      : '';

    const attachedInvoicePlain = attachmentSelection.includedInvoiceNames.length
      ? 'Factura(s) original(es) adjunta(s): ' + attachmentSelection.includedInvoiceNames.join(', ') + '.'
      : '';
    const omittedInvoicePlain = attachmentSelection.omittedInvoiceNames.length
      ? [
          'Factura(s) no adjunta(s) por tamaño: ' + attachmentSelection.omittedInvoiceNames.join(', ') + '.',
          expediente.requesterAccessGranted
            ? 'Consulta estas facturas y todos los documentos en el expediente privado de Drive: ' + expediente.folderUrl
            : 'Drive no permitió compartir automáticamente el expediente. Solicita una copia en ' + CONTACT_EMAIL + ' indicando el código ' + codeId + '.'
        ].join('\n')
      : '';
    const driveAccessPlain = !attachmentSelection.omittedInvoiceNames.length && expediente.requesterAccessGranted
      ? 'Expediente privado de Drive: ' + expediente.folderUrl
      : '';
    const reductionPlanSheetPlain = expediente.reductionPlanSheetUrl
      ? 'Google Sheets editable · Plan de Reducciones GEI: ' + expediente.reductionPlanSheetUrl
      : '';

    const subject = data.fullName + ', tu estudio ambiental ya está listo';
    const serviceSummary = [
      '<strong>Energía:</strong> ' + (data.consumption ? fmt_(data.consumption, 2) + ' kWh/mes' : 'no identificada') + (data.tariff ? ' · Tarifa confirmada: ' + money_(data.tariff) + '/kWh' : ''),
      '<strong>Agua:</strong> ' + (data.waterM3 ? fmt_(data.waterM3, 2) + ' m³/mes' : 'no identificada'),
      '<strong>Gas:</strong> ' + (data.gasM3 ? fmt_(data.gasM3, 2) + ' m³/mes' : 'no identificado')
    ].join('<br>');

    const benefitRowsHtml = [
      ['⚡', 'Plan de Gestión Energética y Reducción de GEI', 'Diagnóstico energético inicial, línea base, acciones priorizadas, ruta 30/60/90 e indicadores para gestionar el consumo y las emisiones.'],
      ['💧', 'Plan de Ahorro y Uso Eficiente del Agua', 'Lectura del consumo, línea base normalizada, acciones de uso eficiente y seguimiento para orientar decisiones.'],
      ['🌎', 'Análisis del consumo y huella de carbono', 'Consumo confirmado, indicadores calculados, emisiones de referencia y oportunidades de mejora con trazabilidad del dato.'],
      ['☀️', 'Predimensionamiento preliminar de energía solar', 'Potencia, paneles, área, generación y cobertura estimadas como referencia inicial para comprender el potencial solar.'],
      ['📉', 'Ahorro, emisiones evitadas y oportunidades de mejora', 'Escenarios preliminares de ahorro económico y ambiental para priorizar acciones antes de una evaluación técnica definitiva.']
    ].map(function(item) {
      return '<tr>' +
        '<td style="width:42px;vertical-align:top;padding:10px 8px 10px 0;font-size:22px;">' + item[0] + '</td>' +
        '<td style="vertical-align:top;padding:10px 0;border-bottom:1px solid ' + EMAIL_BORDER + ';">' +
          '<div style="font-weight:700;color:' + EMAIL_NAVY + ';font-size:15px;margin-bottom:4px;">' + item[1] + '</div>' +
          '<div style="color:' + EMAIL_MUTED + ';font-size:13px;line-height:1.5;">' + item[2] + '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    const gasComplementHtml = '<div style="margin-top:12px;padding:12px 14px;border-radius:10px;background:#FFF7ED;border:1px solid #FED7AA;color:#7C2D12;font-size:13px;line-height:1.5;">' +
      '<strong>Gestión complementaria de gas:</strong> Líderes Ambientales de Medellín también entrega un plan inicial de gestión y uso eficiente del gas. Cuando la factura no contiene este servicio, el documento deja trazabilidad de los datos pendientes en lugar de inventar resultados.' +
      '</div>';

    const solarDecisionHtml = data.gsvConsent
      ? '<div style="margin:18px 0;padding:16px 18px;border-left:5px solid ' + EMAIL_GREEN + ';background:' + EMAIL_SOFT_GREEN + ';border-radius:10px;">' +
          '<div style="font-weight:700;color:' + EMAIL_GREEN + ';font-size:16px;margin-bottom:6px;">Del punto de referencia a una propuesta comercial</div>' +
          '<div style="color:' + EMAIL_TEXT + ';font-size:14px;line-height:1.55;">El predimensionamiento solar adjunto fue diseñado por <a href="' + escapeHtml_(PROJECT_URL) + '" target="_blank" style="color:' + EMAIL_NAVY + ';font-weight:700;text-decoration:underline;">Líderes Ambientales de Medellín</a> como una referencia preliminar. Marcaste la autorización opcional para compartir la información con <a href="' + escapeHtml_(GSV_URL) + '" target="_blank" style="color:' + EMAIL_GREEN + ';font-weight:700;text-decoration:underline;">GSV Ingeniería</a>; por ello, el estudio puede escalarse para preparar una propuesta técnico-comercial formal, sujeta a validación técnica, visita, ingeniería de detalle y condiciones comerciales vigentes.</div>' +
          '<div style="margin-top:12px;"><a href="' + escapeHtml_(WHATSAPP_URL) + '" target="_blank" style="display:inline-block;background:' + EMAIL_GREEN + ';color:#FFFFFF;text-decoration:none;font-weight:700;padding:11px 16px;border-radius:8px;">Quiero avanzar con la propuesta solar</a></div>' +
        '</div>'
      : '<div style="margin:18px 0;padding:16px 18px;border-left:5px solid ' + EMAIL_NAVY + ';background:#EEF4F8;border-radius:10px;">' +
          '<div style="font-weight:700;color:' + EMAIL_NAVY + ';font-size:16px;margin-bottom:6px;">Predimensionamiento solar: punto de referencia</div>' +
          '<div style="color:' + EMAIL_TEXT + ';font-size:14px;line-height:1.55;">El predimensionamiento adjunto fue diseñado por <a href="' + escapeHtml_(PROJECT_URL) + '" target="_blank" style="color:' + EMAIL_NAVY + ';font-weight:700;text-decoration:underline;">Líderes Ambientales de Medellín</a> para ofrecer un punto de partida técnico y pedagógico. <strong>No es una cotización comercial ni un diseño definitivo.</strong> Si más adelante deseas convertir esta referencia en una propuesta formal de <a href="' + escapeHtml_(GSV_URL) + '" target="_blank" style="color:' + EMAIL_GREEN + ';font-weight:700;text-decoration:underline;">GSV Ingeniería</a>, escríbenos; antes de compartir información gestionaremos la autorización correspondiente.</div>' +
          '<div style="margin-top:12px;"><a href="' + escapeHtml_(WHATSAPP_URL) + '" target="_blank" style="display:inline-block;background:' + EMAIL_NAVY + ';color:#FFFFFF;text-decoration:none;font-weight:700;padding:11px 16px;border-radius:8px;">Consultar cómo escalar el proyecto</a></div>' +
        '</div>';

    const quickMetricsHtml = [
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#FFFFFF;border:1px solid ' + EMAIL_BORDER + ';border-radius:12px;overflow:hidden;">',
        '<tr><td colspan="2" style="padding:14px 16px;background:' + EMAIL_SOFT_GREEN + ';font-weight:700;color:' + EMAIL_GREEN + ';">Lectura rápida del estudio</td></tr>',
        '<tr><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';color:' + EMAIL_MUTED + ';width:44%;">Consumo eléctrico confirmado</td><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';font-weight:700;color:' + EMAIL_TEXT + ';">' + (data.consumption ? fmt_(data.consumption, 2) + ' kWh/mes' : 'Pendiente') + '</td></tr>',
        '<tr><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';color:' + EMAIL_MUTED + ';">Potencia solar de referencia</td><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';font-weight:700;color:' + EMAIL_TEXT + ';">' + (data.kwp ? fmt_(data.kwp, 1) + ' kWp' : 'Pendiente') + '</td></tr>',
        '<tr><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';color:' + EMAIL_MUTED + ';">Generación solar estimada</td><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';font-weight:700;color:' + EMAIL_TEXT + ';">' + (data.generationMonthly ? fmt_(data.generationMonthly, 0) + ' kWh/mes' : 'Pendiente') + '</td></tr>',
        '<tr><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';color:' + EMAIL_MUTED + ';">Ahorro mensual estimado</td><td style="padding:11px 16px;border-bottom:1px solid ' + EMAIL_BORDER + ';font-weight:700;color:' + EMAIL_TEXT + ';">' + (data.monthlySaving ? money_(data.monthlySaving) : 'Pendiente') + '</td></tr>',
        '<tr><td style="padding:11px 16px;color:' + EMAIL_MUTED + ';">Emisiones evitadas por solar</td><td style="padding:11px 16px;font-weight:700;color:' + EMAIL_TEXT + ';">' + (data.solarCo2 ? fmt_(data.solarCo2, 3) + ' t CO₂e/año' : 'Pendiente') + '</td></tr>',
      '</table>'
    ].join('');

    const htmlBody = [
      '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
      '<body style="margin:0;padding:0;background:' + EMAIL_BG + ';font-family:Arial,Helvetica,sans-serif;color:' + EMAIL_TEXT + ';">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + EMAIL_BG + ';padding:24px 10px;"><tr><td align="center">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#FFFFFF;border:1px solid ' + EMAIL_BORDER + ';border-radius:16px;overflow:hidden;">',
        '<tr><td style="background:' + EMAIL_NAVY + ';padding:26px 28px;border-bottom:6px solid ' + EMAIL_GREEN + ';">',
          '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#CFE7DE;font-weight:700;margin-bottom:8px;">Líderes Ambientales de Medellín</div>',
          '<div style="font-size:28px;line-height:1.2;color:#FFFFFF;font-weight:800;margin-bottom:10px;">Tu factura ya se convirtió en información para tomar decisiones</div>',
          '<div style="font-size:15px;line-height:1.6;color:#EAF4F0;">Como continuidad del encuentro de <a href="' + escapeHtml_(CLIMATE_WEEK_URL) + '" target="_blank" style="color:#FFFFFF;font-weight:700;">Climate Week Medellín</a>, transformamos la factura enviada en un estudio preliminar para ayudarte a entender el consumo, la huella de carbono y las oportunidades de ahorro y energía solar.</div>',
        '</td></tr>',
        '<tr><td style="padding:26px 28px;">',
          '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Cordial saludo <strong>' + escapeHtml_(data.fullName) + '</strong>,</p>',
          '<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Gracias por enviar la factura de <strong>' + escapeHtml_(data.institutionName) + '</strong>. Tu estudio ambiental ya está listo y encontrarás los documentos adjuntos en este correo.</p>',

          '<div style="padding:14px 16px;background:' + EMAIL_SOFT_GREEN + ';border-left:5px solid ' + EMAIL_GREEN + ';border-radius:10px;margin-bottom:22px;">',
            '<div style="font-weight:800;color:' + EMAIL_GREEN + ';font-size:16px;">Lo prometido después del evento, convertido en entregables concretos</div>',
            '<div style="margin-top:5px;color:' + EMAIL_MUTED + ';font-size:13px;line-height:1.5;">La factura se utiliza como punto de partida. Una sola factura permite construir un diagnóstico y escenarios preliminares; no sustituye una auditoría ni una verificación de ahorros.</div>',
          '</div>',

          '<div style="font-size:20px;font-weight:800;color:' + EMAIL_NAVY + ';margin:0 0 8px;">Beneficios que recibes</div>',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">' + benefitRowsHtml + '</table>',
          gasComplementHtml,

          '<div style="font-size:20px;font-weight:800;color:' + EMAIL_NAVY + ';margin:24px 0 10px;">Documentos preparados para ti</div>',
          '<ol style="margin:0 0 8px 20px;padding:0;color:' + EMAIL_TEXT + ';font-size:14px;line-height:1.65;">',
            '<li><strong>Informe Detallado de Diagnóstico y Plan Inicial de Gestión Energética PGEE-UPME</strong>.</li>',
            '<li><strong>Plan de Acción de Ahorro de Agua</strong>.</li>',
            '<li><strong>Plan de Gestión y Uso Eficiente del Gas</strong>.</li>',
            '<li><strong>Predimensionamiento Solar de Líderes Ambientales</strong>.</li>',
            attachedInvoiceHtml,
          '</ol>',
          omittedInvoiceHtml,
          driveAccessHtml,

          '<div style="margin:20px 0;">' + quickMetricsHtml + '</div>',
          solarDecisionHtml,

          reductionPlanSheetHtml,
          buildReductionPlanFormatHtml_(data, expediente.reductionPlanSheetUrl),

          '<div style="font-size:20px;font-weight:800;color:' + EMAIL_NAVY + ';margin:24px 0 10px;">Servicios identificados en la factura</div>',
          '<div style="padding:14px 16px;background:#F8FAFC;border:1px solid ' + EMAIL_BORDER + ';border-radius:10px;color:' + EMAIL_TEXT + ';font-size:14px;line-height:1.7;">' + serviceSummary + '</div>',

          '<div style="margin:20px 0;padding:14px 16px;border-radius:10px;background:#FFF9E8;border:1px solid #F3D98B;color:#5C4A14;font-size:13px;line-height:1.55;">',
            '<strong>Importante:</strong> consumo, tarifa y municipio utilizados corresponden a los valores confirmados por el solicitante. Las normalizaciones, anualizaciones, escenarios, metas y estimaciones de ahorro son herramientas de planeación. No constituyen ahorro verificado, auditoría, certificación de seguridad ni cotización definitiva.',
          '</div>',

          '<div style="font-size:12px;line-height:1.6;color:' + EMAIL_MUTED + ';border-top:1px solid ' + EMAIL_BORDER + ';padding-top:16px;">',
            '<strong>Código del estudio:</strong> ' + escapeHtml_(codeId) + '<br>',
            '<strong>Autorización GSV Ingeniería:</strong> ' + (data.gsvConsent ? 'Sí, autorizada expresamente en el formulario.' : 'No autorizada; la información no se comparte con GSV Ingeniería.') + '<br>',
            '<strong>Conservación informada:</strong> archivos temporales hasta 48 horas; expediente y registro hasta ' + DATA_RETENTION_MONTHS + ' meses, salvo obligación legal aplicable o solicitud válida de supresión.',
          '</div>',
        '</td></tr>',
        '<tr><td style="background:#F6FAF8;border-top:1px solid ' + EMAIL_BORDER + ';padding:20px 28px;">',
          '<div style="font-size:14px;line-height:1.6;color:' + EMAIL_TEXT + ';">Cordialmente,<br><strong>' + escapeHtml_(AUTHOR_NAME) + '</strong><br>Líderes Ambientales de Medellín</div>',
          '<div style="margin-top:8px;font-size:13px;line-height:1.6;color:' + EMAIL_MUTED + ';">',
            '<a href="' + escapeHtml_(PROJECT_URL) + '" target="_blank" style="color:' + EMAIL_NAVY + ';font-weight:700;">Líderes Ambientales de Medellín</a> · ',
            '<a href="mailto:' + escapeHtml_(CONTACT_EMAIL) + '" style="color:' + EMAIL_NAVY + ';">' + escapeHtml_(CONTACT_EMAIL) + '</a> · ',
            '<a href="' + escapeHtml_(WHATSAPP_URL) + '" target="_blank" style="color:' + EMAIL_GREEN + ';font-weight:700;">WhatsApp ' + escapeHtml_(CONTACT_PHONE_DISPLAY) + '</a>',
          '</div>',
        '</td></tr>',
      '</table>',
      '</td></tr></table>',
      '</body></html>'
    ].join('');

    const plainBenefits = [
      '1. Plan de Gestión Energética y Reducción de GEI.',
      '2. Plan de Ahorro y Uso Eficiente del Agua.',
      '3. Análisis del consumo y huella de carbono.',
      '4. Predimensionamiento preliminar de una solución de energía solar.',
      '5. Estimación de ahorro, emisiones evitadas y oportunidades de mejora.'
    ];

    const gsvPlain = data.gsvConsent
      ? 'Autorizaste expresamente compartir la información con GSV Ingeniería. El estudio puede escalarse para preparar una propuesta técnico-comercial formal, sujeta a validación técnica, visita, ingeniería de detalle y condiciones vigentes.'
      : 'El predimensionamiento solar es un punto de referencia diseñado por Líderes Ambientales; no es una cotización ni un diseño definitivo. Si deseas escalarlo a GSV Ingeniería, escríbenos y gestionaremos la autorización antes de compartir información.';

    const plainBody = [
      'Cordial saludo ' + data.fullName + ',',
      '',
      'TU ESTUDIO AMBIENTAL YA ESTÁ LISTO',
      'Como continuidad del encuentro de Climate Week Medellín, transformamos la factura enviada en un estudio preliminar para comprender el consumo, la huella de carbono y las oportunidades de ahorro y energía solar.',
      '',
      'BENEFICIOS QUE RECIBES',
      plainBenefits.join('\n'),
      '',
      'Además, Líderes Ambientales de Medellín entrega un Plan de Gestión y Uso Eficiente del Gas. Si el servicio no aparece en la factura, el documento deja trazabilidad de los datos pendientes.',
      '',
      'DOCUMENTOS ADJUNTOS',
      '1. Informe Detallado de Diagnóstico y Plan Inicial de Gestión Energética PGEE-UPME.',
      '2. Plan de Acción de Ahorro de Agua.',
      '3. Plan de Gestión y Uso Eficiente del Gas.',
      '4. Predimensionamiento Solar de Líderes Ambientales.',
      attachedInvoicePlain,
      omittedInvoicePlain,
      driveAccessPlain,
      reductionPlanSheetPlain,
      '',
      buildReductionPlanFormatPlain_(data, expediente.reductionPlanSheetUrl),
      '',
      'LECTURA RÁPIDA',
      'Consumo eléctrico confirmado: ' + (data.consumption ? fmt_(data.consumption, 2) + ' kWh/mes' : 'Pendiente'),
      'Potencia solar de referencia: ' + (data.kwp ? fmt_(data.kwp, 1) + ' kWp' : 'Pendiente'),
      'Generación solar estimada: ' + (data.generationMonthly ? fmt_(data.generationMonthly, 0) + ' kWh/mes' : 'Pendiente'),
      'Ahorro mensual estimado: ' + (data.monthlySaving ? money_(data.monthlySaving) : 'Pendiente'),
      'Emisiones evitadas por solar: ' + (data.solarCo2 ? fmt_(data.solarCo2, 3) + ' t CO2e/año' : 'Pendiente'),
      '',
      'PREDIMENSIONAMIENTO SOLAR',
      gsvPlain,
      'Líderes Ambientales de Medellín: ' + PROJECT_URL,
      'GSV Ingeniería: ' + GSV_URL,
      'Contacto para escalar el proyecto: ' + CONTACT_EMAIL + ' · WhatsApp ' + CONTACT_PHONE_DISPLAY,
      '',
      'IMPORTANTE',
      'Una sola factura permite construir un diagnóstico y escenarios preliminares. Normalizaciones, anualizaciones, metas y estimaciones de ahorro son herramientas de planeación; no constituyen ahorro verificado, auditoría, certificación de seguridad ni cotización definitiva.',
      '',
      'Código del estudio: ' + codeId,
      'Autorización GSV Ingeniería: ' + (data.gsvConsent ? 'Sí.' : 'No; la información no se comparte con GSV Ingeniería.'),
      '',
      'Cordialmente,',
      AUTHOR_NAME,
      'Líderes Ambientales de Medellín',
      PROJECT_URL,
      CONTACT_EMAIL,
      'WhatsApp: ' + CONTACT_PHONE_DISPLAY
    ].join('\n');

    MailApp.sendEmail({
      to: data.email,
      cc: COPY_EMAIL,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'Líderes Ambientales de Medellín',
      replyTo: CONTACT_EMAIL,
      attachments: attachments
    });

    updateStudyRequestStatus_(dbRef, 'Enviado');
    try {
      updateDashboardDelivery_(dashboardRef, data, expediente, 'Enviado · solicitante + copia interna', '');
      dashboardFinalized = true;
    } catch (dashboardUpdateErr) {
      dashboardWarning = 'El registro está en el dashboard, pero no se pudo marcar como enviado: ' +
        (dashboardUpdateErr && dashboardUpdateErr.message ? dashboardUpdateErr.message : dashboardUpdateErr);
      console.error('SiMeCO₂: ' + dashboardWarning);
    }

    invoiceFiles.forEach(function(file) { trashQuietly_(file.getId()); });
    cache.remove('invoice:' + payload.invoiceToken);
    cache.remove('page-session:' + String(payload.pageSessionToken || ''));
    releaseInvoiceProcessing_(payload.invoiceToken);

    return {
      ok: true,
      code: codeId,
      sentTo: data.email,
      copyTo: COPY_EMAIL,
      databaseSaved: true,
      databaseRow: dbRef.row,
      databaseUrl: dbRef.spreadsheetUrl,
      dashboardSaved: true,
      dashboardRow: dashboardRef.row,
      dashboardUrl: dashboardRef.spreadsheetUrl,
      dashboardDeliveryUpdated: dashboardFinalized,
      dashboardWarning: dashboardWarning,
      reports: attachments.map(function(b) { return b.getName(); }),
      invoiceAttachmentsIncluded: attachmentSelection.includedInvoiceNames,
      invoiceAttachmentsOmitted: attachmentSelection.omittedInvoiceNames,
      expedienteAccessGranted: expediente.requesterAccessGranted,
      reductionPlanSheetUrl: expediente.reductionPlanSheetUrl || '',
      economicTraceability: {
        referenceVersion: data.economicReferenceVersion,
        source: data.economicReferenceSource,
        sourceDate: data.economicReferenceSourceDate,
        integratedAt: data.economicReferenceIntegratedAt,
        scope: data.economicReferenceScope,
        priceExtrapolated: !!data.priceExtrapolated,
        financeModelVersion: data.financeModelVersion,
        financeSource: data.financeReferenceSource,
        financeSourceDate: data.financeReferenceSourceDate,
        financeIntegratedAt: data.financeReferenceIntegratedAt,
        financeMethod: data.financeMethod
      },
      detected: {
        energyKwh: data.consumption,
        waterM3: data.waterM3,
        gasM3: data.gasM3,
        institutionName: data.institutionName,
        serviceAddress: data.serviceAddress,
        city: data.city,
        billingPeriod: data.billingPeriod,
        billingDays: getBillingDays_(data),
        analysisConfidence: confidenceLabel_(data),
        requesterType: data.requesterType,
        studentCount: data.studentCount,
        energyKwhPerStudent: data.energyKwhPerStudent,
        offerRecipientName: data.offerRecipientName,
        offerRecipientRole: data.offerRecipientRole,
        notes: data.notes,
        ocrConsumption: data.ocrConsumption,
        ocrTariff: data.ocrTariff,
        consumptionWasCorrected: data.consumptionWasCorrected,
        tariffWasCorrected: data.tariffWasCorrected,
        ocrCity: data.ocrCity,
        cityWasCorrected: data.cityWasCorrected,
        citySource: data.citySource,
        gsvConsent: data.gsvConsent,
        privacyNoticeVersion: data.consentVersion
      }
    };
  } catch (err) {
    try {
      updateStudyRequestStatus_(dbRef, 'Error: ' + truncateText_(err && err.message ? err.message : err, 180));
    } catch (_) {}
    try {
      if (dashboardRef) {
        updateDashboardDelivery_(
          dashboardRef,
          data,
          null,
          'Error de envío',
          truncateText_(err && err.message ? err.message : err, 500)
        );
      }
    } catch (_) {}
    invoiceFiles.forEach(function(file) { trashQuietly_(file.getId()); });
    cache.remove('invoice:' + payload.invoiceToken);
    releaseInvoiceProcessing_(payload.invoiceToken);
    throw err;
  }
}

/* =====================================================================
   EXTRACCION OCR
   ===================================================================== */

function extractInvoiceData_(rawText) {
  const text = normalizeOcrText_(rawText);
  const lines = text.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);

  // Primera opción: reconstruir la fila "Energía [mes] | kWh | Costo ($) |
  // Valor ($)". Así la tarifa procede exactamente de la columna Costo y no
  // de lecturas, promedios, subsidios, mora o totales.
  const billedEnergyRow = extractBilledEnergyRow_(text, lines);
  const energyKwh = billedEnergyRow.consumption || extractEnergyKwh_(text, lines);
  const direct = billedEnergyRow.tariff
    ? {
        value: billedEnergyRow.tariff,
        score: 20,
        source: 'Columna Costo ($) de la fila Energía',
        raw: billedEnergyRow.raw
      }
    : extractEnergyTariffCandidate_(text, lines, energyKwh);
  const energyCharge = billedEnergyRow.charge || extractEnergyCharge_(text, lines, energyKwh, direct.value);

  let calculatedTariff = 0;
  if (energyKwh > 0 && energyCharge > 0) {
    const candidate = round2_(energyCharge / energyKwh);
    if (isPlausibleTariff_(candidate)) calculatedTariff = candidate;
  }

  let energyTariff = 0;
  let tariffMethod = 'none';
  let tariffSource = '';
  let tariffExplanation = '';

  // Prioridad 1: costo unitario de la FILA DE ENERGÍA.
  // Ejemplo EPM: Energía jul-26 | 58 kWh | Costo 902,280 | Valor $52.332,24.
  // El 902,280 es el costo unitario real; 6.300/6.242 son lecturas del medidor.
  if (direct.value && direct.score >= 11) {
    energyTariff = round2_(direct.value);
    tariffMethod = 'unit_cost_energy_row';
    tariffSource = direct.source || 'Costo unitario en la fila de energía';
    tariffExplanation = 'Tarifa obtenida de la factura: costo unitario de energía = ' + fmt_(energyTariff, 2) + ' COP/kWh.';
    if (energyCharge > 0 && energyKwh > 0 && calculatedTariff) {
      const rel = Math.abs(calculatedTariff - energyTariff) / Math.max(energyTariff, 1);
      if (rel <= 0.03) {
        tariffExplanation += ' Validación: ' + money_(energyCharge) + ' ÷ ' + fmt_(energyKwh, 2) + ' kWh = ' + fmt_(calculatedTariff, 2) + ' COP/kWh.';
      }
    }
  } else if (calculatedTariff) {
    // Prioridad 2: valor BRUTO específico de energía ÷ consumo.
    // Nunca se usa el total general de la factura y se evita el total neto
    // de energía cuando contiene subsidios, mora u otros ajustes.
    energyTariff = calculatedTariff;
    tariffMethod = 'gross_energy_charge_div_kwh';
    tariffSource = 'Valor bruto específico de energía ÷ consumo kWh';
    tariffExplanation = 'Calculada desde la factura: ' + money_(energyCharge) + ' ÷ ' + fmt_(energyKwh, 2) + ' kWh = ' + fmt_(energyTariff, 2) + ' COP/kWh.';
  } else if (direct.value) {
    energyTariff = round2_(direct.value);
    tariffMethod = 'direct';
    tariffSource = direct.source || 'Tarifa unitaria leída en factura';
    tariffExplanation = 'Leída directamente de la factura: ' + fmt_(energyTariff, 2) + ' COP/kWh.';
  }

  const waterM3 = extractWaterM3_(text, lines);
  const gasM3 = extractGasM3_(text, lines);
  const waterCharge = extractServiceCharge_(lines, ['acueducto', 'agua'], ['alcantarillado', 'gas'], waterM3);
  const gasCharge = extractServiceCharge_(lines, ['gas natural', 'gas'], ['acueducto', 'agua'], gasM3);
  const totalBill = extractTotalBill_(text, lines);
  const institutionName = extractInstitutionName_(lines);
  const customerName = extractCustomerName_(text, lines);
  const serviceAddress = extractAddress_(text, lines);
  const city = extractCity_(text, lines, serviceAddress);
  const billingPeriod = extractBillingPeriod_(text, lines);
  const billingDates = extractBillingDates_(text, billingPeriod);
  const contractNumber = extractContract_(text, lines);

  let score = 0;
  if (energyKwh) score += 3;
  if (energyTariff) score += 2;
  if (waterM3) score += 1;
  if (gasM3) score += 1;
  if (institutionName || customerName) score += 1;
  if (serviceAddress) score += 1;
  if (city) score += 1;
  if (billingPeriod) score += 1;

  return {
    energyKwh: energyKwh,
    energyTariff: energyTariff,
    energyCharge: energyCharge,
    tariffMethod: tariffMethod,
    tariffSource: tariffSource,
    tariffExplanation: tariffExplanation,
    waterM3: waterM3,
    waterCharge: waterCharge,
    gasM3: gasM3,
    gasCharge: gasCharge,
    totalBill: totalBill,
    institutionName: institutionName,
    customerName: customerName,
    serviceAddress: serviceAddress,
    city: city,
    billingPeriod: billingPeriod,
    billingStart: billingDates.start,
    billingEnd: billingDates.end,
    billingDays: billingDates.days,
    contractNumber: contractNumber,
    confidence: score >= 8 ? 'alta' : score >= 5 ? 'media' : 'baja'
  };
}

function normalizeOcrText_(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[\t\u00A0]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{2,}/g, '\n');
}

function extractBilledEnergyRow_(text, lines) {
  lines = Array.isArray(lines) ? lines : [];
  let best = {consumption: 0, tariff: 0, charge: 0, confidence: 0, raw: ''};

  for (let i = 0; i < lines.length; i++) {
    const current = String(lines[i] || '');
    const low = stripAccents_(current).toLowerCase();
    const isEnergyPeriodRow = /energia\s+[a-z]{3,10}[-\s]\d{2}/.test(low);
    const lookAhead = stripAccents_(lines.slice(i, Math.min(lines.length, i + 12)).join(' ')).toLowerCase();
    const isColumnHeader = /\bkwh\b/.test(low) && /costo/.test(lookAhead) && /valor/.test(lookAhead);
    if (!isEnergyPeriodRow && !isColumnHeader) continue;
    if (isEnergyPeriodRow && /total|subsidio|inter[eé]s|mora|lectura|promedio/.test(low)) continue;

    const rowParts = [current];
    // El OCR puede dejar "Energía may-26" en una línea y las tres columnas
    // numéricas en la siguiente. Solo se agregan líneas hasta encontrar otro
    // concepto de facturación.
    const maxRowLine = isColumnHeader ? i + 12 : i + 4;
    for (let j = i + 1; j < Math.min(lines.length, maxRowLine); j++) {
      const next = String(lines[j] || '');
      const nextLow = stripAccents_(next).toLowerCase();
      if (isEnergyPeriodRow && /^(subsidio|inter[eé]s|mora|total|gas|agua|acueducto|alcantarillado|aseo)\b/.test(nextLow)) break;
      rowParts.push(next);
      const accumulatedNumbers = rowParts.join(' ').replace(/energ[ií]a\s+[a-záéíóúñ]{3,10}[-\s]\d{2}/ig, ' ').match(/\d[\d.,]*/g) || [];
      if (accumulatedNumbers.length >= 3) break;
    }

    const rawRow = rowParts.join(' ');
    const numericArea = rawRow
      .replace(/energ[ií]a\s+[a-záéíóúñ]{3,10}[-\s]\d{2}/i, ' ')
      .replace(/valores?\s+facturados?|kwh\s*x\s*costo\s*\(\$\)|valor\s*\(\$\)/ig, ' ');
    const rawTokens = numericArea.match(/\$?\s*\d[\d.,]*/g) || [];
    const tokens = rawTokens.map(function(token) {
      return {
        raw: token,
        values: parseEnergyNumberVariants_(token)
      };
    });

    // Buscar el trío ordenado kWh -> Costo ($/kWh) -> Valor ($) y comprobar
    // matemáticamente que kWh × costo coincide con el valor facturado.
    for (let a = 0; a < tokens.length - 2; a++) {
      for (let b = a + 1; b < tokens.length - 1; b++) {
        for (let c = b + 1; c < tokens.length; c++) {
          tokens[a].values.forEach(function(consumption) {
            tokens[b].values.forEach(function(tariff) {
              tokens[c].values.forEach(function(charge) {
                if (!(consumption > 0 && consumption < 10000000)) return;
                if (!isPlausibleTariff_(tariff)) return;
                if (!(charge >= 1000 && charge < 10000000000)) return;
                const expected = consumption * tariff;
                const relativeError = Math.abs(expected - charge) / Math.max(charge, 1);
                if (relativeError > 0.08) return;
                const confidence = 100 - relativeError * 100 + (a === 0 && b === 1 && c === 2 ? 5 : 0);
                if (confidence > best.confidence) {
                  best = {
                    consumption: Math.round(consumption * 1000) / 1000,
                    tariff: round2_(tariff),
                    charge: round2_(charge),
                    confidence: confidence,
                    raw: rawRow
                  };
                }
              });
            });
          });
        }
      }
    }
  }
  return best;
}

function parseEnergyNumberVariants_(value) {
  const raw = String(value || '').replace(/[^0-9.,-]/g, '');
  if (!raw) return [];
  const values = [parseLocalizedNumber_(raw)];

  // En la fila de energía EPM, "353.583" representa 353,583 kWh, mientras
  // que en un valor monetario puede representar 353.583 COP. Se mantienen las
  // dos interpretaciones y la ecuación kWh × costo = valor decide la correcta.
  if (/^\d{1,6}\.\d{3}$/.test(raw)) values.push(Number(raw));
  if (/^\d{1,6},\d{3}$/.test(raw)) values.push(Number(raw.replace(',', '.')));

  return values.filter(function(n, index, arr) {
    return isFinite(n) && n > 0 && arr.indexOf(n) === index;
  });
}

function extractEnergyKwh_(text, lines) {
  const patterns = [
    // Fila de consumo de prestadores como EPM: "Energía jul-26 58 902,280 $52.332,24".
    /energ[ií]a\s+[a-záéíóú]{3,10}[-\s]\d{2}\s+(\d[\d.,]*)\b/i,
    /(?:consumo(?:\s+de)?\s+(?:energ[ií]a|electricidad)|energ[ií]a\s+activa|consumo\s+activo|consumo\s+actual)[^\d]{0,80}(\d[\d.,]*)\s*kwh/i,
    /(?:consumo|lectura)[^\n]{0,100}?(\d[\d.,]*)\s*kwh/i,
    /(\d[\d.,]*)\s*kwh\b/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    const n = m ? parseLocalizedNumber_(m[1]) : 0;
    if (n > 0 && n < 10000000) return n;
  }
  return bestNumberNearUnit_(lines, ['energia', 'energía', 'electricidad'], 'kwh', 10000000);
}

function isPlausibleTariff_(n) {
  n = finiteOrZero_(n);
  return n >= TARIFF_MIN_COP_KWH && n <= TARIFF_MAX_COP_KWH;
}

function round2_(n) {
  return Math.round(finiteOrZero_(n) * 100) / 100;
}

function extractEnergyTariff_(text, lines) {
  return extractEnergyTariffCandidate_(text, lines).value || 0;
}

function extractEnergyTariffCandidate_(text, lines, energyKwh) {
  const candidates = [];

  function add(value, score, source, raw) {
    const n = parseLocalizedNumber_(value);
    if (!isPlausibleTariff_(n)) return;
    candidates.push({value: n, score: score, source: source, raw: raw || ''});
  }

  // 1) Unidad explícita COP/kWh o $/kWh.
  let re = /(?:\$|cop\s*)?\s*(\d[\d.,]*)\s*(?:cop\s*)?(?:\/\s*kwh|por\s*kwh|cop\s*\/\s*kwh)/ig;
  let m;
  while ((m = re.exec(text)) !== null) add(m[1], 13, 'Tarifa explícita COP/kWh', m[0]);

  // 1.5) OCR de tablas por columnas. Google Drive puede devolver primero el
  // encabezado "kWh x Costo ($) Valor ($)" y luego ubicar 353.583, 864,06 y
  // $305.516,93 en líneas distintas. Se examina una ventana controlada alrededor
  // de "Costo" y se prioriza el número tarifario plausible, descartando consumo,
  // lecturas, años, totales y valores monetarios grandes.
  for (let i = 0; i < lines.length; i++) {
    const headerLow = stripAccents_(lines[i]).toLowerCase();
    if (headerLow.indexOf('costo') < 0) continue;
    const from = Math.max(0, i - 2);
    const to = Math.min(lines.length, i + 11);
    const windowText = lines.slice(from, to).join(' ');
    const windowLow = stripAccents_(windowText).toLowerCase();
    if (windowLow.indexOf('energia') < 0 && windowLow.indexOf('kwh') < 0) continue;

    const cleanedWindow = windowText
      .replace(/energ[ií]a\s+[a-záéíóúñ]{3,10}[-\s]\d{2}/ig, ' ')
      .replace(/periodo[^\n]{0,30}\d{1,2}\s+(?:abr|may|jun|jul|ago|sep|oct|nov|dic|ene|feb|mar)[^\n]{0,30}/ig, ' ');
    const numericTokens = cleanedWindow.match(/\$?\s*\d[\d.,]*/g) || [];
    numericTokens.forEach(function(token) {
      parseEnergyNumberVariants_(token).forEach(function(n) {
        if (!isPlausibleTariff_(n)) return;
        if (energyKwh && Math.abs(n - energyKwh) < 0.01) return;
        if (n >= 2000 && n <= 2100) return;
        candidates.push({
          value: n,
          score: 17,
          source: 'Columna Costo ($) del cuadro Valores Facturados de Energía',
          raw: windowText
        });
      });
    });
  }

  // 2) Fila real de energía. Fuente preferida para facturas como EPM:
  //    Energía jul-26   58   902,280   $ 52.332,24
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const low = stripAccents_(raw).toLowerCase();

    if (low.indexOf('energia') < 0 && low.indexOf('electric') < 0) continue;
    if (/lectura\s+actual|lectura\s+anterior|constante|niu|circuito|transform/.test(low)) continue;
    if (/total\s+(?:de\s+)?energia/.test(low)) continue;

    const neighborhood = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(' ');
    const nlow = stripAccents_(neighborhood).toLowerCase();

    if (/costo\s+unitario|valor\s+unitario|precio\s+unitario|cargo\s+unitario/.test(nlow)) {
      const nums = extractNumbers_(raw);
      nums.forEach(function(n) {
        if (isPlausibleTariff_(n)) candidates.push({value:n, score:12, source:'Costo/valor unitario de energía', raw:raw});
      });
    }

    const tableContext = /kwh/.test(nlow) && /costo|valor/.test(nlow);
    if (tableContext || /energia\s+[a-z]{3}[-\s]\d{2}/.test(low)) {
      const tokens = String(raw).match(/-?\d[\d.,]*/g) || [];
      tokens.forEach(function(tok) {
        const n = parseLocalizedNumber_(tok);
        if (!isPlausibleTariff_(n)) return;
        if (energyKwh && Math.abs(n - energyKwh) < 0.01) return;
        if (n >= 2000 && n <= 2100) return;
        candidates.push({
          value:n,
          score:12,
          source:'Costo unitario en la fila de energía',
          raw:raw
        });
      });
    }

    // "Tarifa" por sí sola puede ser código/estrato. Solo con contexto fuerte.
    if (low.indexOf('tarifa') >= 0 && (nlow.indexOf('kwh') >= 0 || nlow.indexOf('energia') >= 0)) {
      const nums = extractNumbers_(raw);
      nums.forEach(function(n) {
        if (isPlausibleTariff_(n)) candidates.push({value:n, score:8, source:'Tarifa de energía', raw:raw});
      });
    }
  }

  if (!candidates.length) return {value:0, score:0, source:'', raw:''};
  candidates.sort(function(a,b){
    if (b.score !== a.score) return b.score - a.score;
    return Math.abs(a.value - 900) - Math.abs(b.value - 900);
  });
  return candidates[0];
}

function extractEnergyCharge_(text, lines, energyKwh, directTariff) {
  if (!energyKwh) return 0;

  const excluded = ['agua', 'acueducto', 'alcantarillado', 'gas', 'aseo', 'alumbrado publico', 'alumbrado público', 'financiacion', 'financiación', 'impuesto', 'saldo anterior', 'total a pagar'];
  const candidates = [];

  function addCandidate(n, score, raw) {
    n = parseMoneyNumber_(String(n));
    if (!(n >= 1000 && n < 10000000000)) return;
    const implied = n / energyKwh;
    if (!isPlausibleTariff_(implied)) return;
    if (directTariff && isPlausibleTariff_(directTariff)) {
      const rel = Math.abs(implied - directTariff) / Math.max(directTariff, 1);
      if (rel <= .03) score += 7;
      else if (rel <= .20) score += 2;
      else if (rel > .60) score -= 3;
    }
    candidates.push({value:n, score:score, implied:implied, raw:raw || ''});
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const low = stripAccents_(raw).toLowerCase();
    const isEnergy = low.indexOf('energia') >= 0 || low.indexOf('electric') >= 0 || low.indexOf('kwh') >= 0;
    if (!isEnergy) continue;
    if (excluded.some(function(w) { return low.indexOf(stripAccents_(w).toLowerCase()) >= 0; })) continue;

    let score = 2;
    if (/subtotal\s+(?:de\s+)?energia|valor\s+(?:de\s+)?energia|cargo\s+(?:de\s+)?energia|consumo\s+(?:de\s+)?energia/.test(low)) score += 7;
    if (/valor|subtotal|cargo|consumo/.test(low)) score += 3;
    if (low.indexOf('kwh') >= 0) score += 2;
    if (/unitario|tarifa|precio\s+unitario/.test(low)) score -= 5;
    // "Total Energía" suele incluir subsidios/intereses. Es útil como dato neto,
    // pero NO como base preferida para obtener COP/kWh.
    if (/total\s+(?:de\s+)?energia/.test(low)) score -= 7;

    // Primero leer importes de la MISMA línea de energía. No usamos el
    // vecindario completo porque podría contener el "Total a pagar" de la
    // factura y producir una tarifa falsa.
    const moneyMatches = raw.match(/\$\s*[\d.,]+/g) || [];
    moneyMatches.forEach(function(mm) { addCandidate(mm.replace('$','').trim(), score + 3, raw); });

    // Si la etiqueta económica está en una línea y el importe en la línea
    // siguiente, aceptar esa línea siguiente solo si no pertenece a otro
    // servicio ni contiene un total general.
    if (!moneyMatches.length && /valor|subtotal|cargo|total\s+(?:de\s+)?energia/.test(low) && lines[i + 1]) {
      const nextRaw = lines[i + 1];
      const nextLow = stripAccents_(nextRaw).toLowerCase();
      const nextExcluded = excluded.some(function(w) { return nextLow.indexOf(stripAccents_(w).toLowerCase()) >= 0; });
      if (!nextExcluded) {
        const nextMoney = nextRaw.match(/\$\s*[\d.,]+/g) || [];
        nextMoney.forEach(function(mm) { addCandidate(mm.replace('$','').trim(), score + 1, raw + ' | ' + nextRaw); });
      }
    }

    // Algunas facturas OCR pierden el símbolo $. Solo usar números grandes
    // cuando la línea tiene una etiqueta económica fuerte.
    if (/valor|subtotal|cargo|total\s+(?:de\s+)?energia/.test(low)) {
      const rawNums = String(raw).match(/\d[\d.,]*/g) || [];
      rawNums.forEach(function(v) {
        const n = parseMoneyNumber_(v);
        if (Math.abs(n - energyKwh) > 1) addCandidate(v, score, raw);
      });
    }
  }

  if (!candidates.length) return 0;
  candidates.sort(function(a,b){
    if (b.score !== a.score) return b.score - a.score;
    // En empate, preferir el importe cuyo cociente sea más cercano a una tarifa
    // directa válida; si no existe, preferir el mayor subtotal energético.
    if (directTariff && isPlausibleTariff_(directTariff)) {
      return Math.abs(a.implied-directTariff) - Math.abs(b.implied-directTariff);
    }
    return b.value - a.value;
  });
  return candidates[0].value;
}

function extractWaterM3_(text, lines) {
  const patterns = [
    /(?:acueducto|agua)[^\n]{0,160}?(?:consumo|cons\.?)?[^\d]{0,50}?(\d[\d.,]*)\s*m(?:3|³)/i,
    /(?:consumo\s+de\s+agua)[^\d]{0,60}(\d[\d.,]*)\s*m(?:3|³)/i,
    /(\d[\d.,]*)\s*m(?:3|³)[^\n]{0,80}(?:acueducto|agua)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    const n = m ? parseLocalizedNumber_(m[1]) : 0;
    if (n > 0 && n < 1000000) return n;
  }

  return bestServiceM3_(lines, ['acueducto', 'agua'], ['gas', 'alcantarillado']);
}

function extractGasM3_(text, lines) {
  const patterns = [
    /(?:gas\s+natural|servicio\s+de\s+gas|gas)[^\n]{0,160}?(?:consumo|cons\.?)?[^\d]{0,50}?(\d[\d.,]*)\s*m(?:3|³)/i,
    /(?:consumo\s+de\s+gas)[^\d]{0,60}(\d[\d.,]*)\s*m(?:3|³)/i,
    /(\d[\d.,]*)\s*m(?:3|³)[^\n]{0,80}(?:gas\s+natural|gas)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    const n = m ? parseGasVolume_(m[1]) : 0;
    if (n > 0 && n < 1000000) return n;
  }

  return bestServiceM3_(lines, ['gas', 'gas natural'], ['agua', 'acueducto', 'alcantarillado'], true);
}

/**
 * Extrae únicamente un subtotal atribuible al servicio. Nunca usa el total
 * general de la factura. Si la evidencia es ambigua devuelve cero para que el
 * informe muestre el costo unitario como pendiente de confirmación.
 */
function extractServiceCharge_(lines, includeWords, excludeWords, volume) {
  const base = finiteOrZero_(volume);
  if (!base) return 0;
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = String(lines[i] || '');
    const low = stripAccents_(raw).toLowerCase();
    const included = includeWords.some(function(w) { return low.indexOf(stripAccents_(w).toLowerCase()) >= 0; });
    const excluded = excludeWords.some(function(w) { return low.indexOf(stripAccents_(w).toLowerCase()) >= 0; });
    if (!included || excluded || /total\s+(?:a\s+)?pagar|saldo\s+anterior|mora|financiaci/.test(low)) continue;

    const neighborhood = lines.slice(i, Math.min(lines.length, i + 2)).join(' ');
    const moneyTokens = neighborhood.match(/\$\s*\d[\d.,]*/g) || [];
    moneyTokens.forEach(function(token) {
      const value = parseMoneyNumber_(token.replace('$', ''));
      const unitCost = value / base;
      if (value > 0 && unitCost >= 50 && unitCost <= 100000) {
        candidates.push({value: value, score: (/(?:valor|cargo|consumo|servicio|subtotal)/i.test(neighborhood) ? 3 : 0) + (i === 0 ? 0 : 1)});
      }
    });
  }
  if (!candidates.length) return 0;
  candidates.sort(function(a, b) { return b.score - a.score || b.value - a.value; });
  return candidates[0].score >= 3 ? candidates[0].value : 0;
}

function bestNumberNearUnit_(lines, serviceWords, unit, max) {
  for (let i = 0; i < lines.length; i++) {
    const low = stripAccents_(lines[i]).toLowerCase();
    const hasService = serviceWords.some(function(w) { return low.indexOf(stripAccents_(w).toLowerCase()) >= 0; });
    if (!hasService && low.indexOf(unit) < 0) continue;
    const neighborhood = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(' ');
    const re = new RegExp('(\\d[\\d.,]*)\\s*' + unit, 'i');
    const m = neighborhood.match(re);
    const n = m ? parseLocalizedNumber_(m[1]) : 0;
    if (n > 0 && n < max) return n;
  }
  return 0;
}

function bestServiceM3_(lines, includeWords, excludeWords, gasMode) {
  for (let i = 0; i < lines.length; i++) {
    const low = stripAccents_(lines[i]).toLowerCase();
    const included = includeWords.some(function(w) { return low.indexOf(stripAccents_(w).toLowerCase()) >= 0; });
    const excluded = excludeWords.some(function(w) { return low.indexOf(stripAccents_(w).toLowerCase()) >= 0; });
    if (!included || excluded) continue;

    const neighborhood = lines.slice(i, Math.min(lines.length, i + 3)).join(' ');
    const m = neighborhood.match(/(\d[\d.,]*)\s*m(?:3|³)/i);
    const n = m ? (gasMode ? parseGasVolume_(m[1]) : parseLocalizedNumber_(m[1])) : 0;
    if (n > 0 && n < 1000000) return n;
  }
  return 0;
}

function extractTotalBill_(text, lines) {
  // Buscar primero alrededor de la etiqueta exacta. En PDFs multicolumna el
  // texto puede colocar el importe una línea antes o después de "Total a pagar".
  let bestNearLabel = 0;
  for (let i = 0; i < lines.length; i++) {
    const low = stripAccents_(lines[i]).toLowerCase();
    if (low.indexOf('total a pagar') < 0 && low.indexOf('valor total a pagar') < 0 && low.indexOf('valor a pagar') < 0) continue;

    const from = Math.max(0, i - 2);
    const to = Math.min(lines.length, i + 4);
    for (let j = from; j < to; j++) {
      const moneyMatches = String(lines[j]).match(/\$\s*[\d.,]+/g) || [];
      moneyMatches.forEach(function(mm) {
        const n = parseMoneyNumber_(mm.replace('$','').trim());
        if (n >= 1000 && n < 10000000000 && n > bestNearLabel) bestNearLabel = n;
      });
    }
  }
  if (bestNearLabel) return bestNearLabel;

  const patterns = [
    /\$\s*([\d.,]+)[^\n]{0,80}(?:valor\s+total\s+a\s+pagar|total\s+a\s+pagar)/i,
    /(?:total\s+a\s+pagar|valor\s+a\s+pagar|total\s+factura)[^\n]{0,80}\$\s*([\d.,]+)/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = String(text || '').match(patterns[i]);
    const n = m ? parseMoneyNumber_(m[1]) : 0;
    if (n > 0 && n < 10000000000) return n;
  }
  return 0;
}

function extractInstitutionName_(lines) {
  const needles = ['institucion educativa', 'institución educativa', 'colegio', 'universidad', 'corporacion educativa', 'corporación educativa'];
  for (let i = 0; i < lines.length; i++) {
    const low = stripAccents_(lines[i]).toLowerCase();
    if (needles.some(function(n) { return low.indexOf(stripAccents_(n).toLowerCase()) >= 0; })) {
      const cleaned = lines[i].replace(/^(cliente|suscriptor|nombre)\s*[:\-]?\s*/i, '').trim();
      if (cleaned.length >= 5 && cleaned.length <= 150) return cleaned;
    }
  }
  return '';
}

function extractCustomerName_(text, lines) {
  // Preferir etiqueta exacta "Cliente:" y cortar mensajes de cartera/estado.
  const direct = String(text || '').match(/(?:^|\n)\s*cliente\s*:\s*([^\n]{3,140})/i);
  if (direct) {
    const cleaned = cleanCustomerCandidate_(direct[1]);
    if (cleaned) return cleaned;
  }

  const labels = ['cliente', 'suscriptor', 'nombre del cliente', 'titular'];
  for (let i = 0; i < lines.length; i++) {
    const low = stripAccents_(lines[i]).toLowerCase();
    for (let j = 0; j < labels.length; j++) {
      const label = stripAccents_(labels[j]).toLowerCase();
      if (low.indexOf(label) >= 0) {
        const idx = low.indexOf(label);
        const originalAfter = lines[i].substring(idx + labels[j].length).replace(/^\s*[:\-]?\s*/, '');
        const cleaned = cleanCustomerCandidate_(originalAfter);
        if (cleaned) return cleaned;
        if (lines[i + 1]) {
          const next = cleanCustomerCandidate_(lines[i + 1]);
          if (next) return next;
        }
      }
    }
  }
  return '';
}

function cleanCustomerCandidate_(s) {
  let t = cleanText_(s);
  t = t.replace(/^\d{6,20}\s+/, '');
  t = t.split(/\b(?:tienes\s+servicios|cc\/nit|nit|direcci[oó]n|contrato|ciclo|estrato|municipio)\b/i)[0];
  t = t.replace(/\s{2,}/g, ' ').trim().replace(/[·|;-]+$/g, '').trim();
  if (t.length < 3 || t.length > 120 || /^\d+$/.test(t)) return '';
  return t;
}

function extractAddress_(text, lines) {
  const txt = String(text || '');
  const patterns = [
    /direcci[oó]n\s+prestaci[oó]n\s+servicio\s*:\s*([^\n]{6,180})/i,
    /direcci[oó]n\s+de\s+cobro\s*:\s*([^\n]{6,180})/i,
    /direcci[oó]n\s+(?:del\s+)?servicio\s*:\s*([^\n]{6,180})/i,
    /dir\.\s*servicio\s*:\s*([^\n]{6,180})/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = txt.match(patterns[i]);
    if (m) {
      const candidate = cleanAddressCandidate_(m[1]);
      if (looksLikeAddress_(candidate)) return candidate;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const low = stripAccents_(lines[i]).toLowerCase();
    if (low.indexOf('direccion') >= 0 || low.indexOf('dir. servicio') >= 0) {
      const after = lines[i].split(/:/).slice(1).join(':').trim();
      const cleaned = cleanAddressCandidate_(after);
      if (looksLikeAddress_(cleaned)) return cleaned;
      if (lines[i + 1]) {
        const next = cleanAddressCandidate_(lines[i + 1]);
        if (looksLikeAddress_(next)) return next;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const cleaned = cleanAddressCandidate_(lines[i]);
    if (looksLikeAddress_(cleaned)) return cleaned;
  }
  return '';
}

function cleanAddressCandidate_(s) {
  let t = cleanText_(s);
  t = t.split(/\b(?:municipio|hist[oó]rico|producto|categor[ií]a|medidor|plan|estrato|ciclo|frecuencias|periodo)\b/i)[0];
  t = t.replace(/\s+-\s+(?:medell[ií]n|antioquia).*$/i, '');
  t = t.replace(/\s{2,}/g, ' ').trim().replace(/[·|;-]+$/g, '').trim();
  return t;
}

function looksLikeAddress_(s) {
  const t = stripAccents_(String(s || '')).toUpperCase();
  if (t.length < 6 || t.length > 160) return false;
  return /\b(CL|CALLE|CR|CRA|CARRERA|DG|DIAGONAL|TV|TRANSVERSAL|AV|AVENIDA|KM)\b/.test(t) && /\d/.test(t);
}

function extractCity_(text, lines, serviceAddress) {
  const txt = String(text || '');
  const labeledPatterns = [
    /(?:^|\n)\s*(?:municipio|ciudad|localidad)\s*(?:de\s+prestaci[oó]n)?\s*[:\-]?\s*([^\n]{3,80})/i,
    /(?:municipio|ciudad)\s*[:\-]\s*([^\n]{3,80})/i
  ];
  for (let i = 0; i < labeledPatterns.length; i++) {
    const match = txt.match(labeledPatterns[i]);
    const candidate = match ? cleanCityCandidate_(match[1]) : '';
    if (candidate) return candidate;
  }

  // Respaldo para facturas en las que el municipio aparece en la dirección o
  // como texto independiente, sin una etiqueta reconocible por el OCR.
  const knownCities = [
    'Medellín','Bello','Envigado','Itagüí','Sabaneta','La Estrella','Caldas',
    'Copacabana','Girardota','Barbosa','Rionegro','Marinilla','Guarne','Apartadó',
    'Turbo','Caucasia','Bogotá','Cali','Barranquilla','Cartagena','Bucaramanga',
    'Pereira','Manizales','Armenia'
  ];
  const haystack = stripAccents_(txt + '\n' + String(serviceAddress || '')).toLowerCase();
  for (let i = 0; i < knownCities.length; i++) {
    const cityKey = stripAccents_(knownCities[i]).toLowerCase();
    const escaped = cityKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('(?:^|[^a-z])' + escaped + '(?:$|[^a-z])', 'i').test(haystack)) return knownCities[i];
  }
  return '';
}

function cleanCityCandidate_(value) {
  let city = cleanText_(value)
    .split(/\b(?:hist[oó]rico|departamento|direcci[oó]n|contrato|ciclo|estrato|producto|categor[ií]a|periodo|factura)\b/i)[0]
    .replace(/^[\s:;,.\-]+|[\s:;,.\-|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!city || city.length < 3 || city.length > 50 || /\d/.test(city)) return '';
  if (/^(antioquia|colombia|epm|empresa|cliente|servicio)$/i.test(stripAccents_(city))) return '';
  return city.toLowerCase().replace(/(^|\s)([a-záéíóúñ])/g, function(_, space, letter) {
    return space + letter.toUpperCase();
  });
}

function extractBillingPeriod_(text, lines) {
  const direct = text.match(/(?:periodo|per[ií]odo|facturaci[oó]n)[^\n]{0,60}((?:20\d{2})[-\/]?(?:0?[1-9]|1[0-2]))/i);
  if (direct) return normalizePeriod_(direct[1]);

  const months = {
    enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06', julio:'07', agosto:'08', septiembre:'09', setiembre:'09', octubre:'10', noviembre:'11', diciembre:'12'
  };
  const m = stripAccents_(text).toLowerCase().match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(20\d{2})\b/);
  if (m) return m[2] + '-' + months[m[1]];

  const date = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (date) return date[3] + '-' + ('0' + date[2]).slice(-2);
  return '';
}

function extractBillingDates_(text, billingPeriod) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  const dateToken = '(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-](?:20)?\\d{2})';
  const patterns = [
    new RegExp('(?:desde|lectura\\s+anterior|periodo\\s+desde)[^0-9]{0,25}' + dateToken + '[^0-9]{0,45}(?:hasta|lectura\\s+actual|a)[^0-9]{0,25}' + dateToken, 'i'),
    new RegExp(dateToken + '\\s*(?:a|hasta|-)\\s*' + dateToken, 'i')
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = normalized.match(patterns[i]);
    if (!m) continue;
    const start = parseInvoiceDate_(m[1]);
    const end = parseInvoiceDate_(m[2]);
    if (!start || !end) continue;
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (days >= 15 && days <= 60) {
      return {
        start: Utilities.formatDate(start, 'UTC', 'yyyy-MM-dd'),
        end: Utilities.formatDate(end, 'UTC', 'yyyy-MM-dd'),
        days: days
      };
    }
  }
  return {start: '', end: '', days: billingDaysFromPeriod_(billingPeriod)};
}

function parseInvoiceDate_(value) {
  const m = String(value || '').match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|20\d{2})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const month = Number(m[2]);
  const day = Number(m[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function billingDaysFromPeriod_(period) {
  const m = String(period || '').match(/^(20\d{2})-(\d{2})$/);
  if (!m) return Math.round(STANDARD_MONTH_DAYS);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
}

function extractContract_(text, lines) {
  const m = text.match(/(?:contrato|n[uú]mero\s+de\s+contrato|suscripci[oó]n)[^\d]{0,30}(\d{4,20})/i);
  return m ? m[1] : '';
}

function normalizePeriod_(s) {
  const t = String(s || '').replace('/', '-');
  const m = t.match(/^(20\d{2})-?(\d{1,2})$/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : t;
}

function extractNumbers_(s) {
  const matches = String(s || '').match(/\d[\d.,]*/g) || [];
  return matches.map(parseLocalizedNumber_).filter(function(n) { return isFinite(n); });
}

function parseLocalizedNumber_(value) {
  let s = String(value || '').trim().replace(/[^0-9.,-]/g, '');
  if (!s) return 0;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const digitsAfter = s.length - lastComma - 1;
    if (digitsAfter <= 3) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const digitsAfter = s.length - lastDot - 1;
    // 3 dígitos finales suele ser separador de miles en facturas colombianas.
    if (digitsAfter === 3 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function parseGasVolume_(value) {
  let s = String(value || '').trim().replace(/[^0-9.,-]/g, '');
  if (!s) return 0;

  // Gas residencial suele facturarse con tres decimales: 5,758 m³.
  // Si el OCR cambia la coma por punto (5.758), también se interpreta como
  // decimal cuando la parte entera es pequeña. Esto evita convertir 5,758
  // erróneamente en 5.758 m³ -> 5.758 (cinco mil setecientos cincuenta y ocho).
  const m = s.match(/^(-?\d{1,2})[.,](\d{3})$/);
  if (m) {
    const n = Number(m[1] + '.' + m[2]);
    return isFinite(n) ? n : 0;
  }
  return parseLocalizedNumber_(s);
}

function parseMoneyNumber_(value) {
  const s = String(value || '').trim();
  // En COP, puntos suelen ser miles. Si solo hay puntos, quitar puntos.
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, '')) || 0;
  return parseLocalizedNumber_(s);
}

function stripAccents_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* =====================================================================
   PLAN 1 · GESTIÓN ENERGÉTICA Y REDUCCIÓN DE GEI
   Estructura alineada con el PDF de referencia SiMeCO₂.
   ===================================================================== */

function buildEnergyManagementPdf_(d, codeId) {
  const doc = DocumentApp.create('Plan_Gestion_Energetica_' + safeName_(d.institutionName));
  const body = doc.getBody();
  setupBody_(body);

  addBrandHeader_(body, 'Informe Detallado de Diagnóstico y Plan Inicial de Gestión Energética', 'Metodología SiMeCO₂ complementada con lineamientos PGEE-UPME', BRAND_GREEN);
  addIdentityBlock_(body, d, codeId, 'SiMeCO₂ · Informe detallado PGEE-UPME', energyPriority_(d.consumption), BRAND_GREEN, LIGHT_GREEN);

  const observed = finiteOrZero_(d.consumption); // valor final confirmado
  const days = getBillingDays_(d);
  const daily = observed ? observed / days : 0;
  const monthly = daily * STANDARD_MONTH_DAYS;
  const annual = daily * 365;
  const annualCo2Kg = annual * ELECTRIC_FACTOR_KG_CO2_KWH;
  const observedCo2Kg = observed * ELECTRIC_FACTOR_KG_CO2_KWH;
  const unitCost = finiteOrZero_(d.tariff);

  addReportStatus_(body, d, 'ENERGÍA', 'Diagnóstico preliminar / plan inicial', BRAND_GREEN, LIGHT_GREEN);
  addSection_(body, 'Resumen ejecutivo', BRAND_GREEN);
  addMetricTable_(body, [
    ['Consumo final · confirmado', observed ? fmt_(observed, 2) + ' kWh en ' + days + ' días' : 'No identificado'],
    ['Intensidad diaria · calculada', daily ? fmt_(daily, 2) + ' kWh/día' : 'Sin dato'],
    ['Mes equivalente · proyectado', monthly ? fmt_(monthly, 2) + ' kWh/30,44 días' : 'Sin dato'],
    ['Número de estudiantes', d.studentCount ? fmt_(d.studentCount, 0) : (d.isEducationalRequester ? 'No reportado' : 'No aplica')],
    ['Indicador educativo', d.energyKwhPerStudent ? fmt_(d.energyKwhPerStudent, 3) + ' kWh/mes por estudiante' : (d.isEducationalRequester ? 'Pendiente' : 'No aplica')],
    ['Proyección anual · escenario base', annual ? fmt_(annual, 2) + ' kWh/año' : 'Sin dato'],
    ['Costo unitario de energía', unitCost ? money_(unitCost) + '/kWh' : 'Pendiente de confirmación'],
    ['CO₂e anualizado · calculado', annual ? fmt_(annualCo2Kg / 1000, 3) + ' t CO₂e/año' : 'Sin dato'],
    ['Prioridad provisional', energyPriority_(monthly)],
    ['Nivel de confianza', confidenceLabel_(d)]
  ], BRAND_GREEN, LIGHT_GREEN);
  addCallout_(body, 'Conclusión ejecutiva: ' + energyTechnicalReading_(monthly) + ' La clasificación es provisional y deberá recalibrarse con al menos 12 meses de facturas y un inventario de cargas.', LIGHT_LIME, '#365314');
  addEnergyDecisionBrief_(body, d, {
    observed: observed,
    days: days,
    daily: daily,
    monthly: monthly,
    annual: annual,
    unitCost: unitCost,
    annualCo2Kg: annualCo2Kg
  }, BRAND_GREEN);
  addPgeeAlignment_(body, BRAND_GREEN);
  addUpmeMethodRoute_(body, BRAND_GREEN);

  addReportPage_(body, '1. Alcance, evidencia y metodología', BRAND_GREEN);
  addDataTraceability_(body, d, [
    ['Consumo detectado por OCR', d.ocrConsumption ? fmt_(d.ocrConsumption, 2) + ' kWh' : 'No identificado', 'Lectura automática de la factura'],
    ['Consumo final confirmado', observed ? fmt_(observed, 2) + ' kWh' : 'Pendiente', d.consumptionSource || 'Confirmación del usuario'],
    ['Días del periodo', String(days), d.billingStart && d.billingEnd ? 'Calculado con fechas observadas' : 'Calculado desde el mes facturado'],
    ['Tarifa detectada por OCR', d.ocrTariff ? fmt_(d.ocrTariff, 2) + ' COP/kWh' : 'No identificada', d.ocrTariff ? (d.tariffExplanation || 'Lectura automática de la factura') : 'Pendiente'],
    ['Tarifa final confirmada', unitCost ? fmt_(unitCost, 2) + ' COP/kWh' : 'Pendiente', unitCost ? (d.tariffFinalSource || 'Confirmación del usuario') : 'No se usa Total factura ÷ kWh'],
    ['Factor de emisión', fmt_(ELECTRIC_FACTOR_KG_CO2_KWH, 3) + ' kg CO₂e/kWh', 'Parámetro metodológico'],
    ['Proyecciones', '30,44 días y 365 días', 'Calculadas; no son consumos medidos']
  ], BRAND_GREEN);
  addCallout_(body, 'Regla de integridad económica: el OCR propone consumo y tarifa; la persona solicitante los revisa y confirma. Los cálculos del estudio utilizan siempre los valores finales confirmados. El total general de la factura nunca se usa para inferir la tarifa.', LIGHT_GREEN, BRAND_GREEN);
  addPgeeEvidenceLevel_(body, d, BRAND_GREEN);
  addLimitations_(body, 'energía', [
    'No representa estacionalidad, calendario escolar, vacaciones ni cambios de ocupación.',
    'No permite demostrar ahorros ni detectar cargas anómalas por sí sola.',
    'No sustituye auditoría energética, medición por circuitos ni diseño eléctrico o solar.'
  ]);

  addReportPage_(body, '2. Línea base normalizada e indicadores', BRAND_GREEN);
  const baseline = body.appendTable([
    ['Indicador', 'Resultado', 'Naturaleza', 'Uso recomendado'],
    ['Consumo confirmado', observed ? fmt_(observed, 2) + ' kWh' : '—', 'Dato confirmado', 'Soporte del periodo'],
    ['Estudiantes reportados', d.studentCount ? fmt_(d.studentCount, 0) : 'No reportado', d.isEducationalRequester ? (d.studentCount ? 'Dato confirmado' : 'Dato opcional no diligenciado') : 'No aplica', 'Comparación entre sedes educativas'],
    ['kWh/mes por estudiante', d.energyKwhPerStudent ? fmt_(d.energyKwhPerStudent, 3) : '—', 'Cálculo', 'Indicador para comparar instituciones'],
    ['Consumo diario', daily ? fmt_(daily, 2) + ' kWh/día' : '—', 'Cálculo', 'Comparar periodos de distinta duración'],
    ['Mes equivalente', monthly ? fmt_(monthly, 2) + ' kWh/mes' : '—', 'Proyección', 'Planeación preliminar'],
    ['Anualización', annual ? fmt_(annual, 2) + ' kWh/año' : '—', 'Proyección', 'Escenarios; no inventario verificado'],
    ['Costo diario de energía', unitCost && daily ? money_(daily * unitCost) + '/día' : 'Pendiente', 'Cálculo', 'Orden de magnitud'],
    ['CO₂e del periodo', observed ? fmt_(observedCo2Kg, 2) + ' kg' : '—', 'Cálculo', 'Huella alcance 2 preliminar'],
    ['Árboles equivalentes/año', annual ? fmt_(annualCo2Kg / TREE_CAPTURE_KG_YEAR, 0) : '—', 'Equivalencia pedagógica', 'Comunicación; no compensación certificada']
  ]);
  styleTable_(baseline, BRAND_GREEN, 7);
  body.appendParagraph('');
  if (observed) addChartImage_(body, buildColumnChart_(['Confirmado', 'Mes equivalente', 'Anual ÷ 12'], [observed, monthly, annual / 12], 'Consumo confirmado y normalizaciones (kWh)', BRAND_GREEN), 480, 245);
  addEnergyBaselineInterpretation_(body, monthly, unitCost, annualCo2Kg, BRAND_GREEN);
  addEducationalBenchmark_(body, d, BRAND_GREEN);

  addReportPage_(body, '3. Sensibilidad y escenarios de demanda', BRAND_GREEN);
  addScenarioTable_(body, monthly, 'kWh/mes', [-0.15, 0, 0.15], unitCost, ELECTRIC_FACTOR_KG_CO2_KWH, BRAND_GREEN);
  body.appendParagraph('Los escenarios ±15% muestran el rango de planeación ante variaciones de ocupación, horarios y condiciones operativas. No son pronósticos estadísticos.').editAsText().setFontSize(9);
  if (monthly) addChartImage_(body, buildColumnChart_(['-15%', 'Base', '+15%'], [monthly * 0.85, monthly, monthly * 1.15], 'Sensibilidad del consumo mensual equivalente (kWh)', BRAND_GREEN), 480, 250);
  addUpmePlanningScenarios_(body, annual, unitCost, ELECTRIC_FACTOR_KG_CO2_KWH, BRAND_GREEN);

  addReportPage_(body, '4. Medidas UPME aplicables a sedes educativas', BRAND_GREEN);
  addUpmeEnergyMeasures_(body, BRAND_GREEN);

  addReportPage_(body, '5. Potencial de ahorro operativo', BRAND_GREEN);
  addSavingsTable_(body, annual, 'kWh/año', [0.05, 0.10, 0.15], unitCost, ELECTRIC_FACTOR_KG_CO2_KWH, BRAND_GREEN);
  addCallout_(body, 'Meta inicial recomendada: 10% durante los primeros 12 meses, sujeta a validación cuando exista una línea base de 12 facturas comparables.', LIGHT_LIME, '#365314');
  addEnergyUseMap_(body, BRAND_GREEN);

  addReportPage_(body, '6. Evaluación técnico-económica inicial', BRAND_GREEN);
  addTechnicalEconomicAssessment_(body, annual, unitCost, BRAND_GREEN);

  addReportPage_(body, '7. Escenarios preliminares de cobertura solar', BRAND_GREEN);
  const solarRows = [['Cobertura', 'Energía objetivo', 'CO₂e evitado', 'Condición de validación']];
  [0.30, 0.50, 0.70].forEach(function(rate) {
    solarRows.push([fmt_(rate * 100, 0) + '%', fmt_(annual * rate, 0) + ' kWh/año', fmt_(annual * rate * ELECTRIC_FACTOR_KG_CO2_KWH / 1000, 3) + ' t/año', 'Perfil horario, cubierta, sombras, red y presupuesto']);
  });
  const solarTable = body.appendTable(solarRows);
  styleTable_(solarTable, BRAND_GREEN, 7);
  body.appendParagraph('');
  addCallout_(body, 'Estos escenarios expresan energía a cubrir; no constituyen diseño fotovoltaico ni oferta comercial. El predimensionamiento solar adjunto desarrolla la prefactibilidad y conserva sus propias restricciones técnicas.', LIGHT_GREEN, BRAND_GREEN);

  addReportPage_(body, '8. Gobernanza energética escolar', BRAND_GREEN);
  addSchoolEnergyGovernance_(body, BRAND_GREEN);
  addEnergyPolicyDraft_(body, d, BRAND_GREEN);

  addReportPage_(body, '9. Matriz priorizada de acciones', BRAND_GREEN);
  addActionMatrix_(body, [
    ['Medición y control', 'Registrar factura y lectura del medidor; consolidar 12 meses.', 'Alta', 'Administración + Líder Ambiental', '30 días', 'Serie mensual completa'],
    ['Cierre operativo', 'Lista de apagado para iluminación, cómputo, ventilación y equipos.', 'Alta', 'Coordinación / usuarios', '30 días', '% listas cumplidas'],
    ['Inventario de cargas', 'Levantar potencia, cantidad, horas de uso y estado por área.', 'Alta', 'Mantenimiento', '60 días', '% cargas inventariadas'],
    ['Iluminación', 'Medir niveles, sectorizar y priorizar LED/sensores donde aplique.', 'Media', 'Mantenimiento / SST', '60 días', 'kWh y puntos intervenidos'],
    ['Auditoría técnica', 'Medir circuitos críticos y demanda en horarios representativos.', 'Media', 'Profesional competente', '90 días', 'Perfil de carga'],
    ['Prefactibilidad solar', 'Validar cubierta, sombras, tableros, conexión y autoconsumo.', 'Media', 'Ingeniería', '90 días', 'Informe técnico aprobado']
  ], BRAND_GREEN);
  addUpmePrioritizationCriteria_(body, BRAND_GREEN);

  addReportPage_(body, '10. Hoja de ruta 30 / 60 / 90 días', BRAND_GREEN);
  addNinetyDayPlan_(body, [
    ['0–30 días', 'Nombrar responsable; validar factura; iniciar bitácora; aplicar cierre operativo.', 'Línea base administrativa y controles inmediatos'],
    ['31–60 días', 'Completar inventario de cargas; revisar iluminación; capacitar usuarios; corregir hallazgos.', 'Mapa de oportunidades y acciones de bajo costo'],
    ['61–90 días', 'Medir circuitos críticos; comparar segunda/tercera factura; decidir inversiones y estudio solar.', 'Plan validado, presupuesto y responsables']
  ], BRAND_GREEN);

  addReportPage_(body, '11. Riesgos y controles iniciales', BRAND_GREEN);
  addEnergyRiskMatrix_(body, BRAND_GREEN);

  addReportPage_(body, '12. Medición, reporte y verificación', BRAND_GREEN);
  addIndicatorTable_(body, [
    ['kWh/día', 'kWh facturados ÷ días del periodo', 'Mensual', '≤ línea base normalizada'],
    ['Costo de energía', 'Cargo específico de energía', 'Mensual', 'Tendencia decreciente'],
    ['Huella alcance 2', 'kWh × factor vigente', 'Mensual', 'Reducir con consumo'],
    ['Cumplimiento operativo', 'Acciones cumplidas ÷ programadas', 'Mensual', '≥90%'],
    ['Ahorro verificado', '(Base ajustada − consumo) ÷ base', 'Trimestral', 'Solo con periodos comparables']
  ], BRAND_GREEN);
  addUpmeMrvDeliverables_(body, BRAND_GREEN);

  addReportPage_(body, '13. Información requerida para el plan completo', BRAND_GREEN);
  addPendingData_(body, [
    'Doce facturas consecutivas y fechas exactas de lectura.',
    'Calendario escolar, ocupación, estudiantes, jornadas y áreas construidas.',
    'Inventario de equipos con potencia, cantidad y horas de uso.',
    'Medición de demanda y circuitos críticos en días representativos.',
    'Tarifa y cargos específicos confirmados; no usar el total general.',
    'Planos eléctricos, capacidad de transformador/tableros y evaluación de cubierta para solar.'
  ], BRAND_GREEN);
  addMinimumInventoryFormat_(body, BRAND_GREEN);

  addReportPage_(body, '14. Anexo técnico y control documental', BRAND_GREEN);
  addFormulaAnnex_(body, [
    ['Consumo diario', 'kWh observados ÷ días del periodo'],
    ['Mes equivalente', 'kWh/día × 30,44'],
    ['Anualización', 'kWh/día × 365'],
    ['Emisiones alcance 2', 'kWh × ' + fmt_(ELECTRIC_FACTOR_KG_CO2_KWH, 3) + ' kg CO₂e/kWh'],
    ['Ahorro económico', 'kWh evitados × tarifa específica confirmada'],
    ['Relación beneficio/costo inicial', 'Beneficios económicos estimados ÷ costo de implementación'],
    ['Retorno simple', 'Inversión estimada ÷ ahorro anual estimado']
  ], BRAND_GREEN);
  addDocumentControl_(body, d, codeId, 'PGE-INI', BRAND_GREEN);
  addUpmeDisclaimer_(body, BRAND_GREEN);

  addBrandSignature_(body, codeId);
  addFooterNote_(body, 'Documento generado por SiMeCO₂ a partir de una sola factura y complementado con lineamientos PGEE-UPME. Es un informe detallado inicial; no reemplaza auditoría, diseño de ingeniería ni verificación de ahorros con periodos consecutivos.');
  return exportDocAsPdfAndTrash_(doc, 'Informe_Detallado_Diagnostico_y_Plan_Inicial_Gestion_Energetica_SiMeCO2_' + safeName_(d.institutionName) + '.pdf');
}

function buildReductionPlanFormatHtml_(data, reductionPlanSheetUrl) {
  const institution = escapeHtml_(cleanText_(data && data.institutionName) || 'su institución');
  const actionUrl = cleanText_(reductionPlanSheetUrl) || REDUCTION_PLAN_FORMAT_URL;
  const planKind = cleanText_(reductionPlanSheetUrl) ? 'Plan de Reducciones de GEI editable en Google Sheets' : 'formato de referencia publicado';
  const rows = [
    ['Identificación', 'Nombre de la institución, responsable, fecha de aprobación, código interno y datos de contacto.'],
    ['Población', 'Directivos docentes, docentes, estudiantes, auxiliares administrativos, profesionales, otros y total.'],
    ['Inventario eléctrico inicial', 'Salas de cómputo, computadores, lámparas, tiendas, refrigeradores, laboratorios y otros equipos relevantes.'],
    ['Declaración de alta dirección', 'Compromiso institucional para asignar recursos, responsables y seguimiento al plan.'],
    ['Objetivo general', 'Reducción de emisiones de GEI asociadas al consumo de energía eléctrica.'],
    ['Cronograma', 'Actividades por mes: diagnóstico, línea base, estrategias, implementación, monitoreo y evaluación.'],
    ['Indicadores GEI', 'Registro anual de t CO₂e, metas de reducción y seguimiento hasta 2050 cuando aplique.'],
    ['Estrategias', 'Energía solar, iluminación LED, sensores, cultura energética, monitoreo y compras sostenibles.']
  ];
  const tableRows = rows.map(function(row) {
    return '<tr>' +
      '<td style="border:1px solid #D7E1DD;padding:8px;font-weight:bold;color:#0B5D45;">' + escapeHtml_(row[0]) + '</td>' +
      '<td style="border:1px solid #D7E1DD;padding:8px;">' + escapeHtml_(row[1]) + '</td>' +
    '</tr>';
  }).join('');
  return [
    '<div style="border:1px solid #BFD8CC;background:#F1F8F4;border-radius:10px;padding:14px;margin:18px 0;">',
      '<p style="margin:0 0 8px;"><strong>Formato para diligenciar por la institución</strong></p>',
      '<p style="margin:0 0 12px;">Con los datos recibidos, ' + institution + ' recibe un <strong>' + escapeHtml_(planKind) + '</strong> dentro del expediente. Este formato recoge la información institucional, población, inventario eléctrico, declaración de alta dirección, cronograma, indicadores, kWh/mes por estudiante y estrategias de reducción.</p>',
      '<p style="margin:0 0 12px;"><a href="' + escapeHtml_(actionUrl) + '" target="_blank" style="display:inline-block;background:#0B5D45;color:#FFFFFF;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:bold;">Abrir formato de Plan de Reducciones GEI</a></p>',
      '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;background:#FFFFFF;">',
        '<tr><th style="border:1px solid #0B5D45;background:#0B5D45;color:#FFFFFF;padding:8px;text-align:left;">Sección</th><th style="border:1px solid #0B5D45;background:#0B5D45;color:#FFFFFF;padding:8px;text-align:left;">Qué debe diligenciar</th></tr>',
        tableRows,
      '</table>',
      '<p style="margin:12px 0 0;font-size:12px;color:#365314;"><strong>Recomendación:</strong> completar el Google Sheets editable con la factura analizada, las facturas históricas disponibles, la matrícula real y el inventario real de equipos de la sede.</p>',
    '</div>'
  ].join('');
}

function buildReductionPlanFormatPlain_(data, reductionPlanSheetUrl) {
  const institution = cleanText_(data && data.institutionName) || 'su institución';
  const actionUrl = cleanText_(reductionPlanSheetUrl) || REDUCTION_PLAN_FORMAT_URL;
  return [
    'FORMATO PARA DILIGENCIAR POR LA INSTITUCIÓN',
    institution + ' recibe un Plan de Reducciones de GEI editable en Google Sheets dentro del expediente de Drive.',
    'Abrir formato de Plan de Reducciones GEI: ' + actionUrl,
    '',
    'Campos principales a diligenciar:',
    '- Identificación: institución, responsable, fecha de aprobación, código interno y contacto.',
    '- Población: directivos docentes, docentes, estudiantes, auxiliares administrativos, profesionales, otros y total.',
    '- Inventario eléctrico inicial: salas de cómputo, computadores, lámparas, tiendas, refrigeradores, laboratorios y otros.',
    '- Declaración de alta dirección: compromiso institucional, recursos y responsables.',
    '- Objetivo general: reducción de emisiones de GEI por consumo eléctrico.',
    '- Cronograma: diagnóstico, línea base, estrategias, implementación, monitoreo y evaluación.',
    '- Indicadores GEI: t CO₂e, kWh/mes por estudiante, metas de reducción y seguimiento anual.',
    '- Estrategias: solar, LED, sensores, cultura energética, monitoreo y compras sostenibles.',
    '',
    'Recomendación: completar el Google Sheets editable con la factura analizada, facturas históricas disponibles, matrícula real e inventario real de equipos.'
  ].join('\n');
}

/* =====================================================================
   PLAN 2 · AGUA
   Estructura alineada con el PDF de referencia SiMeCO₂.
   ===================================================================== */

function buildWaterPlanPdf_(d, codeId) {
  const doc = DocumentApp.create('Plan_Ahorro_Agua_' + safeName_(d.institutionName));
  const body = doc.getBody();
  setupBody_(body);

  addBrandHeader_(body, 'Diagnóstico y Plan Inicial de Gestión del Agua', 'Uso eficiente, control operacional y hoja de ruta institucional', WATER_BLUE);
  addIdentityBlock_(body, d, codeId, 'SiMeCO₂ · Plan de Acción de Ahorro de Agua', waterPriority_(d.waterM3), WATER_BLUE, LIGHT_BLUE);

  const observed = finiteOrZero_(d.waterM3);
  const days = getBillingDays_(d);
  const daily = observed ? observed / days : 0;
  const litersDay = daily * 1000;
  const monthly = daily * STANDARD_MONTH_DAYS;
  const annual = daily * 365;
  const unitCost = observed && d.waterCharge ? finiteOrZero_(d.waterCharge) / observed : 0;
  const perStudent = d.studentCount && daily ? litersDay / d.studentCount : 0;

  addReportStatus_(body, d, 'AGUA', 'Diagnóstico preliminar / plan inicial', WATER_BLUE, LIGHT_BLUE);
  addSection_(body, 'Resumen ejecutivo', WATER_BLUE);
  addMetricTable_(body, [
    ['Consumo observado · factura', observed ? fmt_(observed, 2) + ' m³ en ' + days + ' días' : 'No identificado'],
    ['Uso diario · calculado', daily ? fmt_(daily, 3) + ' m³/día · ' + fmt_(litersDay, 0) + ' L/día' : 'Sin dato'],
    ['Mes equivalente · proyectado', monthly ? fmt_(monthly, 2) + ' m³/30,44 días' : 'Sin dato'],
    ['Proyección anual · escenario base', annual ? fmt_(annual, 2) + ' m³/año' : 'Sin dato'],
    ['Costo unitario', unitCost ? money_(unitCost) + '/m³' : 'Pendiente: subtotal de agua no confirmado'],
    ['Intensidad por estudiante', perStudent ? fmt_(perStudent, 2) + ' L/estudiante-día' : 'Pendiente: matrícula/jornada'],
    ['Prioridad provisional', waterPriority_(monthly)],
    ['Nivel de confianza', confidenceLabel_(d)]
  ], WATER_BLUE, LIGHT_BLUE);
  addCallout_(body, 'Meta inicial propuesta: 15% de reducción, sujeta a validación con facturas consecutivas, ocupación y mediciones. Una sola factura no permite afirmar que existan fugas ni demostrar ahorro.', LIGHT_BLUE, WATER_BLUE);

  addReportPage_(body, '1. Evidencia, alcance y calidad del dato', WATER_BLUE);
  addDataTraceability_(body, d, [
    ['Volumen facturado', observed ? fmt_(observed, 2) + ' m³' : 'Pendiente', observed ? 'Observado en factura' : 'No identificado'],
    ['Duración', days + ' días', d.billingStart && d.billingEnd ? 'Fechas observadas' : 'Calendario del mes facturado'],
    ['Subtotal de agua', d.waterCharge ? money_(d.waterCharge) : 'Pendiente', d.waterCharge ? 'Observado con evidencia del servicio' : 'No se usa el total general'],
    ['Normalización', 'L/día, mes equivalente y año', 'Calculada/proyectada'],
    ['Diagnóstico de fugas', 'No concluyente', 'Requiere lecturas nocturnas e inspección']
  ], WATER_BLUE);
  addLimitations_(body, 'agua', [
    'No permite diferenciar consumo sanitario, limpieza, cocina, riego o pérdidas.',
    'No incorpora población, jornadas, días lectivos ni área atendida.',
    'Un valor alto o bajo no prueba por sí mismo la existencia o ausencia de fugas.'
  ]);

  addReportPage_(body, '2. Línea base normalizada', WATER_BLUE);
  addMetricTable_(body, [
    ['Dato observado', observed ? fmt_(observed, 2) + ' m³' : '—'],
    ['Promedio diario', daily ? fmt_(daily, 3) + ' m³/día' : '—'],
    ['Promedio diario', litersDay ? fmt_(litersDay, 0) + ' litros/día' : '—'],
    ['Mes equivalente', monthly ? fmt_(monthly, 2) + ' m³' : '—'],
    ['Proyección anual', annual ? fmt_(annual, 2) + ' m³' : '—'],
    ['Costo anual orientativo', unitCost && annual ? money_(unitCost * annual) : 'Pendiente']
  ], WATER_BLUE, LIGHT_BLUE);
  if (observed) addChartImage_(body, buildColumnChart_(['Factura', 'Mes equivalente', 'Anual ÷ 12'], [observed, monthly, annual / 12], 'Agua: dato observado y normalizaciones (m³)', WATER_BLUE), 480, 250);

  addReportPage_(body, '3. Escenarios de ahorro', WATER_BLUE);
  addSavingsTable_(body, annual, 'm³/año', [0.05, 0.10, 0.20], unitCost, 0, WATER_BLUE);
  addCallout_(body, 'La meta institucional sugerida es 15%. Debe ajustarse después de caracterizar usos y obtener una línea base comparable.', LIGHT_BLUE, WATER_BLUE);

  addReportPage_(body, '4. Evaluación operacional preliminar', WATER_BLUE);
  const evalTable = body.appendTable([
    ['Área / uso', 'Verificación en campo', 'Señal de alerta', 'Evidencia requerida'],
    ['Baños', 'Llaves, sanitarios, fluxómetros y orinales', 'Goteo, flujo continuo, rebose', 'Lista y fotografía'],
    ['Tanques', 'Flotadores, reboses y nivel', 'Llenado continuo', 'Lectura antes/después'],
    ['Cocina', 'Lavado y preparación', 'Manguera o llave abierta', 'Tiempo y caudal'],
    ['Aseo', 'Patios y zonas comunes', 'Sin dosificación/protocolo', 'Litros por actividad'],
    ['Medidor', 'Lectura con sede sin uso', 'Movimiento persistente', 'Prueba controlada']
  ]);
  styleTable_(evalTable, WATER_BLUE, 7);
  body.appendParagraph('La tabla orienta la inspección; no constituye diagnóstico de fugas. Cualquier conclusión debe documentarse mediante prueba, lectura y reparación verificable.').editAsText().setFontSize(9);

  addReportPage_(body, '5. Matriz priorizada de acciones', WATER_BLUE);
  addActionMatrix_(body, [
    ['Bitácora del medidor', 'Registrar lectura semanal y asociarla a días de operación.', 'Alta', 'Administración', '30 días', 'm³/día'],
    ['Inspección sanitaria', 'Revisar puntos, tanques y redes visibles; cerrar hallazgos.', 'Alta', 'Mantenimiento', '30 días', '% hallazgos cerrados'],
    ['Protocolos de aseo', 'Definir volúmenes, horarios y responsables.', 'Alta', 'Servicios generales', '30 días', 'L/actividad'],
    ['Dispositivos eficientes', 'Medir caudal y priorizar aireadores/temporizadores.', 'Media', 'Mantenimiento', '60 días', 'Puntos intervenidos'],
    ['Balance de usos', 'Separar estimaciones de baños, cocina, aseo y riego.', 'Media', 'PRAE / Administración', '60 días', '% consumo explicado'],
    ['Aprovechamiento lluvia', 'Evaluar demanda no potable, calidad, almacenamiento y seguridad.', 'Baja', 'Equipo técnico', '90 días', 'Estudio de viabilidad']
  ], WATER_BLUE);

  addReportPage_(body, '6. Hoja de ruta 30 / 60 / 90 días', WATER_BLUE);
  addNinetyDayPlan_(body, [
    ['0–30 días', 'Validar factura, leer medidor semanalmente, inspeccionar puntos y corregir fugas evidentes.', 'Bitácora, inventario y cierres documentados'],
    ['31–60 días', 'Medir caudales, normalizar protocolos de limpieza y priorizar dispositivos.', 'Balance preliminar y presupuesto'],
    ['61–90 días', 'Comparar nuevas facturas, verificar resultados y decidir inversiones.', 'Meta ajustada y plan anual']
  ], WATER_BLUE);

  addReportPage_(body, '7. Seguimiento y verificación', WATER_BLUE);
  addIndicatorTable_(body, [
    ['m³/día', 'm³ facturados ÷ días', 'Mensual', '≤ línea base normalizada'],
    ['L/estudiante-día', 'Litros ÷ estudiantes ÷ días de actividad', 'Mensual', 'Definir tras matrícula'],
    ['Hallazgos cerrados', 'Cerrados ÷ detectados × 100', 'Semanal', '100%'],
    ['Ahorro verificado', '(Base ajustada − consumo) ÷ base', 'Trimestral', 'Solo con periodos comparables'],
    ['Costo por m³', 'Subtotal específico ÷ m³', 'Mensual', 'Seguimiento presupuestal']
  ], WATER_BLUE);

  addReportPage_(body, '8. Datos pendientes y control documental', WATER_BLUE);
  addPendingData_(body, [
    'Doce facturas y fechas exactas de lectura.',
    'Matrícula, jornadas, días efectivos de operación y personal.',
    'Inventario de puntos hidráulicos y medición de caudal.',
    'Lectura nocturna/controlada para evaluar pérdidas.',
    'Separación de consumos por cocina, aseo, baños y riego.',
    'Subtotal específico del servicio de agua y estructura tarifaria.'
  ], WATER_BLUE);
  addFormulaAnnex_(body, [
    ['Consumo diario', 'm³ observados ÷ días del periodo'],
    ['Litros diarios', 'm³/día × 1.000'],
    ['Mes equivalente', 'm³/día × 30,44'],
    ['Ahorro', 'Línea base ajustada × porcentaje de reducción']
  ], WATER_BLUE);
  addDocumentControl_(body, d, codeId, 'PAA-INI', WATER_BLUE);

  addBrandSignature_(body, codeId);
  addFooterNote_(body, 'Documento generado por SiMeCO₂ a partir de una sola factura. No certifica fugas, ahorro ni desempeño; orienta la intervención inicial y su posterior verificación.');
  return exportDocAsPdfAndTrash_(doc, 'Plan_de_Accion_de_Ahorro_de_Agua_SiMeCO2_' + safeName_(d.institutionName) + '.pdf');
}

/* =====================================================================
   PLAN 3 · GAS
   Inferido siguiendo la misma lógica del plan de agua y gestión SiMeCO₂.
   ===================================================================== */

function buildGasPlanPdf_(d, codeId) {
  const doc = DocumentApp.create('Plan_Gas_' + safeName_(d.institutionName));
  const body = doc.getBody();
  setupBody_(body);

  addBrandHeader_(body, 'Diagnóstico y Plan Inicial de Gestión del Gas', 'Eficiencia, emisiones directas y seguridad operacional', GAS_ORANGE);
  addIdentityBlock_(body, d, codeId, 'SiMeCO₂ · Plan de Gestión y Uso Eficiente del Gas', gasPriority_(d.gasM3), GAS_ORANGE, LIGHT_ORANGE);

  const observed = finiteOrZero_(d.gasM3);
  const days = getBillingDays_(d);
  const daily = observed ? observed / days : 0;
  const monthly = daily * STANDARD_MONTH_DAYS;
  const annual = daily * 365;
  const unitCost = observed && d.gasCharge ? finiteOrZero_(d.gasCharge) / observed : 0;
  const annualCo2 = annual * GAS_FACTOR_KG_CO2_M3 / 1000;
  const annualKwhEq = annual * GAS_KWH_EQUIVALENT_PER_M3;
  const perMeal = d.mealsPerMonth && monthly ? monthly / d.mealsPerMonth : 0;

  addReportStatus_(body, d, 'GAS', 'Diagnóstico preliminar / plan inicial', GAS_ORANGE, LIGHT_ORANGE);
  addSection_(body, 'Resumen ejecutivo', GAS_ORANGE);
  addMetricTable_(body, [
    ['Consumo observado · factura', observed ? fmt_(observed, 3) + ' m³ en ' + days + ' días' : 'No identificado'],
    ['Consumo diario · calculado', daily ? fmt_(daily, 3) + ' m³/día' : 'Sin dato'],
    ['Mes equivalente · proyectado', monthly ? fmt_(monthly, 3) + ' m³/30,44 días' : 'Sin dato'],
    ['Proyección anual · escenario base', annual ? fmt_(annual, 2) + ' m³/año' : 'Sin dato'],
    ['Energía equivalente', annual ? fmt_(annualKwhEq, 0) + ' kWh/año' : 'Sin dato'],
    ['Costo unitario', unitCost ? money_(unitCost) + '/m³' : 'Pendiente: subtotal de gas no confirmado'],
    ['CO₂e directo anualizado', observed ? fmt_(annualCo2, 3) + ' t CO₂e/año' : 'Sin dato'],
    ['Consumo por comida', perMeal ? fmt_(perMeal, 4) + ' m³/comida' : 'Pendiente: comidas servidas'],
    ['Prioridad provisional', gasPriority_(monthly)],
    ['Nivel de confianza', confidenceLabel_(d)]
  ], GAS_ORANGE, LIGHT_ORANGE);
  addCallout_(body, 'Meta inicial sugerida: 10%. La seguridad prevalece sobre cualquier objetivo de ahorro. Este documento no certifica hermeticidad, ventilación, combustión ni conformidad de la instalación.', LIGHT_ORANGE, GAS_ORANGE);

  addReportPage_(body, '1. Evidencia, alcance y metodología', GAS_ORANGE);
  addDataTraceability_(body, d, [
    ['Volumen facturado', observed ? fmt_(observed, 3) + ' m³' : 'Pendiente', observed ? 'Observado en factura' : 'No identificado'],
    ['Duración', days + ' días', d.billingStart && d.billingEnd ? 'Fechas observadas' : 'Calendario del mes facturado'],
    ['Subtotal de gas', d.gasCharge ? money_(d.gasCharge) : 'Pendiente', d.gasCharge ? 'Observado con evidencia del servicio' : 'No se usa el total general'],
    ['Factor de emisión', fmt_(GAS_FACTOR_KG_CO2_M3, 2) + ' kg CO₂e/m³', 'Parámetro preliminar'],
    ['Equivalencia energética', fmt_(GAS_KWH_EQUIVALENT_PER_M3, 2) + ' kWh/m³', 'Referencia para comparación, no medición']
  ], GAS_ORANGE);
  addLimitations_(body, 'gas', [
    'No separa cocina, calentamiento u otros equipos consumidores.',
    'No incorpora cantidad de comidas, horas de operación ni eficiencia de combustión.',
    'No sustituye revisión técnica, prueba de estanqueidad ni inspección reglamentaria.'
  ]);

  addReportPage_(body, '2. Línea base normalizada y huella directa', GAS_ORANGE);
  addMetricTable_(body, [
    ['Dato observado', observed ? fmt_(observed, 3) + ' m³' : '—'],
    ['Promedio diario', daily ? fmt_(daily, 3) + ' m³/día' : '—'],
    ['Mes equivalente', monthly ? fmt_(monthly, 3) + ' m³' : '—'],
    ['Proyección anual', annual ? fmt_(annual, 2) + ' m³' : '—'],
    ['Energía equivalente anual', annual ? fmt_(annualKwhEq, 0) + ' kWh' : '—'],
    ['Emisiones directas', annual ? fmt_(annualCo2, 3) + ' t CO₂e/año' : '—'],
    ['Costo anual orientativo', unitCost && annual ? money_(unitCost * annual) : 'Pendiente']
  ], GAS_ORANGE, LIGHT_ORANGE);
  if (observed) addChartImage_(body, buildColumnChart_(['Factura', 'Mes equivalente', 'Anual ÷ 12'], [observed, monthly, annual / 12], 'Gas: dato observado y normalizaciones (m³)', GAS_ORANGE), 480, 250);

  addReportPage_(body, '3. Escenarios de eficiencia', GAS_ORANGE);
  addSavingsTable_(body, annual, 'm³/año', [0.05, 0.10, 0.15], unitCost, GAS_FACTOR_KG_CO2_M3, GAS_ORANGE);
  addCallout_(body, 'La reducción se validará contra una línea base ajustada por comidas servidas, días de operación y cambios de equipos.', LIGHT_ORANGE, GAS_ORANGE);

  addReportPage_(body, '4. Seguridad y operación', GAS_ORANGE);
  const safety = body.appendTable([
    ['Aspecto', 'Control institucional', 'Responsable', 'Evidencia'],
    ['Olor o sospecha de fuga', 'Cerrar suministro si es seguro, ventilar, evitar chispas y contactar al prestador/emergencias.', 'Todo usuario / brigada', 'Registro del evento'],
    ['Ventilación', 'Mantener rejillas libres; no modificar sin concepto técnico.', 'Mantenimiento / SST', 'Lista de inspección'],
    ['Combustión', 'Observar llama y funcionamiento; retirar de servicio ante anomalías.', 'Operador / técnico', 'Orden de mantenimiento'],
    ['Red y válvulas', 'Intervención exclusiva de personal competente/autorizado.', 'Rectoría / contratista', 'Certificado / acta'],
    ['Equipos', 'Mantenimiento según fabricante y condición de uso.', 'Técnico competente', 'Hoja de vida']
  ]);
  styleTable_(safety, GAS_ORANGE, 7);
  body.appendParagraph('La inspección de seguridad deberá ser realizada y certificada por personal competente o por quien corresponda según la regulación y el prestador. SiMeCO₂ no emite certificaciones de conformidad.').editAsText().setBold(true).setFontSize(9).setForegroundColor(GAS_ORANGE);

  addReportPage_(body, '5. Matriz priorizada de acciones', GAS_ORANGE);
  addActionMatrix_(body, [
    ['Protocolo de emergencia', 'Socializar actuación ante olor, fuga o combustión anormal.', 'Alta', 'SST / brigada', '30 días', '% personal orientado'],
    ['Inventario y hojas de vida', 'Identificar equipos, potencia, uso, mantenimiento y condición.', 'Alta', 'Mantenimiento', '30 días', '% equipos registrados'],
    ['Lectura y producción', 'Registrar m³ y comidas/servicios asociados.', 'Alta', 'Administración / cocina', '30 días', 'm³/comida'],
    ['Mantenimiento preventivo', 'Programar revisión de equipos y componentes.', 'Alta', 'Técnico competente', '60 días', '% plan cumplido'],
    ['Optimización de uso', 'Estandarizar encendido, precalentamiento, cargas y apagado.', 'Media', 'Operadores', '60 días', 'm³/día'],
    ['Inspección especializada', 'Validar ventilación, estanqueidad y condiciones reglamentarias.', 'Alta', 'Entidad/personal competente', '90 días', 'Informe o certificado']
  ], GAS_ORANGE);

  addReportPage_(body, '6. Hoja de ruta 30 / 60 / 90 días', GAS_ORANGE);
  addNinetyDayPlan_(body, [
    ['0–30 días', 'Activar protocolo, validar factura, inventariar equipos y registrar consumo/producción.', 'Controles básicos y trazabilidad'],
    ['31–60 días', 'Ejecutar mantenimiento, capacitar operadores y estandarizar tiempos de uso.', 'Operación segura y eficiente'],
    ['61–90 días', 'Realizar inspección competente, comparar facturas y ajustar meta.', 'Plan anual y soportes técnicos']
  ], GAS_ORANGE);

  addReportPage_(body, '7. Seguimiento y verificación', GAS_ORANGE);
  addIndicatorTable_(body, [
    ['m³/día', 'm³ facturados ÷ días', 'Mensual', '≤ línea base ajustada'],
    ['m³/comida', 'm³ ÷ comidas servidas', 'Mensual', 'Definir con producción'],
    ['CO₂e directo', 'm³ × ' + fmt_(GAS_FACTOR_KG_CO2_M3, 2) + ' kg CO₂e/m³', 'Mensual', 'Reducir con consumo'],
    ['Mantenimiento', 'Ejecutados ÷ programados × 100', 'Mensual', '100%'],
    ['Hallazgos de seguridad', 'Abiertos y cerrados', 'Inmediato', '0 críticos abiertos']
  ], GAS_ORANGE);

  addReportPage_(body, '8. Datos pendientes y control documental', GAS_ORANGE);
  addPendingData_(body, [
    'Doce facturas y fechas exactas de lectura.',
    'Subtotal específico del gas y estructura tarifaria.',
    'Comidas/servicios producidos y días efectivos de operación.',
    'Inventario, potencia, eficiencia y horas de uso de equipos.',
    'Planos, ventilación, certificados y antecedentes de mantenimiento.',
    'Inspección de seguridad por personal competente/autorizado.'
  ], GAS_ORANGE);
  addFormulaAnnex_(body, [
    ['Consumo diario', 'm³ observados ÷ días del periodo'],
    ['Mes equivalente', 'm³/día × 30,44'],
    ['Energía equivalente', 'm³ × ' + fmt_(GAS_KWH_EQUIVALENT_PER_M3, 2) + ' kWh/m³'],
    ['Emisiones directas', 'm³ × ' + fmt_(GAS_FACTOR_KG_CO2_M3, 2) + ' kg CO₂e/m³']
  ], GAS_ORANGE);
  addDocumentControl_(body, d, codeId, 'PGG-INI', GAS_ORANGE);

  addBrandSignature_(body, codeId);
  addFooterNote_(body, 'Documento generado por SiMeCO₂ a partir de una sola factura. Es preliminar y no reemplaza revisión, certificación o intervención por personal competente/autorizado.');
  return exportDocAsPdfAndTrash_(doc, 'Plan_de_Gestion_y_Uso_Eficiente_del_Gas_SiMeCO2_' + safeName_(d.institutionName) + '.pdf');
}

/* =====================================================================
   PLAN 4 · PREDIMENSIONAMIENTO SOLAR · LÍDERES AMBIENTALES
   Formato inspirado en los ejemplos suministrados por el usuario.

   IMPORTANTE:
   - NO copia logotipos, direcciones, correos ni marca de terceros.
   - Usa como referencia económica la tabla de sistemas On-Grid para el Área Metropolitana de Medellín.
   - Presenta una tasa financiera inferida matemáticamente de los ejemplos:
     1,50% mensual vencido (aprox. 19,56% efectivo anual).
   - ROI y recuperación se presentan como indicadores simples de prefactibilidad.
   ===================================================================== */

function selectSolarPricePackage_(targetEnergyMonthly) {
  const target = Math.max(0, finiteOrZero_(targetEnergyMonthly));
  if (!target) return null;

  for (let i = 0; i < SOLAR_PRICE_TABLE.length; i++) {
    const row = SOLAR_PRICE_TABLE[i];
    if (row[2] >= target) {
      return {
        kwp: row[0],
        area: row[1],
        energy: row[2],
        projectValue: row[3],
        pricePerKwp: row[4],
        referenceType: 'Tabla de referencia · Área Metropolitana de Medellín',
        extrapolated: false
      };
    }
  }

  // Si el requerimiento supera el rango máximo de la tabla, se extrapola
  // usando el último valor $/kWp y la productividad específica de la última fila.
  const last = SOLAR_PRICE_TABLE[SOLAR_PRICE_TABLE.length - 1];
  const specificYield = last[2] / last[0];
  const requiredKwp = target / specificYield;
  const panels = Math.max(1, Math.ceil(requiredKwp * 1000 / SOLAR_PANEL_WP));
  const moduleDcKwp = panels * SOLAR_PANEL_WP / 1000;
  const area = Math.ceil(panels * SOLAR_AREA_PER_PANEL_M2);
  const energy = Math.round(moduleDcKwp * specificYield);
  const projectValue = Math.round(moduleDcKwp * last[4]);

  return {
    kwp: Number(moduleDcKwp.toFixed(2)),
    area: area,
    energy: energy,
    projectValue: projectValue,
    pricePerKwp: last[4],
    referenceType: 'Extrapolación sobre el último tramo de la tabla · Área Metropolitana de Medellín',
    extrapolated: true
  };
}

function financePaymentByReferenceRate_(principal, months) {
  const p = Math.max(0, finiteOrZero_(principal));
  const n = Math.max(1, Math.round(finiteOrZero_(months)));
  const r = SOLAR_FINANCE_RATE_MV;
  if (!p) return 0;
  return p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

function applySolarPredimensioning_(d) {
  const consumption = Math.max(0, finiteOrZero_(d.consumption));
  const tariff = Math.max(0, finiteOrZero_(d.tariff));
  const coverage = Math.min(100, Math.max(1, finiteOrZero_(d.coverage) || 100));
  const targetEnergy = consumption * coverage / 100;
  const pkg = selectSolarPricePackage_(targetEnergy);

  if (!pkg) {
    d.coverage = coverage;
    d.targetEnergyMonthly = targetEnergy;
    d.panels = 0;
    d.kwp = 0;
    d.area = 0;
    d.generationMonthly = 0;
    d.generationAnnual = 0;
    d.monthlySaving = 0;
    d.annualSaving = 0;
    d.solarCo2 = 0;
    d.solarTrees = 0;
    d.projectValue = 0;
    d.valuePerKwp = 0;
    d.finance48 = 0;
    d.finance60 = 0;
    d.finance120 = 0;
    return d;
  }

  const panels = Math.max(1, Math.ceil(pkg.kwp * 1000 / SOLAR_PANEL_WP));
  const moduleDcKwp = panels * SOLAR_PANEL_WP / 1000;
  const generationMonthly = pkg.energy;
  const generationAnnual = generationMonthly * 12;
  const grossCoverage = consumption ? generationMonthly / consumption * 100 : 0;
  const effectiveCoverage = Math.min(100, grossCoverage);
  const usedSolarEnergy = Math.min(consumption, generationMonthly);
  const excessPotential = Math.max(0, generationMonthly - consumption);
  const monthlySaving = tariff ? usedSolarEnergy * tariff : 0;
  const annualSaving = monthlySaving * 12;
  const solarCo2 = generationAnnual * ELECTRIC_FACTOR_KG_CO2_KWH / 1000;
  const solarTrees = solarCo2 * 1000 / SOLAR_TREE_CAPTURE_KG_YEAR;
  const projectValue = finiteOrZero_(pkg.projectValue);

  d.coverage = coverage;
  d.targetEnergyMonthly = targetEnergy;
  d.requiredKwp = targetEnergy / SOLAR_SPECIFIC_YIELD_KWH_KWP_MONTH;
  d.panelWp = SOLAR_PANEL_WP;
  d.panels = panels;
  d.kwp = pkg.kwp; // potencia nominal de la tabla de referencia
  d.moduleDcKwp = moduleDcKwp; // potencia DC resultante de módulos de 615 Wp
  d.area = pkg.area;
  d.generationMonthly = generationMonthly;
  d.generationAnnual = generationAnnual;
  d.actualCoverage = grossCoverage;
  d.effectiveCoverage = effectiveCoverage;
  d.excessPotential = excessPotential;
  d.monthlySaving = monthlySaving;
  d.annualSaving = annualSaving;
  d.solarCo2 = solarCo2;
  d.solarTrees = solarTrees;
  d.irradiance = SOLAR_IRRADIANCE_H_DAY;
  d.specificYield = generationMonthly / Math.max(pkg.kwp, 0.001);
  d.inverterPlan = buildInverterPlan_(panels, moduleDcKwp);

  d.projectValue = projectValue;
  d.currentQuote = projectValue; // compatibilidad con funciones anteriores
  d.valuePerKwp = finiteOrZero_(pkg.pricePerKwp);
  d.priceReferenceType = pkg.referenceType;
  d.priceExtrapolated = !!pkg.extrapolated;
  d.priceReferenceNote = SOLAR_PRICE_REFERENCE_NOTE;
  d.economicReferenceVersion = SOLAR_ECONOMIC_REFERENCE_VERSION;
  d.economicReferenceSource = SOLAR_ECONOMIC_REFERENCE_SOURCE;
  d.economicReferenceSourceDate = SOLAR_ECONOMIC_REFERENCE_SOURCE_DATE;
  d.economicReferenceIntegratedAt = SOLAR_ECONOMIC_REFERENCE_INTEGRATED_AT;
  d.economicReferenceScope = SOLAR_ECONOMIC_REFERENCE_SCOPE;

  d.simplePayback = projectValue > 0 && annualSaving > 0 ? projectValue / annualSaving : 0;
  d.simpleRoi = projectValue > 0 ? annualSaving / projectValue * 100 : 0;

  d.financeRateMV = SOLAR_FINANCE_RATE_MV * 100;
  d.financeRateEA = SOLAR_FINANCE_RATE_EA * 100;
  d.financeModelVersion = SOLAR_FINANCE_MODEL_VERSION;
  d.financeReferenceSource = SOLAR_FINANCE_REFERENCE_SOURCE;
  d.financeReferenceSourceDate = SOLAR_FINANCE_REFERENCE_SOURCE_DATE;
  d.financeReferenceIntegratedAt = SOLAR_FINANCE_REFERENCE_INTEGRATED_AT;
  d.financeMethod = SOLAR_FINANCE_METHOD;
  d.finance48 = financePaymentByReferenceRate_(projectValue, 48);
  d.finance60 = financePaymentByReferenceRate_(projectValue, 60);
  d.finance120 = financePaymentByReferenceRate_(projectValue, 120);
  d.financeTotal48 = d.finance48 * 48;
  d.financeTotal60 = d.finance60 * 60;
  d.financeTotal120 = d.finance120 * 120;

  return d;
}

/**
 * Vista previa segura del predimensionamiento para el Index de esta Web App.
 * La tabla económica y la tasa permanecen en el backend; el navegador solo
 * envía consumo, tarifa y cobertura. generateAndSendStudy() vuelve a calcular
 * todo antes de generar los PDF, por lo que esta vista previa no es autoritativa.
 */
function previewSolarPredimensioning(input) {
  input = input || {};
  const d = {
    consumption: finiteOrZero_(input.consumption),
    tariff: finiteOrZero_(input.tariff),
    coverage: finiteOrZero_(input.coverage) || 100
  };
  if (d.consumption <= 0) throw new Error('El consumo eléctrico debe ser mayor que cero.');
  if (d.tariff <= 0) throw new Error('La tarifa eléctrica debe ser mayor que cero.');
  applySolarPredimensioning_(d);
  return {
    ok: true,
    consumption: d.consumption,
    tariff: d.tariff,
    coverage: d.coverage,
    targetEnergyMonthly: d.targetEnergyMonthly,
    kwp: d.kwp,
    panels: d.panels,
    panelWp: d.panelWp,
    moduleDcKwp: d.moduleDcKwp,
    area: d.area,
    generationMonthly: d.generationMonthly,
    generationAnnual: d.generationAnnual,
    actualCoverage: d.actualCoverage,
    effectiveCoverage: d.effectiveCoverage,
    excessPotential: d.excessPotential,
    monthlySaving: d.monthlySaving,
    annualSaving: d.annualSaving,
    solarCo2: d.solarCo2,
    solarTrees: d.solarTrees,
    projectValue: d.projectValue,
    valuePerKwp: d.valuePerKwp,
    simplePayback: d.simplePayback,
    simpleRoi: d.simpleRoi,
    financeRateMV: d.financeRateMV,
    financeRateEA: d.financeRateEA,
    finance48: d.finance48,
    finance60: d.finance60,
    finance120: d.finance120,
    financeTotal48: d.financeTotal48,
    financeTotal60: d.financeTotal60,
    financeTotal120: d.financeTotal120,
    priceReferenceType: d.priceReferenceType,
    priceReferenceNote: d.priceReferenceNote,
    priceExtrapolated: !!d.priceExtrapolated,
    economicReferenceVersion: d.economicReferenceVersion,
    economicReferenceSourceDate: d.economicReferenceSourceDate,
    economicReferenceIntegratedAt: d.economicReferenceIntegratedAt,
    economicReferenceScope: d.economicReferenceScope,
    financeModelVersion: d.financeModelVersion,
    financeReferenceSourceDate: d.financeReferenceSourceDate,
    financeReferenceIntegratedAt: d.financeReferenceIntegratedAt,
    financeMethod: d.financeMethod,
    inverterSummary: d.inverterPlan ? d.inverterPlan.summary : ''
  };
}

function buildInverterPlan_(panels, dcKwp) {
  panels = Math.max(0, Math.round(finiteOrZero_(panels)));
  dcKwp = Math.max(0, finiteOrZero_(dcKwp));
  if (!panels) return {rows: [], summary: 'Por definir'};

  // En los ejemplos de baja potencia se observa aproximadamente 1 microinversor
  // de 2 kW por cada 4 módulos (9->3, 17->5, 20->5, 36->9, 6->2).
  if (panels <= 40) {
    const qty = Math.max(1, Math.ceil(panels / 4));
    return {
      rows: [['Microinversor On-Grid 2,00 kW (selección preliminar)', String(qty)]],
      summary: qty + ' microinversor(es) de 2,00 kW, sujeto a validación eléctrica'
    };
  }

  // En el ejemplo de 130,4 kWp se usan 105 kW AC (DC/AC ~1,24). Para sistemas
  // mayores proponemos combinaciones referenciales de 25 y 30 kW que se acerquen
  // a esa relación. La tensión/fase final debe validarse en ingeniería de detalle.
  const targetAc = dcKwp / SOLAR_DC_AC_RATIO_LARGE;
  let best = null;
  for (let n30 = 0; n30 <= 30; n30++) {
    for (let n25 = 0; n25 <= 30; n25++) {
      if (!n30 && !n25) continue;
      const total = n30 * 30 + n25 * 25;
      const diff = Math.abs(total - targetAc);
      const pieces = n30 + n25;
      if (!best || diff < best.diff - 0.001 || (Math.abs(diff - best.diff) < 0.001 && pieces < best.pieces)) {
        best = {n30:n30, n25:n25, total:total, diff:diff, pieces:pieces};
      }
    }
  }
  const rows = [];
  if (best.n30) rows.push(['Inversor On-Grid 30,00 kW (referencial)', String(best.n30)]);
  if (best.n25) rows.push(['Inversor On-Grid 25,00 kW (referencial)', String(best.n25)]);
  return {
    rows: rows,
    summary: fmt_(best.total, 0) + ' kW AC aproximados; selección final según tensión, fase y operador de red'
  };
}

function addSolarBrand_(body, codeId, pageTitle) {
  const brand = body.appendTable([['LÍDERES AMBIENTALES', pageTitle || 'PREDIMENSIONAMIENTO SOLAR']]);
  const left = brand.getCell(0,0);
  const right = brand.getCell(0,1);
  left.setBackgroundColor(BRAND_GREEN).setPaddingTop(9).setPaddingBottom(9).setPaddingLeft(12).setPaddingRight(10);
  right.setBackgroundColor(LIGHT_GREEN).setPaddingTop(9).setPaddingBottom(9).setPaddingLeft(10).setPaddingRight(12);
  left.getChild(0).asParagraph().editAsText().setFontFamily('Arial').setFontSize(14).setBold(true).setForegroundColor('#FFFFFF');
  right.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  right.getChild(0).asParagraph().editAsText().setFontFamily('Arial').setFontSize(9).setBold(true).setForegroundColor(BRAND_GREEN);
  const meta = body.appendParagraph('SiMeCO₂ · Huella de Carbono Educativa de Medellín  |  ' + codeId);
  meta.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  meta.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#55736A');
  body.appendParagraph('');
}

function addSolarFooter_(body) {
  const footerText = PROJECT_URL + '  |  ' + CONTACT_EMAIL + '  |  Móvil / WhatsApp: ' + CONTACT_PHONE_DISPLAY;
  const p = body.appendParagraph(footerText);
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const t = p.editAsText();
  t.setFontFamily('Arial').setFontSize(7).setForegroundColor('#6B7D77');
  try {
    const urlStart = footerText.indexOf(PROJECT_URL);
    if (urlStart >= 0) t.setLinkUrl(urlStart, urlStart + PROJECT_URL.length - 1, PROJECT_URL);
    const emailStart = footerText.indexOf(CONTACT_EMAIL);
    if (emailStart >= 0) t.setLinkUrl(emailStart, emailStart + CONTACT_EMAIL.length - 1, 'mailto:' + CONTACT_EMAIL);
    const phoneStart = footerText.indexOf(CONTACT_PHONE_DISPLAY);
    if (phoneStart >= 0) t.setLinkUrl(phoneStart, phoneStart + CONTACT_PHONE_DISPLAY.length - 1, WHATSAPP_URL);
  } catch (_) {}
}

function addSolarMetricGrid_(body, items) {
  const colors = ['#EFE3FF','#FFE7B9','#DDF8E7','#FFE7B9','#DDF8E7','#EFE3FF','#DDF8E7','#EFE3FF','#FFE7B9'];
  const rows = [];
  for (let i = 0; i < items.length; i += 3) rows.push(['','','']);
  const table = body.appendTable(rows);
  let idx = 0;
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < 3; c++) {
      const cell = table.getCell(r,c);
      const item = items[idx++] || ['', ''];
      cell.setBackgroundColor(colors[idx-1] || LIGHT_GREEN).setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(7).setPaddingRight(7);
      const label = cell.getChild(0).asParagraph();
      label.setText(item[0]);
      label.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      label.editAsText().setFontFamily('Arial').setFontSize(7).setForegroundColor('#52655F');
      const value = cell.appendParagraph(item[1]);
      value.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      value.editAsText().setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor('#172F28');
    }
  }
  body.appendParagraph('');
  return table;
}

function addSolarFlow_(body) {
  const t = body.appendTable([['PANELES SOLARES','->','INVERSOR ON-GRID','->','CARGAS DE LA SEDE','<->','RED ELÉCTRICA']]);
  for (let c = 0; c < t.getRow(0).getNumCells(); c++) {
    const cell = t.getCell(0,c);
    const arrow = (c === 1 || c === 3 || c === 5);
    cell.setBackgroundColor(arrow ? '#FFFFFF' : LIGHT_GREEN).setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(3).setPaddingRight(3);
    cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    cell.getChild(0).asParagraph().editAsText().setFontFamily('Arial').setFontSize(arrow ? 10 : 7).setBold(!arrow).setForegroundColor(arrow ? BRAND_GREEN : BRAND_DARK);
  }
  body.appendParagraph('');
}

function buildSolarSavingsChart_(d) {
  const labels = [];
  const values = [];
  let cumulative = -Math.max(0, finiteOrZero_(d.projectValue));
  for (let year = 1; year <= SOLAR_LIFE_YEARS; year++) {
    cumulative += d.annualSaving;
    labels.push(String(year));
    values.push(cumulative);
  }
  const table = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, 'Año')
    .addColumn(Charts.ColumnType.NUMBER, 'COP');
  for (let i = 0; i < labels.length; i++) table.addRow([labels[i], values[i]]);
  return Charts.newColumnChart()
    .setDataTable(table.build())
    .setTitle('Flujo simple acumulado durante 25 años')
    .setDimensions(760, 360)
    .setOption('legend', {position:'none'})
    .setOption('colors', ['#4B7F3D'])
    .setOption('backgroundColor', '#FFFFFF')
    .setOption('chartArea', {left:85, top:55, width:'78%', height:'65%'})
    .setOption('hAxis', {title:'Años', textStyle:{fontSize:7}})
    .setOption('vAxis', {title:'Pesos', gridlines:{color:'#E1E8E4'}})
    .build();
}

function addSolarInitialNote_(body) {
  const table = body.appendTable([['']]);
  table.setBorderColor('#9BC7B6');
  table.setBorderWidth(1);
  const cell = table.getCell(0, 0);
  cell.setBackgroundColor('#EDF9F4');
  try {
    cell.setPaddingTop(10);
    cell.setPaddingBottom(10);
    cell.setPaddingLeft(12);
    cell.setPaddingRight(12);
  } catch (_) {}
  const p = cell.getChild(0).asParagraph();
  p.clear();
  const heading = p.appendText('NOTA SOBRE ESTA PRIMERA ESTIMACIÓN\n');
  heading.setFontFamily('Arial').setFontSize(9).setBold(true).setForegroundColor(BRAND_GREEN);
  const bodyText = p.appendText(SOLAR_INITIAL_NOTE);
  bodyText.setFontFamily('Arial').setFontSize(9).setForegroundColor(BRAND_DARK);
  const fullText = p.getText();
  const start = fullText.indexOf('GSV Ingeniería');
  if (start >= 0) {
    p.editAsText().setBold(start, start + 'GSV Ingeniería'.length - 1, true);
  }
  body.appendParagraph('');
}


function addSolarSectionSeparator_(body) {
  // Evita saltos de página forzados. En Google Docs un PageBreak insertado
  // después de contenido que ya fluyó a una página nueva puede crear una
  // página completamente en blanco. Dejamos que Docs pagine de forma natural
  // y usamos un separador visual entre bloques del predimensionamiento.
  const rule = body.appendHorizontalRule();
  body.appendParagraph('').setSpacingBefore(0).setSpacingAfter(2);
  return rule;
}

function buildSolarPdf_(d, codeId) {
  // Recalcular en backend garantiza que precio, generación y financiación
  // no dependan de valores manipulables en el navegador.
  applySolarPredimensioning_(d);

  const doc = DocumentApp.create('Predimensionamiento_Solar_Lideres_Ambientales_' + safeName_(d.institutionName));
  const body = doc.getBody();
  setupBody_(body);
  const now = Utilities.formatDate(new Date(), TIMEZONE, "d 'de' MMMM 'de' yyyy");

  /* ---------------- BLOQUE 1 · INICIO ---------------- */
  addSolarBrand_(body, codeId, 'PREDIMENSIONAMIENTO SOLAR ON-GRID');
  const top = body.appendTable([[now, codeId]]);
  top.getCell(0,1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  setTableFontSize_(top, 8);
  body.appendParagraph('');

  // Nota solicitada al inicio del predimensionamiento.
  addSolarInitialNote_(body);

  const sal = body.appendParagraph('Señor(a):');
  sal.editAsText().setFontFamily('Arial').setFontSize(9).setBold(true);
  body.appendParagraph(d.offerRecipientName || d.institutionName).editAsText().setFontFamily('Arial').setFontSize(11).setBold(true);
  if (d.offerRecipientRole) body.appendParagraph(d.offerRecipientRole).editAsText().setFontFamily('Arial').setFontSize(9).setItalic(true);
  body.appendParagraph('Solicitante o sede asociada: ' + d.institutionName).editAsText().setFontFamily('Arial').setFontSize(9);
  if (d.serviceAddress) body.appendParagraph(d.serviceAddress).editAsText().setFontFamily('Arial').setFontSize(9);
  if (d.city) body.appendParagraph(d.city).editAsText().setFontFamily('Arial').setFontSize(9);
  body.appendParagraph('');
  body.appendParagraph('Reciba un cordial saludo.').editAsText().setFontFamily('Arial').setFontSize(10);
  body.appendParagraph('De acuerdo con la factura suministrada, Líderes Ambientales presenta un predimensionamiento preliminar de un sistema de generación solar fotovoltaica orientado al autoconsumo y a la reducción de la compra de energía de la red.').editAsText().setFontFamily('Arial').setFontSize(10);

  addSection_(body, 'ANTECEDENTES', BRAND_DARK);
  body.appendParagraph(
    'El consumo eléctrico tomado como línea base es de ' + fmt_(d.consumption, 0) +
    ' kWh/mes y la tarifa calculada/confirmada desde la factura es de $ ' +
    fmt_(d.tariff, 2) + ' COP/kWh. El gasto energético equivalente utilizado para el análisis es de ' +
    money_(d.consumption * d.tariff) + ' al mes.'
  ).editAsText().setFontFamily('Arial').setFontSize(10);

  const baseTable = body.appendTable([
    ['Contrato / suscripción','Consumo actual','Costo por kWh','Gasto mensual','Periodo'],
    [d.contractNumber || 'Por validar', fmt_(d.consumption,0) + ' kWh', '$ ' + fmt_(d.tariff,2), money_(d.consumption*d.tariff), d.billingPeriod]
  ]);
  styleTable_(baseTable, '#D9D9D9', 7);
  for (let c=0;c<baseTable.getRow(0).getNumCells();c++) {
    baseTable.getCell(0,c).getChild(0).asParagraph().editAsText().setForegroundColor('#111111');
  }
  body.appendParagraph('');

  addSection_(body, 'TIPO DE SISTEMA', BRAND_DARK);
  body.appendParagraph(
    'Se contempla un sistema On-Grid (paralelo con la red, sin baterías). Para la referencia económica y de tamaño se selecciona el paquete de la tabla del Área Metropolitana de Medellín cuya generación cubre la energía solar objetivo. La irradiancia de referencia usada en los ejemplos es de ' +
    fmt_(d.irradiance,1) + ' horas de sol equivalente al día.'
  ).editAsText().setFontFamily('Arial').setFontSize(10);

  const systemTable = body.appendTable([
    ['Potencia sistema','Módulos estimados','Irradiancia','Energía generada','Valor referencial'],
    [fmt_(d.kwp,1) + ' kWp', fmt_(d.panels,0) + ' × ' + SOLAR_PANEL_WP + ' Wp', fmt_(d.irradiance,1) + ' h/día', fmt_(d.generationMonthly,0) + ' kWh/mes', money_(d.projectValue)]
  ]);
  styleTable_(systemTable, '#D9D9D9', 7);
  for (let c=0;c<systemTable.getRow(0).getNumCells();c++) {
    systemTable.getCell(0,c).getChild(0).asParagraph().editAsText().setForegroundColor('#111111');
  }
  body.appendParagraph('');
  addCallout_(body, SOLAR_PRICE_REFERENCE_NOTE, '#E8F4FB', '#24516A');
  addSolarFlow_(body);
  addSolarFooter_(body);
  addSolarSectionSeparator_(body);

  /* ---------------- BLOQUE 2 · DETALLES ---------------- */
  addSolarBrand_(body, codeId, 'DETALLES DEL PREDIMENSIONAMIENTO');
  body.appendParagraph('Con base en el consumo, la cobertura objetivo y la tabla de referencia del Área Metropolitana de Medellín, el sistema solar fotovoltaico preliminar sería:').editAsText().setFontFamily('Arial').setFontSize(10);

  addSolarMetricGrid_(body, [
    ['NÚMERO DE PANELES', fmt_(d.panels,0)],
    ['POTENCIA SISTEMA', fmt_(d.kwp,1) + ' kWp'],
    ['ENERGÍA GENERADA', fmt_(d.generationMonthly,0) + ' kWh-mes'],
    ['CONSUMO ACTUAL', fmt_(d.consumption,0) + ' kWh'],
    ['AHORRO MENSUAL', fmt_(d.effectiveCoverage,0) + '%'],
    ['AHORRO EN ENERGÍA', d.tariff ? money_(d.monthlySaving) : 'Tarifa pendiente'],
    ['ÁREA NECESARIA', fmt_(d.area,0) + ' m²'],
    ['COMPENSACIÓN ARBÓREA', fmt_(d.solarTrees,0) + ' árboles/año'],
    ['CO₂ EVITADO', fmt_(d.solarCo2,2) + ' ton/año']
  ]);

  const equipmentRows = [
    ['DESCRIPCIÓN','CANTIDAD'],
    ['Panel solar fotovoltaico bifacial ' + SOLAR_PANEL_WP + ' Wp', String(d.panels)],
    ['Estructuras para paneles solares', '1'],
    ['Adecuaciones eléctricas internas y medidor', '1'],
    ['Certificación RETIE / inspección aplicable', '1'],
    ['Trámites con comercializador / operador de red', '1'],
    ['Evaluación de trámites UPME / Ley 1715', '1'],
    ['Sistema de monitoreo', '1'],
    ['Ingeniería de detalle y mano de obra', '1']
  ];
  (d.inverterPlan.rows || []).forEach(function(row){ equipmentRows.push(row); });
  const eq = body.appendTable(equipmentRows);
  styleTable_(eq, '#D9D9D9', 8);
  for (let c=0;c<eq.getRow(0).getNumCells();c++) {
    eq.getCell(0,c).getChild(0).asParagraph().editAsText().setForegroundColor('#111111');
  }
  body.appendParagraph('');
  addCallout_(body, 'Selección preliminar de inversores: ' + d.inverterPlan.summary + '.', LIGHT_GREEN, BRAND_DARK);
  if (d.excessPotential > 0) {
    addCallout_(body,
      'Excedente energético potencial por selección del paquete: ' + fmt_(d.excessPotential,0) +
      ' kWh/mes. Su aprovechamiento o inyección debe validarse con el operador de red y con el perfil horario real de la sede.',
      '#FFF5D9', '#7A5200'
    );
  }
  body.appendParagraph(
    'Nota de consistencia: la “potencia sistema” corresponde a la potencia nominal del paquete de la tabla de referencia. La potencia DC resultante de ' +
    d.panels + ' módulos de ' + SOLAR_PANEL_WP + ' Wp es aproximadamente ' + fmt_(d.moduleDcKwp,2) +
    ' kWp y se valida definitivamente en ingeniería de detalle.'
  ).editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#6B7D77');
  addSolarFooter_(body);
  addSolarSectionSeparator_(body);

  /* ---------------- BLOQUE 3 · FLUJO Y FINANCIACIÓN ---------------- */
  addSolarBrand_(body, codeId, 'FLUJO DE CAJA Y RETORNO SIMPLE');
  body.appendParagraph(
    'La proyección inicia con el valor referencial del proyecto y suma un ahorro anual constante calculado con la tarifa actual de la factura. No se asumen incrementos tarifarios, inflación, degradación, mantenimiento, impuestos ni incentivos tributarios; por ello se presenta como análisis simple de prefactibilidad.'
  ).editAsText().setFontFamily('Arial').setFontSize(9);

  if (d.annualSaving > 0) addChartImage_(body, buildSolarSavingsChart_(d), 500, 245);

  addSolarMetricGrid_(body, [
    ['VALOR REFERENCIAL PROYECTO', money_(d.projectValue)],
    ['RENTABILIDAD SIMPLE AÑO 1', d.simpleRoi ? fmt_(d.simpleRoi,1) + '%' : '—'],
    ['RECUPERACIÓN SIMPLE', d.simplePayback ? fmt_(d.simplePayback,1) + ' años' : '—']
  ]);

  addSection_(body, 'SIMULACIÓN DE FINANCIACIÓN', BRAND_DARK);
  body.appendParagraph(
    'Modelo ' + d.financeModelVersion + '. Al resolver matemáticamente las cuotas de los ejemplos suministrados se obtiene una tasa de aproximadamente 1,50% mensual vencido, equivalente a ' +
    fmt_(d.financeRateEA,2) + '% efectivo anual. La fecha original de esos ejemplos no fue documentada. Esta no es una tasa bancaria vigente ni una oferta de crédito. La simulación financia el 100% del valor referencial, sin cuota inicial.'
  ).editAsText().setFontFamily('Arial').setFontSize(9);

  const fin = body.appendTable([
    ['Plazo','Tasa M.V.','Tasa E.A. equivalente','Cuota mensual estimada','Total pagado'],
    ['48 meses', fmt_(d.financeRateMV,2) + '%', fmt_(d.financeRateEA,2) + '%', money_(d.finance48), money_(d.financeTotal48)],
    ['60 meses', fmt_(d.financeRateMV,2) + '%', fmt_(d.financeRateEA,2) + '%', money_(d.finance60), money_(d.financeTotal60)],
    ['120 meses', fmt_(d.financeRateMV,2) + '%', fmt_(d.financeRateEA,2) + '%', money_(d.finance120), money_(d.financeTotal120)]
  ]);
  styleTable_(fin, '#D9D9D9', 7);
  for (let c=0;c<fin.getRow(0).getNumCells();c++) {
    fin.getCell(0,c).getChild(0).asParagraph().editAsText().setForegroundColor('#111111');
  }
  body.appendParagraph('');
  addCallout_(body,
    'Esta tasa se infiere matemáticamente de los ejemplos aportados y se presenta solo para reproducir la lógica de simulación financiera. No constituye tasa aprobada, oferta de crédito ni compromiso de una entidad financiera.',
    '#FFF5D9', '#7A5200'
  );
  addSolarFooter_(body);
  addSolarSectionSeparator_(body);

  /* ---------------- BLOQUE 4 · PRESUPUESTO ---------------- */
  addSolarBrand_(body, codeId, 'PRESUPUESTO Y FINANCIACIÓN REFERENCIAL');

  const budget = body.appendTable([
    ['ITEM','DESCRIPCIÓN','VALOR'],
    ['1','SISTEMA SOLAR FOTOVOLTAICO ON-GRID: ' + fmt_(d.kwp,1) + ' kWp', money_(d.projectValue)]
  ]);
  styleTable_(budget, '#D9D9D9', 8);
  for (let c=0;c<budget.getRow(0).getNumCells();c++) {
    budget.getCell(0,c).getChild(0).asParagraph().editAsText().setForegroundColor('#111111');
  }
  body.appendParagraph('');

  const total = body.appendTable([
    ['VALOR REFERENCIAL DEL PROYECTO', money_(d.projectValue)],
    ['VALOR REFERENCIAL POR kWp', money_(d.valuePerKwp)]
  ]);
  setTableFontSize_(total, 9);
  total.getCell(0,0).setBackgroundColor('#D9D9D9');
  total.getCell(1,0).setBackgroundColor('#D9D9D9');
  total.getCell(0,0).getChild(0).asParagraph().editAsText().setBold(true);
  total.getCell(1,0).getChild(0).asParagraph().editAsText().setBold(true);
  body.appendParagraph('');

  addSection_(body, 'FINANCIADO · SIMULACIÓN DE REFERENCIA', BRAND_DARK);
  const financeShort = body.appendTable([
    ['48 cuotas', money_(d.finance48)],
    ['60 cuotas', money_(d.finance60)],
    ['120 cuotas', money_(d.finance120)]
  ]);
  setTableFontSize_(financeShort, 9);
  for (let r=0;r<financeShort.getNumRows();r++) {
    financeShort.getCell(r,0).setBackgroundColor(LIGHT_GREEN);
    financeShort.getCell(r,0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(BRAND_GREEN);
    financeShort.getCell(r,1).getChild(0).asParagraph().editAsText().setBold(true);
  }
  body.appendParagraph('');

  addCallout_(body,
    'Tasa usada en la simulación: ' + fmt_(d.financeRateMV,2) + '% M.V. (aprox. ' +
    fmt_(d.financeRateEA,2) + '% E.A.). Capital financiado: 100% del valor referencial. ' +
    'Método: ' + d.financeMethod + ' ' + SOLAR_PRICE_REFERENCE_NOTE,
    LIGHT_LIME, '#365314'
  );

  addSection_(body, 'ALCANCE DEL VALOR REFERENCIAL', BRAND_DARK);
  addBullets_(body, [
    'El valor se toma de la tabla de referencia para sistemas On-Grid del Área Metropolitana de Medellín.',
    'No constituye una cotización u oferta comercial emitida por Líderes Ambientales.',
    'Debe confirmarse mediante visita técnica y cotización vigente antes de contratar.',
    'La tabla no sustituye la revisión de cubierta, sombras, estructura, tensión, fase, transformador, protecciones, RETIE ni condiciones del operador de red.',
    'Descuentos, impuestos, obras especiales, refuerzos estructurales, almacenamiento y equipos no contemplados deben validarse por separado.'
  ]);
  addSolarFooter_(body);
  addSolarSectionSeparator_(body);

  /* ---------------- BLOQUE 5 · CIERRE ---------------- */
  addSolarBrand_(body, codeId, 'VALIDACIONES, CRONOGRAMA Y CIERRE');
  addSection_(body, 'MANTENIMIENTO Y GARANTÍAS', BRAND_DARK);
  body.appendParagraph(
    'Líderes Ambientales no asigna garantías comerciales en este predimensionamiento. Las garantías definitivas de módulos, inversores, estructura e instalación deberán corresponder a los fabricantes, instaladores y proveedores finalmente seleccionados. Se recomienda incluir limpieza e inspección general periódica dentro del plan de operación y mantenimiento.'
  ).editAsText().setFontFamily('Arial').setFontSize(9);

  addSection_(body, 'CRONOGRAMA REFERENCIAL', BRAND_DARK);
  const cron = body.appendTable([
    ['Etapa','Actividad referencial'],
    ['Mes 1','Visita técnica, levantamiento de cargas, cubierta y red eléctrica.'],
    ['Mes 2','Ingeniería de detalle, selección definitiva de equipos y trámites iniciales.'],
    ['Mes 2-3','Suministro e instalación, sujeto a contratación y disponibilidad.'],
    ['Mes 4','Inspección / certificación RETIE cuando aplique.'],
    ['Mes 5','Proceso con comercializador u operador de red, sujeto a sus tiempos.']
  ]);
  styleTable_(cron, '#D9D9D9', 8);
  for (let c=0;c<cron.getRow(0).getNumCells();c++) {
    cron.getCell(0,c).getChild(0).asParagraph().editAsText().setForegroundColor('#111111');
  }
  body.appendParagraph('');

  addSection_(body, 'BENEFICIOS TRIBUTARIOS Y REGULATORIOS', BRAND_DARK);
  body.appendParagraph(
    'La posible aplicación de beneficios de la Ley 1715 y normas relacionadas debe revisarse caso por caso con profesionales tributarios y técnicos. Este predimensionamiento no certifica ni promete beneficios tributarios.'
  ).editAsText().setFontFamily('Arial').setFontSize(9);

  addSection_(body, 'OBSERVACIONES', BRAND_DARK);
  if (d.notes) {
    body.appendParagraph('Observaciones suministradas por el solicitante:').editAsText().setFontFamily('Arial').setFontSize(9).setBold(true);
    addCallout_(body, d.notes, '#EEF3F8', BRAND_DARK);
  }
  addBullets_(body, [
    'La factura de un solo periodo es una línea base inicial; para diseño se recomiendan 12 meses consecutivos.',
    'La generación real depende de radiación, orientación, inclinación, temperatura, sombras, disponibilidad de red y pérdidas eléctricas.',
    'La cubierta y su capacidad estructural deben revisarse antes de cualquier instalación.',
    'La potencia y cantidad final de inversores debe definirse a partir de la tensión, fase, transformador, protecciones y condiciones del operador de red.',
    'El valor y la financiación son referencias de prefactibilidad para el Área Metropolitana de Medellín y deben actualizarse al momento de una decisión de inversión.',
    'Este documento es un predimensionamiento educativo y de prefactibilidad; no reemplaza ingeniería de detalle ni una oferta comercial.'
  ]);

  body.appendParagraph('Atentamente,').editAsText().setFontFamily('Arial').setFontSize(9);
  body.appendParagraph(AUTHOR_NAME).editAsText().setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor(BRAND_GREEN);
  body.appendParagraph('Líderes Ambientales').editAsText().setFontFamily('Arial').setFontSize(10).setBold(true);
  const emailP = body.appendParagraph(CONTACT_EMAIL);
  const emailT = emailP.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#55736A');
  try { emailT.setLinkUrl(0, CONTACT_EMAIL.length - 1, 'mailto:' + CONTACT_EMAIL); } catch (_) {}
  const mobileLabel = 'Móvil: ' + CONTACT_PHONE_DISPLAY;
  const mobileP = body.appendParagraph(mobileLabel);
  const mobileT = mobileP.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#55736A');
  try {
    const phoneStart = mobileLabel.indexOf(CONTACT_PHONE_DISPLAY);
    mobileT.setLinkUrl(phoneStart, phoneStart + CONTACT_PHONE_DISPLAY.length - 1, WHATSAPP_URL);
  } catch (_) {}
  addSolarFooter_(body);

  return exportDocAsPdfAndTrash_(
    doc,
    'Predimensionamiento_Solar_Lideres_Ambientales_' + safeName_(d.institutionName) + '.pdf'
  );
}

/* =====================================================================
   PRIORIDADES Y LECTURAS
   ===================================================================== */

function energyPriority_(kwh) {
  const n = finiteOrZero_(kwh);
  if (n >= 5000) return 'Prioridad Alta';
  if (n >= 2000) return 'Prioridad Media';
  return 'Prioridad preventiva';
}

function waterPriority_(m3) {
  const n = finiteOrZero_(m3);
  if (!n) return 'Sin dato · revisión manual';
  if (n >= 500) return 'Prioridad Alta · preliminar';
  if (n >= 150) return 'Prioridad Media · preliminar';
  return 'Prioridad preventiva · preliminar';
}

function gasPriority_(m3) {
  const n = finiteOrZero_(m3);
  if (!n) return 'Sin dato · revisión manual';
  if (n >= 150) return 'Prioridad Alta · preliminar';
  if (n >= 50) return 'Prioridad Media · preliminar';
  return 'Prioridad preventiva · preliminar';
}

function isEducationalRequesterType_(type) {
  const normalized = stripAccents_(String(type || '')).toLowerCase().trim();
  return normalized === 'institucion educativa' ||
    normalized === 'colegio privado' ||
    normalized === 'universidad';
}

function applyStudentMetrics_(d) {
  d.isEducationalRequester = isEducationalRequesterType_(d && d.requesterType);
  if (!d.isEducationalRequester) {
    d.studentCount = 0;
    d.energyKwhPerStudent = 0;
    return d;
  }
  d.studentCount = Math.max(0, Math.floor(finiteOrZero_(d.studentCount)));
  d.energyKwhPerStudent = d.studentCount > 0 && finiteOrZero_(d.consumption) > 0
    ? finiteOrZero_(d.consumption) / d.studentCount
    : 0;
  return d;
}

function energyTechnicalReading_(kwh) {
  const n = finiteOrZero_(kwh);
  if (!n) return 'Lectura técnica: el OCR no identificó un consumo eléctrico confiable. Confirma manualmente el valor antes de usar este plan como línea base.';
  if (n >= 5000) return 'Lectura técnica: la sede presenta un consumo eléctrico alto. Se recomienda priorizar diagnóstico por circuitos, eficiencia de equipos, control operativo y evaluación solar.';
  if (n >= 2000) return 'Lectura técnica: la sede presenta un consumo eléctrico medio. Se recomienda fortalecer monitoreo, medidas de eficiencia y evaluación progresiva de autoconsumo solar.';
  return 'Lectura técnica: la sede presenta un consumo eléctrico bajo o moderado. Se recomienda mantener monitoreo, formación ambiental y acciones preventivas de eficiencia.';
}

/* =====================================================================
   PROTECCIÓN ANTIABUSO
   ===================================================================== */

function createPageSession_() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    'page-session:' + token,
    JSON.stringify({createdAt: Date.now(), ocrAttempts: 0}),
    PAGE_SESSION_TTL_SECONDS
  );
  return token;
}

function consumePageSessionForOcr_(token) {
  token = String(token || '').trim();
  if (!token) throw new Error('La sesión de seguridad no es válida. Recarga la página e inténtalo nuevamente.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const key = 'page-session:' + token;
    const raw = cache.get(key);
    if (!raw) throw new Error('La sesión de seguridad venció. Recarga la página antes de procesar la factura.');

    const session = JSON.parse(raw);
    session.ocrAttempts = finiteOrZero_(session.ocrAttempts) + 1;
    cache.put(key, JSON.stringify(session), PAGE_SESSION_TTL_SECONDS);
  } finally {
    lock.releaseLock();
  }
}

function validatePageSessionForStudy_(provided, expected) {
  const token = String(provided || '').trim();
  if (!token || token !== String(expected || '').trim()) {
    throw new Error('La sesión del formulario no coincide con la factura procesada. Recarga la página y vuelve a intentarlo.');
  }
  if (!CacheService.getScriptCache().get('page-session:' + token)) {
    throw new Error('La sesión del formulario venció. Recarga la página y procesa nuevamente la factura.');
  }
}

function emailRateKey_(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized, Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    const n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('').slice(0, 24);
}

function enforceRateLimit_(action, email) {
  // Límites internos desactivados por solicitud del proyecto.
  // Permanecen activos únicamente los límites propios de Google Apps Script,
  // Drive OCR, DocumentApp, SpreadsheetApp y MailApp.
  return true;
}

function assertMailQuotaAvailable_(destinationEmail) {
  const recipientsNeeded = String(destinationEmail || '').trim().toLowerCase() === String(COPY_EMAIL).toLowerCase() ? 1 : 2;
  const remaining = MailApp.getRemainingDailyQuota();
  if (remaining < recipientsNeeded) {
    throw new Error('La cuota diaria de correo de SiMeCO₂ se completó. Inténtalo nuevamente mañana o escribe a ' + CONTACT_EMAIL + '.');
  }
}

function acquireInvoiceProcessing_(invoiceToken) {
  const token = String(invoiceToken || '').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const key = 'invoice-processing:' + token;
    if (cache.get(key)) throw new Error('Esta factura ya se está procesando. Espera a que finalice el envío actual.');
    cache.put(key, String(Date.now()), PROCESSING_MARKER_TTL_SECONDS);
  } finally {
    lock.releaseLock();
  }
}

function releaseInvoiceProcessing_(invoiceToken) {
  CacheService.getScriptCache().remove('invoice-processing:' + String(invoiceToken || '').trim());
}

/* =====================================================================
   VALIDACIÓN / NORMALIZACIÓN
   ===================================================================== */

function normalizeIncomingFile_(input) {
  if (!input || typeof input !== 'object') throw new Error('No se recibió uno de los archivos de la factura.');

  const name = sanitizeFileName_(input.name || input.fileName || 'factura');
  const extension = (name.split('.').pop() || '').toLowerCase();
  const byExtension = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  };
  let mimeType = String(input.mimeType || input.type || '').toLowerCase().split(';')[0].trim();

  // Safari, Chrome y algunos lectores de PDF pueden entregar el tipo vacío o
  // application/octet-stream. En esos casos se valida usando la extensión.
  if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream') {
    mimeType = byExtension[extension] || '';
  }

  let base64 = String(input.base64 || input.data || '');
  const dataUrlMatch = base64.match(/^data:([^;,]+)?;base64,(.*)$/i);
  if (dataUrlMatch) {
    if (!mimeType && dataUrlMatch[1]) mimeType = String(dataUrlMatch[1]).toLowerCase();
    base64 = dataUrlMatch[2];
  }
  base64 = base64.replace(/\s+/g, '');

  return {
    name: name,
    mimeType: mimeType,
    size: Number(input.size) || Math.floor(base64.length * 3 / 4),
    base64: base64
  };
}

function validateIncomingFile_(file) {
  if (!file || typeof file !== 'object') throw new Error('No se recibió la factura.');
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (allowed.indexOf(String(file.mimeType || '')) === -1) throw new Error('Formato no permitido. Usa PDF, JPG, PNG o WEBP.');
  const size = Number(file.size) || 0;
  if (!file.base64) throw new Error('El archivo “' + file.name + '” llegó sin contenido. Vuelve a seleccionarlo.');
  if (size <= 0 || size > MAX_FILE_BYTES) throw new Error('Cada archivo de la factura debe pesar máximo 10 MB.');
}

function validateStudyPayload_(p) {
  if (!p || typeof p !== 'object') throw new Error('No se recibieron datos del estudio.');
  if (!p.invoiceToken) throw new Error('Falta la factura procesada.');
  if (!p.pageSessionToken) throw new Error('Falta la sesión de seguridad. Recarga la página.');
  if (String(p.website || '').trim()) throw new Error('La solicitud no superó la validación anti-bot.');
  const formStartedAt = Number(p.formStartedAt);
  if (!isFinite(formStartedAt) || Date.now() - formStartedAt < 2500) {
    throw new Error('El formulario fue enviado demasiado rápido. Recarga la página e inténtalo nuevamente.');
  }

  const fullName = String(p.fullName || '').trim();
  const email = String(p.email || '').trim();
  const whatsapp = String(p.whatsapp || '').trim();
  const requesterType = cleanText_(p.requesterType);
  const offerRecipientName = cleanText_(p.offerRecipientName || p.proposalRecipientName || p.dirigidoA);
  const offerRecipientRole = cleanText_(p.offerRecipientRole || p.proposalRecipientRole || p.cargoDirigidoA);
  const notes = cleanText_(p.notes || p.notas || p.observaciones || p.observations || p['Notas u observaciones']);
  const city = cleanText_(p.city || p.municipio || p.municipality);
  if (fullName.length < 2 || fullName.length > 140) throw new Error('El nombre del solicitante debe tener entre 2 y 140 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail no válido.');
  if (!/^\+?\d{7,15}$/.test(whatsapp)) throw new Error('WhatsApp no válido.');
  if (REQUESTER_TYPES.indexOf(requesterType) === -1) throw new Error('Selecciona un tipo de solicitante válido.');
  if (offerRecipientName.length < 2 || offerRecipientName.length > 180) throw new Error('La persona o institución destinataria de la oferta no es válida.');
  if (offerRecipientRole.length > 120) throw new Error('El cargo de la persona destinataria es demasiado largo.');
  if (notes.length > 2000) throw new Error('Las notas u observaciones deben tener máximo 2.000 caracteres.');
  if (city.length < 2 || city.length > 120) throw new Error('Confirma el municipio de la sede o del servicio.');
  if (p.consent !== true && p.gsvConsent !== true) {
    throw new Error('Selecciona al menos una de las dos autorizaciones antes de generar el estudio.');
  }
  if (cleanText_(p.privacyNoticeVersion) !== PRIVACY_NOTICE_VERSION) {
    throw new Error('El aviso de privacidad fue actualizado. Recarga la página, léelo y confirma nuevamente la autorización.');
  }

  const required = ['consumption', 'tariff', 'coverage'];
  required.forEach(function(key) {
    const n = Number(p[key]);
    if (!isFinite(n) || n < 0) throw new Error('Dato inválido: ' + key);
  });
  if (Number(p.consumption) <= 0) throw new Error('El consumo eléctrico debe ser mayor que cero.');
  if (Number(p.tariff) <= 0) throw new Error('La tarifa eléctrica debe ser mayor que cero.');
}

function normalizeStudyPayload_(p) {
  const numeric = [
    'consumption', 'tariff', 'monthlyBillApprox', 'coverage', 'factor', 'annualCarbon', 'carbonTrees',
    'kwp', 'area', 'generationMonthly', 'generationAnnual', 'actualCoverage', 'panels', 'panelWp',
    'monthlySaving', 'annualSaving', 'solarCo2', 'solarTrees', 'currentQuote',
    'projectValue', 'valuePerKwp', 'financeRateMV', 'financeRateEA', 'finance48', 'finance60', 'finance120',
    'studentCount', 'mealsPerMonth', 'billingDays', 'waterCharge', 'gasCharge'
  ];

  const d = {
    fullName: String(p.fullName || '').trim(),
    email: String(p.email || '').trim(),
    whatsapp: String(p.whatsapp || '').trim(),
    requesterType: cleanText_(p.requesterType),
    offerRecipientName: cleanText_(p.offerRecipientName || p.proposalRecipientName || p.dirigidoA),
    offerRecipientRole: cleanText_(p.offerRecipientRole || p.proposalRecipientRole || p.cargoDirigidoA),
    notes: cleanText_(p.notes || p.notas || p.observaciones || p.observations || p['Notas u observaciones']),
    invoiceFileName: String(p.invoiceFileName || ''),
    institutionName: cleanText_(p.institutionName),
    serviceAddress: cleanText_(p.serviceAddress),
    city: cleanText_(p.city || p.municipio || p.municipality),
    billingPeriod: cleanText_(p.billingPeriod),
    billingStart: cleanText_(p.billingStart),
    billingEnd: cleanText_(p.billingEnd),
    contractNumber: cleanText_(p.contractNumber),
    analysisConfidence: normalizeConfidence_(p.analysisConfidence || DEFAULT_ANALYSIS_CONFIDENCE),
    source: String(p.source || 'Predimensionamiento técnico SiMeCO₂'),
    consent: p.consent === true,
    consentVersion: PRIVACY_NOTICE_VERSION,
    gsvConsent: p.gsvConsent === true
  };
  numeric.forEach(function(k) { d[k] = finiteOrZero_(p[k]); });

  if (!d.factor) d.factor = ELECTRIC_FACTOR_KG_CO2_KWH;
  if (!d.monthlyBillApprox && d.consumption && d.tariff) d.monthlyBillApprox = d.consumption * d.tariff;
  applyStudentMetrics_(d);
  if (!d.annualCarbon) d.annualCarbon = d.consumption * 12 * d.factor / 1000;
  if (!d.carbonTrees) d.carbonTrees = d.annualCarbon * 1000 / TREE_CAPTURE_KG_YEAR;
  applySolarPredimensioning_(d);
  return d;
}

/* =====================================================================
   DOCUMENTOS / ESTILOS
   ===================================================================== */

function setupBody_(body) {
  // Márgenes compactos y aptos para impresión. Conservan espacio suficiente
  // para encuadernación, pero evitan desperdiciar área útil de cada hoja.
  body.setMarginTop(28);
  body.setMarginBottom(28);
  body.setMarginLeft(34);
  body.setMarginRight(34);
  const attrs = {};
  attrs[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
  attrs[DocumentApp.Attribute.FONT_SIZE] = 10;
  attrs[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND_DARK;
  body.setAttributes(attrs);
}

function addBrandHeader_(body, title, subtitle, color) {
  const now = Utilities.formatDate(new Date(), TIMEZONE, "d 'de' MMMM 'de' yyyy 'a las' h:mm a");
  const table = body.appendTable([['', '']]);
  const left = table.getCell(0, 0);
  const right = table.getCell(0, 1);
  left.setBackgroundColor(color).setPaddingTop(9).setPaddingBottom(9).setPaddingLeft(12).setPaddingRight(8);
  right.setBackgroundColor(color).setPaddingTop(9).setPaddingBottom(9).setPaddingLeft(8).setPaddingRight(10);

  const p0 = left.getChild(0).asParagraph();
  p0.setText(APP_NAME.toUpperCase());
  p0.editAsText().setFontFamily('Arial').setFontSize(7).setBold(true).setForegroundColor('#FFFFFF');
  p0.setSpacingAfter(4);
  const p1 = left.appendParagraph(title);
  p1.editAsText().setFontFamily('Arial').setFontSize(20).setBold(true).setForegroundColor('#FFFFFF');
  p1.setSpacingAfter(3);
  const p2 = left.appendParagraph(subtitle || '');
  p2.editAsText().setFontFamily('Arial').setFontSize(9).setForegroundColor('#EAF7F2');

  const r0 = right.getChild(0).asParagraph();
  r0.setText('Informe ambiental');
  r0.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  r0.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#FFFFFF');
  const r1 = right.appendParagraph(now);
  r1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  r1.editAsText().setFontFamily('Arial').setFontSize(8).setBold(true).setForegroundColor('#FFFFFF');
  body.appendParagraph('');
}

function getBillingDays_(d) {
  const supplied = Math.round(finiteOrZero_(d && d.billingDays));
  if (supplied >= 15 && supplied <= 60) return supplied;
  return billingDaysFromPeriod_(d && d.billingPeriod);
}

function normalizeConfidence_(value) {
  const v = stripAccents_(String(value || '')).toLowerCase();
  if (v.indexOf('alta') >= 0) return 'alta';
  if (v.indexOf('baja') >= 0) return 'baja';
  return 'media';
}

function confidenceLabel_(d) {
  const c = normalizeConfidence_(d && d.analysisConfidence);
  if (c === 'alta') return 'Alta · revisar visualmente';
  if (c === 'baja') return 'Baja · requiere validación manual';
  return 'Media · requiere validación manual';
}

function addReportStatus_(body, d, service, classification, color, lightColor) {
  const t = body.appendTable([
    ['CLASIFICACIÓN', classification],
    ['BASE DISPONIBLE', '1 factura · ' + getBillingDays_(d) + ' días analizados'],
    ['CONFIANZA DEL DATO', confidenceLabel_(d)],
    ['VERSIÓN', REPORT_VERSION]
  ]);
  for (let r = 0; r < t.getNumRows(); r++) {
    t.getRow(r).getCell(0).setBackgroundColor(color);
    t.getRow(r).getCell(0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor('#FFFFFF');
    t.getRow(r).getCell(1).setBackgroundColor(lightColor);
  }
  setTableFontSize_(t, 8);
  body.appendParagraph('');
  addCallout_(body, service + ': los datos observados provienen de la factura; los indicadores normalizados son cálculos y los valores mensuales/anuales son proyecciones. Todo dato sin evidencia queda identificado como pendiente.', lightColor, color);
}

function addReportPage_(body, title, color) {
  // No forzar una hoja nueva: Google Docs decide el salto según el espacio
  // real disponible y mantiene unidas las filas de las tablas cuando procede.
  // La línea conserva una separación visual profesional entre secciones.
  body.appendHorizontalRule();
  addSection_(body, title, color);
}

function addDataTraceability_(body, d, rows, color) {
  const tableRows = [['Variable', 'Valor', 'Origen / tratamiento']].concat(rows);
  const t = body.appendTable(tableRows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
  const dates = d.billingStart && d.billingEnd
    ? 'Periodo de lectura identificado: ' + d.billingStart + ' a ' + d.billingEnd + '.'
    : 'No se identificaron con certeza ambas fechas de lectura; se usó la duración calendario del periodo ' + d.billingPeriod + '.';
  body.appendParagraph(dates).editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#5B6B66');
}

function addLimitations_(body, service, items) {
  addSection_(body, 'Limitaciones del diagnóstico de una factura', BRAND_DARK);
  addBullets_(body, items);
  body.appendParagraph('Por lo anterior, este documento se denomina diagnóstico preliminar y plan inicial de ' + service + '. Sus metas son orientativas hasta completar la información pendiente.').editAsText().setFontSize(9).setItalic(true);
}

function addScenarioTable_(body, base, unit, deltas, unitCost, co2Factor, color) {
  const rows = [['Escenario', 'Demanda', 'Costo orientativo', 'CO₂e asociado']];
  deltas.forEach(function(delta) {
    const value = base * (1 + delta);
    const label = delta === 0 ? 'Base' : (delta > 0 ? '+' : '') + fmt_(delta * 100, 0) + '%';
    rows.push([
      label,
      value ? fmt_(value, 2) + ' ' + unit : 'Sin dato',
      unitCost && value ? money_(value * unitCost) : 'Tarifa pendiente',
      co2Factor && value ? fmt_(value * co2Factor / 1000, 3) + ' t CO₂e' : 'No aplica / pendiente'
    ]);
  });
  const t = body.appendTable(rows);
  styleTable_(t, color, 8);
  body.appendParagraph('');
}

function addSavingsTable_(body, annualBase, unit, rates, unitCost, co2Factor, color) {
  const rows = [['Escenario', 'Reducción', 'Consumo meta', 'Ahorro económico', 'CO₂e evitado']];
  rates.forEach(function(rate) {
    const saving = annualBase * rate;
    rows.push([
      fmt_(rate * 100, 0) + '%',
      annualBase ? fmt_(saving, 2) + ' ' + unit : 'Sin dato',
      annualBase ? fmt_(annualBase - saving, 2) + ' ' + unit : 'Sin dato',
      unitCost && saving ? money_(saving * unitCost) + '/año' : 'Tarifa pendiente',
      co2Factor && saving ? fmt_(saving * co2Factor / 1000, 3) + ' t/año' : 'No aplica'
    ]);
  });
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addActionMatrix_(body, rows, color) {
  const t = body.appendTable([['Línea', 'Acción verificable', 'Prioridad', 'Responsable', 'Plazo', 'Indicador']].concat(rows));
  styleTable_(t, color, 6);
  body.appendParagraph('');
}

function addNinetyDayPlan_(body, rows, color) {
  const t = body.appendTable([['Horizonte', 'Actividades', 'Entregable']].concat(rows));
  styleTable_(t, color, 8);
  body.appendParagraph('');
  addCallout_(body, 'Gobernanza recomendada: Rectoría patrocina; Administración custodia facturas; Mantenimiento ejecuta controles; Líderes Ambientales apoyan seguimiento y cultura; el profesional competente valida decisiones técnicas.', '#F3F6F5', color);
}

function addIndicatorTable_(body, rows, color) {
  const t = body.appendTable([['Indicador', 'Fórmula / fuente', 'Frecuencia', 'Criterio inicial']].concat(rows));
  styleTable_(t, color, 7);
  body.appendParagraph('');
  body.appendParagraph('Los resultados deben compararse con periodos equivalentes y documentar cambios de ocupación, calendario, equipos y operación.').editAsText().setFontSize(9);
}

function addPendingData_(body, items, color) {
  addCallout_(body, 'Para elevar el nivel de confianza y emitir un plan completo deben reunirse los siguientes soportes:', '#F3F6F5', color);
  addBullets_(body, items);
}

function addEnergyDecisionBrief_(body, d, metrics, color) {
  addSection_(body, 'Lectura para toma de decisiones', color);
  const monthly = finiteOrZero_(metrics.monthly);
  const unitCost = finiteOrZero_(metrics.unitCost);
  const annual = finiteOrZero_(metrics.annual);
  const estimatedAnnualCost = unitCost && annual ? annual * unitCost : 0;
  const priority = energyPriority_(monthly);
  const rows = [
    ['Pregunta directiva', 'Respuesta inicial desde la factura'],
    ['¿Qué tan alto es el consumo?', monthly ? energyTechnicalReading_(monthly) : 'Aún no hay consumo suficiente para clasificar la sede.'],
    ['¿Qué decisión se puede tomar hoy?', monthly ? 'Iniciar plan operativo de reducción, consolidar línea base y priorizar inventario de cargas.' : 'Validar la factura y completar los datos mínimos antes de emitir metas.'],
    ['¿Cuál es el orden de magnitud económico?', estimatedAnnualCost ? money_(estimatedAnnualCost) + '/año proyectado solo para energía' : 'Pendiente por tarifa específica confirmada.'],
    ['¿Cuál es el impacto climático preliminar?', metrics.annualCo2Kg ? fmt_(metrics.annualCo2Kg / 1000, 3) + ' t CO₂e/año alcance 2' : 'Pendiente por consumo confirmado.'],
    ['¿Qué prioridad recibe?', priority],
    ['¿Qué no debe concluirse todavía?', 'Ahorro verificado, fuga energética, sobrefacturación o viabilidad solar definitiva.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 8);
  body.appendParagraph('');
}

function addPgeeAlignment_(body, color) {
  addSection_(body, 'Alineación con un PGEE', color);
  const rows = [
    ['Componente PGEE', 'Cómo lo inicia SiMeCO₂', 'Evidencia producida'],
    ['Toma de decisión', 'Entrega una lectura ejecutiva para rectoría, administración o comité ambiental.', 'Prioridad, costo orientativo e impacto CO₂e.'],
    ['Diagnóstico energético', 'Parte de la factura y normaliza el consumo por día, mes y año.', 'Línea base preliminar e indicadores.'],
    ['Formulación del plan', 'Propone acciones por horizonte, responsable, plazo e indicador.', 'Matriz de acciones y ruta 30/60/90.'],
    ['Financiación / inversión', 'Separa buenas prácticas, medidas de bajo costo y prefactibilidad solar.', 'Escenarios de ahorro y cobertura solar.'],
    ['Monitoreo y verificación', 'Define indicadores mensuales y datos faltantes.', 'Plan MRV inicial y control documental.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addUpmeMethodRoute_(body, color) {
  addSection_(body, 'Ruta metodológica integrada SiMeCO₂ + UPME', color);
  const rows = [
    ['Etapa', 'Propósito', 'Resultado dentro del informe'],
    ['1. Toma de decisión', 'Motivar a la alta dirección y definir responsables.', 'Lectura ejecutiva, prioridad provisional y gobernanza escolar.'],
    ['2. Diagnóstico energético', 'Caracterizar consumos, tarifa, emisiones y usos significativos.', 'Línea base normalizada, trazabilidad OCR/usuario e indicadores.'],
    ['3. Formulación del plan', 'Seleccionar medidas, metas, responsables, plazos y seguimiento.', 'Matriz de acciones, hoja 30/60/90 y datos pendientes.'],
    ['4. Evaluación económica', 'Comparar ahorro, costo, retorno y nivel de inversión.', 'Escenarios de ahorro y criterios de priorización.'],
    ['5. Monitoreo y verificación', 'Documentar avances y actualizar el PGEE.', 'Indicadores MRV, control documental y próxima actualización.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
  addCallout_(body, 'Este informe convierte la factura en una primera carta de navegación energética. La versión completa del PGEE se consolida al incorporar serie histórica, inventario de cargas, mediciones y decisiones institucionales.', LIGHT_GREEN, color);
}

function addPgeeEvidenceLevel_(body, d, color) {
  addSection_(body, 'Nivel de evidencia del estudio', color);
  const rows = [
    ['Nivel', 'Estado', 'Interpretación'],
    ['Factura única', 'Disponible', 'Permite diagnóstico preliminar y priorización inicial.'],
    ['Serie de 12 meses', 'Pendiente', 'Permite línea base anual, estacionalidad y metas comparables.'],
    ['Inventario de cargas', 'Pendiente', 'Permite identificar equipos críticos y horarios de uso.'],
    ['Medición por circuitos', 'Pendiente', 'Permite validar demanda, picos y oportunidades de control.'],
    ['Verificación de ahorro', 'Pendiente', 'Requiere comparar periodos equivalentes después de implementar acciones.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 8);
  body.appendParagraph('');
  addCallout_(body, 'Clasificación de confianza actual: ' + confidenceLabel_(d) + '. La utilidad del documento es orientar decisiones iniciales y ordenar la recolección de evidencia.', LIGHT_GREEN, color);
}

function addEnergyBaselineInterpretation_(body, monthly, unitCost, annualCo2Kg, color) {
  addSection_(body, 'Interpretación de la línea base', color);
  const monthlyCost = monthly && unitCost ? monthly * unitCost : 0;
  const rows = [
    ['Criterio', 'Lectura inicial', 'Decisión sugerida'],
    ['Consumo mensual equivalente', monthly ? fmt_(monthly, 2) + ' kWh/mes' : 'Pendiente', monthly ? energyTechnicalReading_(monthly) : 'Confirmar consumo antes de clasificar.'],
    ['Costo mensual estimado', monthlyCost ? money_(monthlyCost) + '/mes' : 'Pendiente', monthlyCost ? 'Usar como orden de magnitud para priorizar ahorro.' : 'Confirmar tarifa específica de energía.'],
    ['Emisiones anualizadas', annualCo2Kg ? fmt_(annualCo2Kg / 1000, 3) + ' t CO₂e/año' : 'Pendiente', annualCo2Kg ? 'Reportar como huella preliminar alcance 2.' : 'Requiere consumo confirmado.'],
    ['Madurez del dato', 'Inicial', 'Subir facturas consecutivas y completar inventario.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addEducationalBenchmark_(body, d, color) {
  if (!d.isEducationalRequester) return;
  addSection_(body, 'Indicador educativo para comparación', color);
  const rows = [
    ['Indicador', 'Resultado', 'Interpretación'],
    ['Número de estudiantes reportados', d.studentCount ? fmt_(d.studentCount, 0) : 'No reportado', 'Dato opcional suministrado por el solicitante.'],
    ['Consumo eléctrico de la factura', finiteOrZero_(d.consumption) ? fmt_(d.consumption, 2) + ' kWh/mes' : 'Pendiente', 'Dato final confirmado después del OCR.'],
    ['kWh/mes por estudiante', d.energyKwhPerStudent ? fmt_(d.energyKwhPerStudent, 3) : 'Pendiente', 'Se calcula cuando se reporta número de estudiantes. Permite comparar sedes educativas, colegios privados y universidades.'],
    ['Uso recomendado', 'Ranking y seguimiento', 'Comparar instituciones similares y revisar cambios cuando varía matrícula, jornada u ocupación.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
  addCallout_(body, 'Este indicador no califica por sí solo la eficiencia de una institución. Debe interpretarse junto con jornada, área construida, número de sedes, laboratorios, restaurantes escolares, climatización y calendario académico.', LIGHT_GREEN, color);
}

function addUpmePlanningScenarios_(body, annualBase, unitCost, co2Factor, color) {
  addSection_(body, 'Escenarios PGEE a 1, 3, 5 y 10 años', color);
  const rows = [['Horizonte', 'Meta orientativa', 'Ahorro acumulado', 'CO₂e evitado acumulado', 'Enfoque']];
  [
    ['1 año', 0.10, 1, 'Buenas prácticas, control operativo y línea base.'],
    ['3 años', 0.15, 3, 'Iluminación eficiente, sensores, mantenimiento y compras sostenibles.'],
    ['5 años', 0.25, 5, 'Modernización de equipos, gestión de demanda y prefactibilidad solar.'],
    ['10 años', 0.35, 10, 'Renovación tecnológica, autogeneración y cultura energética institucional.']
  ].forEach(function(item) {
    const rate = item[1];
    const years = item[2];
    const annualSaving = annualBase * rate;
    rows.push([
      item[0],
      fmt_(rate * 100, 0) + '% frente a línea base ajustada',
      annualBase && unitCost ? money_(annualSaving * unitCost * years) : 'Tarifa pendiente',
      annualBase && co2Factor ? fmt_(annualSaving * co2Factor * years / 1000, 3) + ' t CO₂e' : 'Pendiente',
      item[3]
    ]);
  });
  const t = body.appendTable(rows);
  styleTable_(t, color, 6);
  body.appendParagraph('');
  addCallout_(body, 'Estas metas son una propuesta inicial para planeación. Deben aprobarse con datos de 12 meses y actualizarse cuando se ejecuten medidas o cambie la operación de la sede.', LIGHT_GREEN, color);
}

function addEnergyUseMap_(body, color) {
  addSection_(body, 'Mapa inicial de usos significativos de energía', color);
  const rows = [
    ['Uso energético', 'Qué revisar en la sede', 'Acción inicial sugerida'],
    ['Iluminación', 'Aulas, pasillos, patios, oficinas, biblioteca y laboratorios.', 'Verificar LED, niveles de iluminación, horarios y controles.'],
    ['Equipos de cómputo y oficina', 'Salas de sistemas, impresoras, video beams, cargadores y computadores administrativos.', 'Aplicar apagado real, suspensión automática y regletas por zona.'],
    ['Ventilación y climatización', 'Ventiladores, aires acondicionados, extractores y confort térmico.', 'Ajustar horarios, mantenimiento, limpieza y uso de ventilación natural.'],
    ['Refrigeración y cocina', 'Neveras, congeladores, cafetería, comedor escolar o tienda.', 'Revisar empaques, temperatura, mantenimiento y hábitos de apertura.'],
    ['Bombas y motores', 'Tanques, presión, bombeo de agua, sistemas especiales.', 'Registrar horarios, potencia y mantenimiento preventivo.'],
    ['Cargas ocultas', 'Equipos en espera, cargadores conectados, iluminación externa fuera de horario.', 'Realizar recorrido al cierre de jornada.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addUpmeEnergyMeasures_(body, color) {
  const rows = [
    ['Tipo de medida', 'Aplicación educativa', 'Ejemplos concretos', 'Prioridad inicial'],
    ['Buenas prácticas', 'Cambios de hábito y operación sin inversión alta.', 'Apagado al cierre, campañas, responsables por aula, uso eficiente de salas de sistemas.', 'Alta'],
    ['Medidas pasivas', 'Aprovechar arquitectura y ambiente antes de consumir más energía.', 'Iluminación natural, ventilación cruzada, sombreado, reflectividad en techos/muros.', 'Media'],
    ['Medidas activas', 'Sustitución o control de equipos consumidores.', 'LED, sensores, temporizadores, equipos eficientes, mantenimiento HVAC.', 'Media / Alta según consumo'],
    ['Autogeneración', 'Reducir compra de energía de red cuando exista viabilidad técnica.', 'Sistema solar fotovoltaico on-grid, medición, estudio de cubierta y conexión.', 'Según prefactibilidad'],
    ['Compras sostenibles', 'Evitar compras baratas que aumentan costos ocultos de energía.', 'Criterios mínimos de eficiencia en computadores, iluminación, ventiladores y equipos.', 'Alta en nuevas compras']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 6);
  body.appendParagraph('');
  addCallout_(body, 'Criterio UPME adaptado: primero reducir desperdicios y ordenar operación; luego invertir en eficiencia; finalmente evaluar autogeneración solar con datos y validación técnica.', LIGHT_GREEN, color);
}

function addSchoolEnergyGovernance_(body, color) {
  const rows = [
    ['Rol', 'Responsabilidad inicial', 'Producto esperado'],
    ['Rectoría / dirección', 'Patrocinar el PGEE escolar y habilitar decisiones administrativas.', 'Acta de inicio y responsables designados.'],
    ['Administración', 'Custodiar facturas, tarifas, contratos y pagos.', 'Carpeta energética con 12 facturas consecutivas.'],
    ['Mantenimiento', 'Levantar inventario, horarios, estado de equipos y oportunidades.', 'Inventario de cargas y plan de mantenimiento.'],
    ['Docente líder', 'Articular el proceso con PRAE, tecnología, matemáticas, ciencias y emprendimiento.', 'Ruta pedagógica y evidencias de aula.'],
    ['Líderes Ambientales', 'Apoyar cultura energética, campañas, recorridos y seguimiento mensual.', 'Bitácora, fotografías, compromisos y socialización.'],
    ['Aliado técnico', 'Validar mediciones, seguridad, diseño eléctrico o solar.', 'Concepto técnico antes de inversión.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
  addCallout_(body, 'El plan inicial funciona mejor cuando se aprueba como compromiso institucional: no depende solo de apagar equipos, sino de roles, datos, seguimiento y decisiones.', LIGHT_GREEN, color);
}

function addEnergyPolicyDraft_(body, d, color) {
  addSection_(body, 'Borrador de política energética institucional', color);
  const name = cleanText_(d && d.institutionName) || 'la sede educativa';
  addCallout_(body, name + ' se compromete a gestionar de manera eficiente el uso de la energía, reducir progresivamente su consumo y sus emisiones de GEI, fortalecer la cultura ambiental de la comunidad educativa, incorporar criterios de eficiencia en la operación y las compras, y realizar seguimiento periódico a sus indicadores energéticos.', '#F3F6F5', color);
  const rows = [
    ['Elemento', 'Definición inicial'],
    ['Responsable de seguimiento', 'Gestor energético escolar o comité ambiental designado por la dirección.'],
    ['Frecuencia de revisión', 'Mensual para indicadores; anual para actualización del plan.'],
    ['Alcance inicial', 'Electricidad facturada, hábitos de uso, cargas principales y oportunidades de ahorro.'],
    ['Evidencia mínima', 'Facturas, inventario de cargas, actas, fotografías, bitácora y reportes de acciones.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 8);
  body.appendParagraph('');
}

function addEnergyRiskMatrix_(body, color) {
  const rows = [
    ['Riesgo', 'Efecto', 'Control inicial'],
    ['Usar una sola factura como línea base definitiva', 'Metas poco comparables o conclusiones débiles.', 'Completar 12 meses y normalizar por días de operación.'],
    ['Tarifa mal interpretada por OCR', 'Errores en ahorro económico proyectado.', 'Confirmar costo específico de energía, no total general.'],
    ['Cambios de ocupación o calendario', 'Aumentos o reducciones aparentes sin causa energética.', 'Registrar jornadas, vacaciones, eventos y número de usuarios.'],
    ['Acciones sin responsable', 'El plan no se ejecuta ni se mide.', 'Asignar responsable, plazo e indicador por acción.'],
    ['Comprar equipos sin diagnóstico', 'Inversión con bajo retorno o sin impacto medible.', 'Priorizar inventario, medición y costo-beneficio.'],
    ['Diseñar solar sin evaluar cubierta y red', 'Riesgo técnico, económico o de conexión.', 'Realizar visita técnica y estudio de prefactibilidad.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addTechnicalEconomicAssessment_(body, annualBase, unitCost, color) {
  const annualCost = annualBase && unitCost ? annualBase * unitCost : 0;
  const rows = [
    ['Alternativa', 'Tipo UPME', 'Ahorro esperado', 'Inversión relativa', 'Criterio de decisión'],
    ['Buenas prácticas y control operativo', 'A', '5% a 10%', 'Baja', 'Implementar de inmediato y medir cumplimiento.'],
    ['LED, sensores y sectorización', 'B', '10% a 20%', 'Media', 'Priorizar zonas de mayor uso y retorno menor a 3 años.'],
    ['Mantenimiento y sustitución de equipos', 'B / C', 'Variable', 'Media / Alta', 'Exigir inventario, vida útil y costo del ciclo de vida.'],
    ['Gestión de demanda y medición', 'B', 'Variable', 'Media', 'Aplicar si existen picos, cargas críticas o dudas de operación.'],
    ['Sistema solar fotovoltaico', 'C', 'Según cobertura', 'Alta', 'Requiere prefactibilidad, diseño, conexión y modelo financiero.']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 6);
  body.appendParagraph('');

  const criteria = [
    ['Indicador económico', 'Cómo se usaría en el PGEE'],
    ['Costo del ciclo de vida', 'Compara compra, operación, mantenimiento, reposición y valor residual.'],
    ['Beneficio/costo', 'Prioriza medidas donde los beneficios superan los costos.'],
    ['Retorno simple', 'Estima cuántos años tarda en recuperarse la inversión.'],
    ['VPN / TIR', 'Se calculan cuando exista flujo de caja, inversión y vida útil de la alternativa.'],
    ['Ahorro anual base', annualCost ? 'El costo anual de energía proyectado es ' + money_(annualCost) + '; sirve como techo de referencia para valorar medidas.' : 'Pendiente hasta confirmar tarifa y consumo anual.']
  ];
  const t2 = body.appendTable(criteria);
  styleTable_(t2, color, 7);
  body.appendParagraph('');
}

function addUpmePrioritizationCriteria_(body, color) {
  addSection_(body, 'Criterios de priorización UPME adaptados', color);
  const rows = [
    ['Criterio', 'Pregunta guía', 'Puntaje sugerido'],
    ['Impacto energético', '¿Cuántos kWh puede reducir frente a la línea base?', '1 a 5'],
    ['Impacto económico', '¿Cuánto ahorro anual puede generar?', '1 a 5'],
    ['Costo / complejidad', '¿Requiere baja, media o alta inversión?', '1 a 5'],
    ['Rapidez de implementación', '¿Puede ejecutarse en 30, 60 o 90 días?', '1 a 5'],
    ['Valor pedagógico', '¿Permite participación de estudiantes y cultura ambiental?', '1 a 5'],
    ['Necesidad técnica', '¿Requiere profesional, medición o diseño?', 'No bloquea; orienta fase siguiente']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addUpmeMrvDeliverables_(body, color) {
  addSection_(body, 'Entregables mínimos de seguimiento', color);
  const rows = [
    ['Entregable', 'Contenido mínimo', 'Frecuencia'],
    ['Acta de seguimiento energético', 'Fecha, participantes, decisiones, compromisos y responsables.', 'Mensual / bimestral'],
    ['Matriz de planificación PGEE', 'Problema, medida, indicador, meta, riesgo, responsable y cronograma.', 'Actualización trimestral'],
    ['Reporte de indicadores', 'kWh, costo, CO₂e, acciones cumplidas, observaciones operativas.', 'Mensual'],
    ['Evidencias de implementación', 'Fotos, listas de chequeo, capacitaciones, soportes de mantenimiento.', 'Según acción'],
    ['Actualización del plan', 'Ajustes por nuevas facturas, cambios de operación o resultados medidos.', 'Anual o cuando aplique']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 7);
  body.appendParagraph('');
}

function addUpmeDisclaimer_(body, color) {
  addSection_(body, 'Alcance técnico del informe integrado', color);
  addBullets_(body, [
    'La estructura toma como referencia metodológica los componentes de un PGEE promovidos por UPME, adaptados al contexto educativo de SiMeCO₂.',
    'Los resultados cuantitativos provienen de la factura cargada, los valores confirmados por el solicitante y los parámetros configurados en el sistema.',
    'La normatividad, factores de emisión y condiciones de contratación deben verificarse con fuentes oficiales vigentes antes de tomar decisiones jurídicas, presupuestales o contractuales.',
    'Toda inversión requiere validación técnica, visita, medición, cotización vigente y aprobación institucional.'
  ]);
}

function addMinimumInventoryFormat_(body, color) {
  addSection_(body, 'Formato mínimo recomendado para inventario de cargas', color);
  const rows = [
    ['Área', 'Equipo', 'Cantidad', 'Potencia', 'Horas/día', 'Días/mes', 'Estado / acción'],
    ['Ejemplo: Aula 101', 'Luminaria LED', '8', '18 W', '6', '22', 'Verificar apagado al finalizar jornada'],
    ['Ejemplo: Sala sistemas', 'Computador', '30', '120 W', '5', '22', 'Activar suspensión y apagado real'],
    ['Ejemplo: Oficina', 'Impresora', '1', '600 W', '1', '22', 'Revisar modo reposo']
  ];
  const t = body.appendTable(rows);
  styleTable_(t, color, 6);
  body.appendParagraph('');
  body.appendParagraph('Este inventario permite pasar del diagnóstico por factura a un plan técnico por usos significativos de energía.').editAsText().setFontSize(9).setItalic(true);
}

function addFormulaAnnex_(body, rows, color) {
  addSection_(body, 'Fórmulas aplicadas', color);
  const t = body.appendTable([['Indicador', 'Fórmula']].concat(rows));
  styleTable_(t, color, 8);
  body.appendParagraph('');
}

function addDocumentControl_(body, d, codeId, documentType, color) {
  addSection_(body, 'Control documental', color);
  const t = body.appendTable([
    ['Tipo de documento', documentType],
    ['Versión metodológica', REPORT_VERSION],
    ['Código único', codeId],
    ['Fuente primaria', d.invoiceFileName],
    ['Periodo', d.billingPeriod],
    ['Estado', 'Preliminar · pendiente de validación institucional'],
    ['Próxima actualización', 'Al recibir nuevas facturas o evidencia técnica']
  ]);
  for (let r = 0; r < t.getNumRows(); r++) {
    t.getRow(r).getCell(0).setBackgroundColor('#F3F6F5');
    t.getRow(r).getCell(0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(color);
  }
  setTableFontSize_(t, 8);
  body.appendParagraph('');
}

function addIdentityBlock_(body, d, code, planCode, priority, color, lightColor) {
  const now = Utilities.formatDate(new Date(), TIMEZONE, 'd MMMM yyyy');

  // Banda de identidad inspirada en los informes SiMeCO₂ suministrados.
  const hero = body.appendTable([['', '']]);
  const left = hero.getCell(0,0);
  const right = hero.getCell(0,1);
  left.setBackgroundColor(color).setPaddingTop(9).setPaddingBottom(9).setPaddingLeft(10).setPaddingRight(8);
  right.setBackgroundColor(color).setPaddingTop(9).setPaddingBottom(9).setPaddingLeft(8).setPaddingRight(10);

  const p0 = left.getChild(0).asParagraph();
  p0.setText(planCode);
  p0.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#EAF7F2');
  const p1 = left.appendParagraph(d.institutionName);
  p1.editAsText().setFontFamily('Arial').setFontSize(13).setBold(true).setForegroundColor('#FFFFFF');
  const p2 = left.appendParagraph('🏫 ' + d.serviceAddress);
  p2.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#FFFFFF');
  if (d.city) {
    const p3 = left.appendParagraph('📍 ' + d.city);
    p3.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#EAF7F2');
  }

  const rp = right.getChild(0).asParagraph();
  rp.setText('Prioridad');
  rp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  rp.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#EAF7F2');
  const rp2 = right.appendParagraph(priority.replace(/^Prioridad\s*/i,''));
  rp2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  rp2.editAsText().setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor('#FFFFFF');
  body.appendParagraph('');

  const rows = [
    ['Fecha de generación', now],
    ['Periodo analizado', d.billingPeriod],
    ['Código del estudio', code],
    ['Factura soporte', d.invoiceFileName],
    ['Solicitante', d.fullName],
    ['Tipo de solicitante', d.requesterType],
    ['Oferta dirigida a', d.offerRecipientName + (d.offerRecipientRole ? ' · ' + d.offerRecipientRole : '')],
    ['Municipio final confirmado', d.city]
  ];
  if (d.cityWasCorrected && d.ocrCity) rows.push(['Municipio detectado por OCR', d.ocrCity]);
  if (d.contractNumber) rows.push(['Contrato / suscripción', d.contractNumber]);
  if (d.consumptionWasCorrected || d.tariffWasCorrected || d.cityWasCorrected) {
    rows.push(['Confirmación manual', [
      d.consumptionWasCorrected ? 'Consumo corregido' : '',
      d.tariffWasCorrected ? 'Tarifa corregida' : '',
      d.cityWasCorrected ? 'Municipio corregido' : ''
    ].filter(Boolean).join(' · ')]);
  }
  const table = body.appendTable(rows);
  for (let r = 0; r < table.getNumRows(); r++) {
    table.getRow(r).getCell(0).setBackgroundColor(lightColor);
    table.getRow(r).getCell(0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(color);
  }
  setTableFontSize_(table, 8);
  body.appendParagraph('');
}

function addSection_(body, title, color) {
  const p = body.appendParagraph(title);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  p.editAsText().setBold(true).setFontSize(13).setForegroundColor(color || BRAND_GREEN);
  p.setSpacingBefore(7);
  p.setSpacingAfter(3);
}

function addMetricTable_(body, rows, color, lightColor) {
  color = color || BRAND_GREEN;
  lightColor = lightColor || LIGHT_GREEN;
  const table = body.appendTable(rows);
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    row.getCell(0).setBackgroundColor(lightColor);
    row.getCell(0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(color);
    row.getCell(1).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(BRAND_DARK);
  }
  setTableFontSize_(table, 9);
  body.appendParagraph('');
  return table;
}

function styleTable_(table, headerColor, fontSize) {
  const row = table.getRow(0);
  for (let c = 0; c < row.getNumCells(); c++) {
    row.getCell(c).setBackgroundColor(headerColor);
    row.getCell(c).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor('#FFFFFF');
  }
  setTableFontSize_(table, fontSize || 8);
}

function setTableFontSize_(table, size) {
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      for (let i = 0; i < cell.getNumChildren(); i++) {
        const child = cell.getChild(i);
        if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
          child.asParagraph().editAsText().setFontFamily('Arial').setFontSize(size);
        }
      }
    }
  }
}

function addCallout_(body, text, backgroundColor, textColor) {
  const table = body.appendTable([[text]]);
  table.getCell(0, 0).setBackgroundColor(backgroundColor || LIGHT_LIME);
  table.getCell(0, 0).getChild(0).asParagraph().editAsText()
    .setFontFamily('Arial')
    .setFontSize(9)
    .setForegroundColor(textColor || '#365314');
  body.appendParagraph('');
}

function addActionCards_(body, items, backgroundColor, color) {
  items.forEach(function(item) {
    const t = body.appendTable([[item[0]], [item[1]]]);
    t.getCell(0, 0).setBackgroundColor(backgroundColor);
    t.getCell(0, 0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(color).setFontSize(9);
    t.getCell(1, 0).getChild(0).asParagraph().editAsText().setForegroundColor(BRAND_DARK).setFontSize(9);
    body.appendParagraph('');
  });
}

function addBullets_(body, items) {
  items.forEach(function(item) {
    const li = body.appendListItem(item);
    li.setGlyphType(DocumentApp.GlyphType.BULLET);
    li.editAsText().setFontFamily('Arial').setFontSize(10).setForegroundColor(BRAND_DARK);
  });
}

function addFooterNote_(body, text) {
  body.appendParagraph('');
  const p = body.appendParagraph(text);
  p.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#6B7D77').setItalic(true);
}

function addBrandSignature_(body, codeId) {
  body.appendParagraph('');
  const t = body.appendTable([
    ['Documento elaborado / acompañado por', AUTHOR_NAME],
    ['Proyecto', PROJECT_URL],
    ['E-mail', CONTACT_EMAIL],
    ['Móvil / WhatsApp', CONTACT_PHONE_DISPLAY],
    ['Código del estudio', codeId]
  ]);
  for (let r = 0; r < t.getNumRows(); r++) {
    t.getRow(r).getCell(0).setBackgroundColor(LIGHT_GREEN);
    t.getRow(r).getCell(0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(BRAND_GREEN);
  }
  setTableFontSize_(t, 8);
  try {
    const urlText = t.getRow(1).getCell(1).getChild(0).asParagraph().editAsText();
    if (urlText.getText()) urlText.setLinkUrl(0, urlText.getText().length - 1, PROJECT_URL);
    const emailText = t.getRow(2).getCell(1).getChild(0).asParagraph().editAsText();
    if (emailText.getText()) emailText.setLinkUrl(0, emailText.getText().length - 1, 'mailto:' + CONTACT_EMAIL);
    const phoneText = t.getRow(3).getCell(1).getChild(0).asParagraph().editAsText();
    if (phoneText.getText()) phoneText.setLinkUrl(0, phoneText.getText().length - 1, WHATSAPP_URL);
  } catch (_) {}
  body.appendParagraph('');
}

function buildColumnChart_(labels, values, title, color) {
  const table = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, 'Indicador').addColumn(Charts.ColumnType.NUMBER, 'Valor');
  for (let i = 0; i < labels.length; i++) table.addRow([labels[i], finiteOrZero_(values[i])]);

  return Charts.newColumnChart()
    .setDataTable(table.build())
    .setTitle(title)
    .setDimensions(700, 360)
    .setOption('legend', {position: 'none'})
    .setOption('colors', [color])
    .setOption('backgroundColor', '#FFFFFF')
    .setOption('chartArea', {left: 70, top: 55, width: '78%', height: '65%'})
    .setOption('hAxis', {textStyle: {fontSize: 10}})
    .setOption('vAxis', {minValue: 0, gridlines: {color: GRID}})
    .build();
}

function addChartImage_(body, chart, width, height) {
  try {
    const image = body.appendImage(chart.getAs('image/png'));
    image.setWidth(width || 480);
    image.setHeight(height || 250);
    body.appendParagraph('');
  } catch (err) {
    body.appendParagraph('No fue posible insertar la gráfica automáticamente. Los valores numéricos del plan permanecen válidos.').editAsText().setFontSize(8).setForegroundColor('#6B7D77');
  }
}

function exportDocAsPdfAndTrash_(doc, filename) {
  doc.saveAndClose();
  Utilities.sleep(600);
  const file = DriveApp.getFileById(doc.getId());
  const blob = file.getAs(MimeType.PDF).setName(filename);
  file.setTrashed(true);
  return blob;
}

/* =====================================================================
   BASE DE DATOS DE SOLICITUDES
   ===================================================================== */

function databaseHeaders_() {
  return [
    'Fecha y hora','Código estudio','Nombre solicitante','E-mail solicitante','WhatsApp solicitante',
    'Sede / institución','Dirección','Periodo','Contrato','Archivo factura',
    'Consumo energía (kWh)','Tarifa (COP/kWh)','Método tarifa','Valor energía usado (COP)',
    'Agua (m³)','Gas (m³)','Cobertura objetivo (%)','Potencia solar (kWp)','Módulos',
    'Área requerida (m²)','Generación solar (kWh/mes)','Cobertura solar real (%)',
    'Ahorro mensual (COP)','Ahorro anual (COP)','CO₂e evitado (t/año)','Árboles equivalentes',
    'Valor proyecto (COP)','Valor por kWp (COP)','ROI simple (%)','Recuperación simple (años)',
    'Tasa financiación M.V. (%)','Tasa financiación E.A. (%)','Cuota 48 meses','Cuota 60 meses',
    'Cuota 120 meses','Consentimiento','Versión consentimiento','Estado envío','Ciudad / municipio',
    'Tipo de solicitante','Oferta dirigida a','Cargo destinatario','Notas u observaciones',
    'Consumo detectado OCR (kWh)','Tarifa detectada OCR (COP/kWh)','Valor bruto energía OCR (COP)',
    'Consumo corregido manualmente','Tarifa corregida manualmente','Fuente consumo final','Fuente tarifa final',
    'Municipio detectado OCR','Municipio corregido manualmente','Fuente municipio final',
    'Autorización compartir con GSV','Finalidad autorizada GSV','Fecha límite de conservación',
    'Trazabilidad económica y financiera'
  ];
}

function ensureDatabaseSheet_(ss) {
  if (!ss || ss.getId() !== DATABASE_SPREADSHEET_ID) {
    throw new Error('La hoja de cálculo configurada no coincide con DATABASE_SPREADSHEET_ID.');
  }

  let sheet = ss.getSheetByName(DATABASE_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(DATABASE_SHEET_NAME);

  const headers = databaseHeaders_();
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  const minColumns = DRIVE_LINK_COLUMN_START + DRIVE_LINK_HEADERS.length - 1;
  if (sheet.getMaxColumns() < minColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), minColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < 2) sheet.insertRowsAfter(sheet.getMaxRows(), 2 - sheet.getMaxRows());

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  ensureDriveLinkHeaders_(sheet);
  ensureEducationalMetricHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#0B5D45')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  return sheet;
}

function ensureDriveLinkHeaders_(sheet) {
  sheet.getRange(1, DRIVE_LINK_COLUMN_START, 1, DRIVE_LINK_HEADERS.length)
    .setValues([DRIVE_LINK_HEADERS])
    .setBackground('#0B5D45')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  for (let i = 0; i < DRIVE_LINK_HEADERS.length; i++) {
    sheet.setColumnWidth(DRIVE_LINK_COLUMN_START + i, i === 0 ? 250 : 210);
  }
}

function ensureEducationalMetricHeaders_(sheet) {
  const endCol = EDUCATIONAL_METRIC_COLUMN_START + EDUCATIONAL_METRIC_HEADERS.length - 1;
  if (sheet.getMaxColumns() < endCol) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), endCol - sheet.getMaxColumns());
  }
  sheet.getRange(1, EDUCATIONAL_METRIC_COLUMN_START, 1, EDUCATIONAL_METRIC_HEADERS.length)
    .setValues([EDUCATIONAL_METRIC_HEADERS])
    .setBackground('#0B5D45')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setColumnWidth(EDUCATIONAL_METRIC_COLUMN_START, 150);
  sheet.setColumnWidth(EDUCATIONAL_METRIC_COLUMN_START + 1, 170);
}

function writeEducationalMetrics_(sheet, row, d) {
  if (!sheet || !row) return;
  ensureEducationalMetricHeaders_(sheet);
  sheet.getRange(row, EDUCATIONAL_METRIC_COLUMN_START, 1, EDUCATIONAL_METRIC_HEADERS.length)
    .setValues([[finiteOrZero_(d.studentCount), finiteOrZero_(d.energyKwhPerStudent)]]);
  sheet.getRange(row, EDUCATIONAL_METRIC_COLUMN_START).setNumberFormat('#,##0');
  sheet.getRange(row, EDUCATIONAL_METRIC_COLUMN_START + 1).setNumberFormat('#,##0.000');
}

function buildDatabaseRow_(d, codeId, status) {
  return [
    new Date(),
    codeId,
    cleanText_(d.fullName),
    cleanText_(d.email),
    cleanText_(d.whatsapp),
    cleanText_(d.institutionName),
    cleanText_(d.serviceAddress),
    cleanText_(d.billingPeriod),
    cleanText_(d.contractNumber),
    cleanText_(d.invoiceFileName),
    finiteOrZero_(d.consumption),
    finiteOrZero_(d.tariff),
    cleanText_(d.tariffMethod || ''),
    finiteOrZero_(d.monthlyBillApprox),
    finiteOrZero_(d.waterM3),
    finiteOrZero_(d.gasM3),
    finiteOrZero_(d.coverage),
    finiteOrZero_(d.kwp),
    finiteOrZero_(d.panels),
    finiteOrZero_(d.area),
    finiteOrZero_(d.generationMonthly),
    finiteOrZero_(d.actualCoverage),
    finiteOrZero_(d.monthlySaving),
    finiteOrZero_(d.annualSaving),
    finiteOrZero_(d.solarCo2),
    finiteOrZero_(d.solarTrees),
    finiteOrZero_(d.projectValue),
    finiteOrZero_(d.valuePerKwp),
    finiteOrZero_(d.simpleRoi),
    finiteOrZero_(d.simplePayback),
    finiteOrZero_(d.financeRateMV),
    finiteOrZero_(d.financeRateEA),
    finiteOrZero_(d.finance48),
    finiteOrZero_(d.finance60),
    finiteOrZero_(d.finance120),
    d.consent === true ? 'Sí' : 'No',
    cleanText_(d.consentVersion || ''),
    cleanText_(status || 'Procesando'),
    cleanText_(d.city || ''),
    cleanText_(d.requesterType || ''),
    cleanText_(d.offerRecipientName || ''),
    cleanText_(d.offerRecipientRole || ''),
    truncateText_(d.notes || '', 2000),
    finiteOrZero_(d.ocrConsumption),
    finiteOrZero_(d.ocrTariff),
    finiteOrZero_(d.ocrEnergyCharge),
    d.consumptionWasCorrected ? 'Sí' : 'No',
    d.tariffWasCorrected ? 'Sí' : 'No',
    cleanText_(d.consumptionSource || ''),
    cleanText_(d.tariffFinalSource || ''),
    cleanText_(d.ocrCity || ''),
    d.cityWasCorrected ? 'Sí' : 'No',
    cleanText_(d.citySource || ''),
    d.gsvConsent === true ? 'Sí' : 'No',
    d.gsvConsent === true ? 'Propuesta técnico-comercial relacionada con el estudio SiMeCO₂' : 'No autorizada',
    d.retentionUntil instanceof Date ? d.retentionUntil : '',
    economicTraceabilitySummary_(d)
  ];
}

function economicTraceabilitySummary_(d) {
  return [
    'Económica ' + cleanText_(d.economicReferenceVersion || SOLAR_ECONOMIC_REFERENCE_VERSION),
    'fecha fuente: ' + cleanText_(d.economicReferenceSourceDate || SOLAR_ECONOMIC_REFERENCE_SOURCE_DATE),
    'integrada: ' + cleanText_(d.economicReferenceIntegratedAt || SOLAR_ECONOMIC_REFERENCE_INTEGRATED_AT),
    'método: ' + cleanText_(d.priceReferenceType || 'tabla/interpolación/extrapolación'),
    d.priceExtrapolated ? 'valor extrapolado' : 'valor dentro de tabla/interpolado',
    'Financiera ' + cleanText_(d.financeModelVersion || SOLAR_FINANCE_MODEL_VERSION),
    'fecha fuente: ' + cleanText_(d.financeReferenceSourceDate || SOLAR_FINANCE_REFERENCE_SOURCE_DATE),
    'no es tasa bancaria vigente'
  ].join(' | ');
}

function registerStudyRequest_(d, codeId, status) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let ss;
    try {
      ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    } catch (openErr) {
      throw new Error(
        'No se pudo abrir la hoja de cálculo ' + DATABASE_SPREADSHEET_ID + '. ' +
        'La cuenta que implementó la Web App debe autorizar Google Sheets. ' +
        'Desde el editor ejecuta una vez la función privada autorizarSiMeCO2_(), acepta TODOS los permisos y luego vuelve a implementar una nueva versión. ' +
        'También verifica que esa misma cuenta tenga acceso de edición a la base. Detalle: ' +
        (openErr && openErr.message ? openErr.message : openErr)
      );
    }

    try { ss.setSpreadsheetTimeZone(TIMEZONE); } catch (_) {}
    const sheet = ensureDatabaseSheet_(ss);
    const row = buildDatabaseRow_(d, codeId, status);

    let nextRow = Math.max(sheet.getLastRow() + 1, 2);
    if (nextRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), nextRow - sheet.getMaxRows());

    // setValues en un rango exacto es más verificable que appendRow().
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
    writeEducationalMetrics_(sheet, nextRow, d);
    sheet.getRange(nextRow, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(nextRow, 11, 1, 12).setNumberFormat('#,##0.00');
    sheet.getRange(nextRow, 23, 1, 2).setNumberFormat('$ #,##0');
    sheet.getRange(nextRow, 25, 1, 2).setNumberFormat('#,##0.000');
    sheet.getRange(nextRow, 27, 1, 2).setNumberFormat('$ #,##0');
    sheet.getRange(nextRow, 29, 1, 4).setNumberFormat('#,##0.00');
    sheet.getRange(nextRow, 33, 1, 3).setNumberFormat('$ #,##0');
    sheet.getRange(nextRow, 44, 1, 2).setNumberFormat('#,##0.00');
    sheet.getRange(nextRow, 46).setNumberFormat('$ #,##0');
    sheet.getRange(nextRow, 56).setNumberFormat('yyyy-mm-dd');
    SpreadsheetApp.flush();

    // Verificación de lectura inmediata: no asumimos que el guardado funcionó.
    const savedCode = String(sheet.getRange(nextRow, 2).getDisplayValue() || '').trim();
    const savedEmail = String(sheet.getRange(nextRow, 4).getDisplayValue() || '').trim();
    if (savedCode !== String(codeId) || savedEmail.toLowerCase() !== String(d.email || '').toLowerCase()) {
      throw new Error('La escritura en Google Sheets no pudo verificarse después de guardar la fila ' + nextRow + '.');
    }

    // El resumen es útil, pero nunca debe impedir que la fila principal quede guardada.
    try {
      ensureDatabaseSummary_(ss);
      SpreadsheetApp.flush();
    } catch (summaryErr) {
      console.error('SiMeCO₂: la solicitud sí quedó guardada, pero no se pudo actualizar la hoja Resumen.', summaryErr);
    }

    return {
      ok: true,
      row: nextRow,
      codeId: codeId,
      sheetName: DATABASE_SHEET_NAME,
      spreadsheetId: DATABASE_SPREADSHEET_ID,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + DATABASE_SPREADSHEET_ID + '/edit'
    };
  } finally {
    lock.releaseLock();
  }
}

function updateStudyRequestStatus_(dbRef, status) {
  if (!dbRef || !dbRef.codeId) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    const sheet = ensureDatabaseSheet_(ss);
    const lastRow = sheet.getLastRow();
    let targetRow = Number(dbRef.row) || 0;

    // Confirmar que la fila aún corresponde al código. Si no, localizarla.
    if (targetRow < 2 || targetRow > lastRow || String(sheet.getRange(targetRow, 2).getDisplayValue()) !== String(dbRef.codeId)) {
      if (lastRow >= 2) {
        const finder = sheet.getRange(2, 2, lastRow - 1, 1)
          .createTextFinder(String(dbRef.codeId))
          .matchEntireCell(true)
          .findNext();
        targetRow = finder ? finder.getRow() : 0;
      }
    }
    if (!targetRow) throw new Error('No se encontró el registro ' + dbRef.codeId + ' para actualizar su estado.');

    const statusColumn = databaseHeaders_().indexOf('Estado envío') + 1;
    if (!statusColumn) throw new Error('No se encontró la columna Estado envío.');
    sheet.getRange(targetRow, statusColumn).setValue(cleanText_(status || 'Enviado'));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
   SINCRONIZACIÓN CON EL DASHBOARD COMERCIAL
   ===================================================================== */

function dashboardRequiredHeaders_() {
  return [
    'Marca temporal',
    'Correo',
    'Nombre del asesor o persona que remite la solicitud',
    'Tipo de cliente',
    'Cliente/sede analizada en la factura',
    'Destinatario formal de la oferta',
    'Cargo del destinatario',
    'Correo electrónico del cliente',
    'WhatsApp o teléfono de contacto',
    'Municipio',
    'Dirección',
    'Número de contrato de energía',
    'Factura de energía más reciente',
    'Propiedad propia o arrendada',
    'Valor promedio mensual de la factura',
    'Consumo mensual aproximado en kWh',
    '¿Tiene espacio disponible en techo, terraza o lote?',
    'Tipo de cubierta',
    'Interés principal',
    '¿Desea modelo con inversión propia o cero inversión?',
    'Observaciones',
    'Nota escrita por el usuario',
    'Nota visible del formulario',
    'Autorización para análisis de factura y tratamiento de datos',
    DASHBOARD_GSV_HEADER,
    'Estado de gestión',
    'Fecha de contacto',
    'Responsable',
    'Resultado / seguimiento',
    'Dimensionamiento PDF',
    'Estado dimensionamiento',
    'Fecha carga dimensionamiento',
    'Fecha envío dimensionamiento',
    'Enviado por',
    'Error dimensionamiento',
    'Historial dimensionamientos',
    'Notas internas dashboard',
    'Fecha programada seguimiento',
    'Estado seguimiento',
    'Fecha envío seguimiento',
    'Error seguimiento'
  ];
}

function dashboardHeaderAliases_() {
  return {
    'Cliente/sede analizada en la factura': [
      'Cliente/sede analizada en la factura',
      'Cliente / sede analizada en la factura',
      'Solicitante/sede analizada en la factura',
      'Solicitante / sede analizada en la factura'
    ],
    'Correo': [
      'Correo',
      'Correo electrónico'
    ],
    'Número de contrato de energía': [
      'Número de contrato de energía',
      'N.º contrato de energía',
      'No. contrato de energía'
    ]
  };
}

function normalizeDashboardHeader_(value) {
  return cleanText_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getDashboardHeaderCandidates_(requiredHeader) {
  const aliases = dashboardHeaderAliases_()[requiredHeader] || [requiredHeader];
  return aliases.map(normalizeDashboardHeader_);
}

function findDashboardHeaderIndex_(headers, requiredHeader) {
  const candidates = getDashboardHeaderCandidates_(requiredHeader);

  for (let i = 0; i < headers.length; i++) {
    if (candidates.indexOf(normalizeDashboardHeader_(headers[i])) !== -1) {
      return i;
    }
  }
  return -1;
}

function hasDashboardHeader_(headers, requiredHeader) {
  if (findDashboardHeaderIndex_(headers, requiredHeader) !== -1) return true;

  const requiredNormalized = normalizeDashboardHeader_(requiredHeader);
  return headers.some(function(header) {
    return normalizeDashboardHeader_(header) === requiredNormalized;
  });
}

function getDashboardSheet_() {
  const ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);

  if (!sheet) {
    throw new Error(
      'No se encontró la hoja de dashboard “' + DASHBOARD_SHEET_NAME + '”.'
    );
  }

  let lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(cleanText_);

  // La autorización GSV es una columna nueva de control.
  // Se crea automáticamente una sola vez si todavía no existe.
  if (!hasDashboardHeader_(headers, DASHBOARD_GSV_HEADER)) {
    sheet.getRange(1, lastColumn + 1).setValue(DASHBOARD_GSV_HEADER);
    SpreadsheetApp.flush();

    lastColumn = sheet.getLastColumn();
    headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(cleanText_);
  }

  // IMPORTANTE:
  // Se valida por alias. El dashboard existente usa
  // "Cliente/sede analizada en la factura", mientras el formulario
  // trabaja conceptualmente con "Solicitante/sede analizada en la factura".
  const missing = dashboardRequiredHeaders_().filter(function(requiredHeader) {
    return !hasDashboardHeader_(headers, requiredHeader);
  });

  if (missing.length) {
    throw new Error(
      'El dashboard no tiene todas las columnas requeridas. Faltan: ' +
      missing.join(', ')
    );
  }

  return {
    spreadsheet: ss,
    sheet: sheet,
    headers: headers
  };
}


/**
 * Función pública para ejecutar desde el selector de Apps Script.
 * La versión con "_" final se mantiene como implementación interna.
 */
function verVersionFormulario() {
  Logger.log(APP_BUILD);
  return APP_BUILD;
}

function diagnosticarConexionDashboard() {
  const result = diagnosticarConexionDashboard_();

  Logger.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error(
      'Diagnóstico del dashboard incompleto. Faltan: ' +
      (result.missing.length ? result.missing.join(', ') : 'columnas no identificadas')
    );
  }

  return result;
}

function diagnosticarConexionDashboard_() {
  const result = {
    ok: false,
    build: APP_BUILD,
    spreadsheetId: DASHBOARD_SPREADSHEET_ID,
    sheetName: DASHBOARD_SHEET_NAME,
    missing: [],
    resolvedHeaders: {},
    actualHeaders: []
  };

  const dashboard = getDashboardSheet_();
  const headers = dashboard.headers;
  result.actualHeaders = headers.slice();

  dashboardRequiredHeaders_().forEach(function(requiredHeader) {
    const index = findDashboardHeaderIndex_(headers, requiredHeader);
    if (index === -1) {
      result.missing.push(requiredHeader);
    } else {
      result.resolvedHeaders[requiredHeader] = headers[index];
    }
  });

  result.ok = result.missing.length === 0;
  return result;
}

function dashboardObservation_(d, codeId, expediente) {
  return [
    'Registro automático generado desde la Web App SiMeCO₂.',
    'Código estudio: ' + codeId,
    'Periodo: ' + cleanText_(d.billingPeriod),
    'Potencia solar preliminar: ' + fmt_(d.kwp, 1) + ' kWp',
    'Módulos estimados: ' + fmt_(d.panels, 0),
    'Generación estimada: ' + fmt_(d.generationMonthly, 0) + ' kWh/mes',
    d.isEducationalRequester ? 'Estudiantes: ' + (d.studentCount ? fmt_(d.studentCount, 0) : 'No reportado') : '',
    d.isEducationalRequester ? 'Indicador educativo: ' + (d.energyKwhPerStudent ? fmt_(d.energyKwhPerStudent, 3) + ' kWh/mes por estudiante' : 'Pendiente') : '',
    'Valor referencial: ' + money_(d.projectValue),
    'Ahorro mensual estimado: ' + money_(d.monthlySaving),
    'Expediente Drive: ' + expediente.folderUrl,
    'PDF solar: ' + expediente.solarUrl
  ].join('\n');
}

function dashboardFollowUp_(codeId, expediente) {
  return [
    'Solicitud creada automáticamente desde la Web App SiMeCO₂.',
    'Código estudio: ' + codeId,
    'Revisar factura, cubierta, titularidad del inmueble, modelo financiero y agendar contacto comercial.',
    'Expediente: ' + expediente.folderUrl
  ].join('\n');
}

function dashboardHistory_(d, expediente, status, sentAt, errorMessage) {
  return JSON.stringify([{
    version: 1,
    fileName: 'Predimensionamiento solar · ' + cleanText_(d.institutionName),
    fileUrl: expediente && expediente.solarUrl ? expediente.solarUrl : '',
    uploadedAt: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss'),
    sentAt: sentAt || '',
    sentBy: sentAt ? COPY_EMAIL : '',
    sentTo: cleanText_(d.email),
    copyTo: COPY_EMAIL,
    status: status,
    error: cleanText_(errorMessage || '')
  }]);
}

function registerDashboardRequest_(d, codeId, expediente) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const dashboard = getDashboardSheet_();
    const sheet = dashboard.sheet;
    const headers = dashboard.headers;
    const now = new Date();
    const valuesByHeader = {
      'Marca temporal': now,
      'Correo': cleanText_(d.email),
      'Nombre del asesor o persona que remite la solicitud': cleanText_(d.fullName),
      'Tipo de cliente': cleanText_(d.requesterType || 'No informado'),
      'Solicitante/sede analizada en la factura': cleanText_(d.institutionName),
      'Cliente/sede analizada en la factura': cleanText_(d.institutionName),
      'Destinatario formal de la oferta': cleanText_(d.offerRecipientName || d.institutionName),
      'Cargo del destinatario': cleanText_(d.offerRecipientRole || ''),
      'Correo electrónico del cliente': cleanText_(d.email),
      'WhatsApp o teléfono de contacto': cleanText_(d.whatsapp),
      'Municipio': cleanText_(d.city),
      'Dirección': cleanText_(d.serviceAddress),
      'Número de contrato de energía': cleanText_(d.contractNumber),
      'Factura de energía más reciente': expediente.facturaUrl,
      'Propiedad propia o arrendada': 'Pendiente de confirmar',
      'Valor promedio mensual de la factura': finiteOrZero_(d.monthlyBillApprox),
      'Consumo mensual aproximado en kWh': finiteOrZero_(d.consumption),
      '¿Tiene espacio disponible en techo, terraza o lote?': 'Pendiente de visita técnica',
      'Tipo de cubierta': 'Pendiente de visita técnica',
      'Interés principal': 'Diagnóstico de huella de carbono; Oferta solar; Predimensionamiento solar; Planes de energía, agua y gas',
      '¿Desea modelo con inversión propia o cero inversión?': 'Comparar inversión propia y cero inversión',
      'Observaciones': dashboardObservation_(d, codeId, expediente),
      'Nota escrita por el usuario': truncateText_(d.notes || '', 2000),
      'Nota visible del formulario': truncateText_(d.notes || '', 2000),
      'Autorización para análisis de factura y tratamiento de datos': d.consent === true ? 'Sí' : 'No',
    [DASHBOARD_GSV_HEADER]: d.gsvConsent === true ? 'SÍ · AUTORIZADO' : 'No',
      'Estado de gestión': d.gsvConsent === true ? DASHBOARD_GSV_PRIORITY_STATUS : 'Nuevo',
      'Fecha de contacto': '',
      'Responsable': '',
      'Resultado / seguimiento': dashboardFollowUp_(codeId, expediente),
      'Dimensionamiento PDF': expediente.solarUrl,
      'Estado dimensionamiento': 'Generado · pendiente de envío',
      'Fecha carga dimensionamiento': now,
      'Fecha envío dimensionamiento': '',
      'Enviado por': '',
      'Error dimensionamiento': '',
      'Historial dimensionamientos': dashboardHistory_(d, expediente, 'Generado · pendiente de envío', '', ''),
      'Notas internas dashboard': d.gsvConsent === true
      ? JSON.stringify([{
          note: 'GSV AUTORIZADO por el solicitante. Priorizar contacto técnico-comercial.',
          createdAt: Utilities.formatDate(now, TIMEZONE, 'dd/MM/yyyy HH:mm:ss'),
          createdBy: 'Formulario Web App'
        }])
      : '',
      'Fecha programada seguimiento': '',
      'Estado seguimiento': 'Pendiente',
      'Fecha envío seguimiento': '',
      'Error seguimiento': ''
    };
    const row = headers.map(function(actualHeader) {
      if (Object.prototype.hasOwnProperty.call(valuesByHeader, actualHeader)) {
        return valuesByHeader[actualHeader];
      }

      // Si la hoja usa un alias, buscar el nombre canónico correspondiente.
      const canonicalHeaders = Object.keys(dashboardHeaderAliases_());
      for (let i = 0; i < canonicalHeaders.length; i++) {
        const canonical = canonicalHeaders[i];
        const candidates = dashboardHeaderAliases_()[canonical] || [];
        const normalizedActual = normalizeDashboardHeader_(actualHeader);

        const matchesAlias = candidates.some(function(alias) {
          return normalizeDashboardHeader_(alias) === normalizedActual;
        });

        if (matchesAlias && Object.prototype.hasOwnProperty.call(valuesByHeader, canonical)) {
          return valuesByHeader[canonical];
        }
      }

      return '';
    });
    const nextRow = Math.max(sheet.getLastRow() + 1, 2);
    if (nextRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), nextRow - sheet.getMaxRows());
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

  // Resaltar visualmente los prospectos que autorizaron escalamiento a GSV.
  if (d.gsvConsent === true) {
    const fullRowRange = sheet.getRange(nextRow, 1, 1, row.length);
    fullRowRange.setBackground('#E8F7F1');

    const gsvCol = findDashboardHeaderIndex_(headers, DASHBOARD_GSV_HEADER) + 1;
    if (gsvCol > 0) {
      sheet.getRange(nextRow, gsvCol)
        .setBackground('#0B7A55')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    }

    const statusCol = findDashboardHeaderIndex_(headers, 'Estado de gestión') + 1;
    if (statusCol > 0) {
      sheet.getRange(nextRow, statusCol)
        .setBackground('#0B7A55')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    }
  }
    sheet.getRange(nextRow, findDashboardHeaderIndex_(headers, 'Marca temporal') + 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    SpreadsheetApp.flush();

    const observationColumn = findDashboardHeaderIndex_(headers, 'Observaciones') + 1;
    if (String(sheet.getRange(nextRow, observationColumn).getDisplayValue()).indexOf(codeId) === -1) {
      throw new Error('No se pudo verificar el código del estudio después de escribir la fila ' + nextRow + '.');
    }
    return {
      row: nextRow,
      codeId: codeId,
      spreadsheetId: DASHBOARD_SPREADSHEET_ID,
      sheetName: DASHBOARD_SHEET_NAME,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + DASHBOARD_SPREADSHEET_ID + '/edit'
    };
  } finally {
    lock.releaseLock();
  }
}

function findDashboardRowByCode_(sheet, headers, dashboardRef) {
  const observationColumn = findDashboardHeaderIndex_(headers, 'Observaciones') + 1;
  if (observationColumn <= 0) {
    throw new Error('No se encontró la columna “Observaciones” en el dashboard.');
  }

  const lastRow = sheet.getLastRow();
  let row = Number(dashboardRef && dashboardRef.row) || 0;

  if (
    row >= 2 &&
    row <= lastRow &&
    String(sheet.getRange(row, observationColumn).getDisplayValue())
      .indexOf(dashboardRef.codeId) !== -1
  ) {
    return row;
  }

  if (lastRow < 2) return 0;

  const finder = sheet
    .getRange(2, observationColumn, lastRow - 1, 1)
    .createTextFinder(String(dashboardRef.codeId))
    .matchCase(true)
    .useRegularExpression(false)
    .findNext();

  return finder ? finder.getRow() : 0;
}

function updateDashboardDelivery_(dashboardRef, d, expediente, status, errorMessage) {
  if (!dashboardRef || !dashboardRef.codeId) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const dashboard = getDashboardSheet_();
    const row = findDashboardRowByCode_(dashboard.sheet, dashboard.headers, dashboardRef);
    if (!row) throw new Error('No se encontró el registro ' + dashboardRef.codeId + ' en el dashboard.');

    const sentSuccessfully = String(status).indexOf('Enviado') === 0;
    const sentAt = sentSuccessfully ? new Date() : '';
    const updates = {
      'Estado dimensionamiento': status,
      'Fecha envío dimensionamiento': sentAt,
      'Enviado por': sentSuccessfully ? COPY_EMAIL : '',
      'Error dimensionamiento': cleanText_(errorMessage || ''),
      'Historial dimensionamientos': dashboardHistory_(
        d,
        expediente,
        status,
        sentSuccessfully ? Utilities.formatDate(sentAt, TIMEZONE, 'dd/MM/yyyy HH:mm:ss') : '',
        errorMessage
      )
    };
    Object.keys(updates).forEach(function(header) {
      const column = findDashboardHeaderIndex_(dashboard.headers, header) + 1;
      dashboard.sheet.getRange(row, column).setValue(updates[header]);
    });
    if (sentAt) {
      dashboard.sheet.getRange(row, findDashboardHeaderIndex_(dashboard.headers, 'Fecha envío dimensionamiento') + 1)
        .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function createStudyExpediente_(d, codeId, files) {
  const parent = DriveApp.getFolderById(DATABASE_FOLDER_ID);
  const folderName = [
    codeId,
    safeName_(d.institutionName || 'Sin_institucion'),
    Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss')
  ].join(' · ');
  const folder = parent.createFolder(folderName);

  const invoiceBlobs = Array.isArray(files.invoiceBlobs) && files.invoiceBlobs.length
    ? files.invoiceBlobs
    : [files.invoiceBlob];
  const facturas = invoiceBlobs.map(function(blob, index) {
    const prefix = String(index + 1).padStart(2, '0');
    return saveBlobInFolder_(folder, blob, '01_' + prefix + '_Factura_servicio_' + safeName_(d.institutionName) + '.pdf');
  });
  const gei = saveBlobInFolder_(folder, files.energyPlan, '02_Plan_reduccion_GEI_' + safeName_(d.institutionName) + '.pdf');
  const agua = saveBlobInFolder_(folder, files.waterPlan, '03_Plan_ahorro_agua_' + safeName_(d.institutionName) + '.pdf');
  const gas = saveBlobInFolder_(folder, files.gasPlan, '04_Plan_ahorro_gas_' + safeName_(d.institutionName) + '.pdf');
  const solar = saveBlobInFolder_(folder, files.solarPdf, '05_Predimensionamiento_solar_' + safeName_(d.institutionName) + '.pdf');
  const reductionPlanSheet = d.isEducationalRequester
    ? createReductionPlanGoogleSheet_(folder, d, codeId)
    : null;
  const requesterAccessGranted = grantPrivateFolderAccess_(folder, d.email);
  if (reductionPlanSheet && d.email) grantEditableFileAccess_(reductionPlanSheet, d.email);

  return {
    folderUrl: folder.getUrl(),
    requesterAccessGranted: requesterAccessGranted,
    facturaUrl: facturas[0].getUrl(),
    geiUrl: gei.getUrl(),
    aguaUrl: agua.getUrl(),
    gasUrl: gas.getUrl(),
    solarUrl: solar.getUrl(),
    reductionPlanSheetUrl: reductionPlanSheet ? reductionPlanSheet.getUrl() : '',
    reductionPlanSheetId: reductionPlanSheet ? reductionPlanSheet.getId() : ''
  };
}

function selectEmailAttachments_(reportBlobs, invoiceBlobs) {
  // Gmail admite aproximadamente 25 MB por mensaje. Se usa un margen para la
  // codificación del correo; todos los originales se guardan siempre en Drive.
  const safeLimit = 18 * 1024 * 1024;
  const selected = (reportBlobs || []).slice();
  const includedInvoiceNames = [];
  const omittedInvoiceNames = [];
  let used = selected.reduce(function(total, blob) {
    return total + (blob && blob.getBytes ? blob.getBytes().length : 0);
  }, 0);

  (invoiceBlobs || []).forEach(function(blob) {
    const bytes = blob && blob.getBytes ? blob.getBytes().length : 0;
    if (used + bytes <= safeLimit) {
      selected.push(blob);
      used += bytes;
      includedInvoiceNames.push(safeAttachmentName_(blob && blob.getName && blob.getName(), 'Factura_servicio'));
    } else {
      omittedInvoiceNames.push(safeAttachmentName_(blob && blob.getName && blob.getName(), 'Factura_servicio'));
    }
  });
  return {
    attachments: selected,
    includedInvoiceNames: includedInvoiceNames,
    omittedInvoiceNames: omittedInvoiceNames,
    totalBytes: used
  };
}

/**
 * Comparte el expediente únicamente con el correo solicitante. Nunca convierte
 * la carpeta en pública ni habilita acceso anónimo por enlace.
 */
function grantPrivateFolderAccess_(folder, email) {
  const recipient = String(email || '').trim();
  if (!folder || !recipient) return false;
  return grantDrivePermissionSilently_(folder.getId(), recipient, 'reader', 'expediente privado');
}

function grantEditableFileAccess_(file, email) {
  const recipient = String(email || '').trim();
  if (!file || !recipient) return false;
  return grantDrivePermissionSilently_(file.getId(), recipient, 'writer', 'archivo editable');
}

function grantDrivePermissionSilently_(fileId, email, role, label) {
  const recipient = String(email || '').trim();
  const targetId = String(fileId || '').trim();
  if (!targetId || !recipient) return false;
  try {
    Drive.Permissions.create(
      {
        type: 'user',
        role: role,
        emailAddress: recipient
      },
      targetId,
      {
        sendNotificationEmail: false,
        supportsAllDrives: true
      }
    );
    return true;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (/already|exist|duplicate|permiso ya existe|ya existe/i.test(message)) return true;
    console.warn('SiMeCO₂: Drive no permitió compartir sin notificación el ' + label + ' ' + targetId + '. ' + message);
    return false;
  }
}

function createReductionPlanGoogleSheet_(folder, d, codeId) {
  if (!folder) throw new Error('No se recibió la carpeta para crear el Plan de Reducciones GEI.');
  const planYear = new Date().getFullYear();
  const nextYear = planYear + 1;
  const institution = cleanText_(d.institutionName) || 'Institución educativa';
  const studentCount = finiteOrZero_(d.studentCount);
  const kwhStudent = finiteOrZero_(d.energyKwhPerStudent);
  const annualCarbon = finiteOrZero_(d.annualCarbon);
  const ss = SpreadsheetApp.create('06_Plan_Reducciones_GEI_' + planYear + '_' + safeName_(institution));
  const sheet = ss.getSheets()[0];
  sheet.setName('Plan Reducciones GEI');
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(5);
  sheet.getRange('A:I').setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  sheet.setColumnWidths(1, 1, 28);
  sheet.setColumnWidths(2, 1, 180);
  sheet.setColumnWidths(3, 7, 118);
  sheet.setRowHeights(1, 55, 28);

  sheet.getRange('B1:B4').merge().setValue('LOGO ESCUELA SOSTENIBLE')
    .setBackground('#E8F3ED').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true);
  sheet.getRange('C1:G1').merge().setValue('Plan de Reducciones para el año ' + planYear)
    .setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('C2:G2').merge().setValue(institution)
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('C3').setValue('Elaborado:').setFontWeight('bold');
  sheet.getRange('D3:G3').merge().setValue(AUTHOR_NAME + ' | www.losyoguis.com').setWrap(true);
  sheet.getRange('C4').setValue('Aprobado:').setFontWeight('bold');
  sheet.getRange('D4:G4').merge().setValue(cleanText_(d.offerRecipientName || 'Pendiente de aprobación institucional')).setWrap(true);
  sheet.getRange('H1:I1').merge().setValue('Código: GEI-R-001').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('H2:I2').merge().setValue('Edición: 01').setHorizontalAlignment('center');
  sheet.getRange('H3:I3').merge().setValue('Fecha de aprobación: pendiente').setHorizontalAlignment('center').setWrap(true);
  sheet.getRange('H4:I4').merge().setValue('Estudio: ' + codeId).setHorizontalAlignment('center');
  sheet.getRange('B1:I4').setBorder(true, true, true, true, true, true, '#111111', SpreadsheetApp.BorderStyle.SOLID);

  const populationRows = [
    ['Población', 'Directivos Docentes', 'Docentes', 'Estudiantes', 'Auxiliares Admon', 'Profesionales', 'Otros', 'Total'],
    ['', 0, 0, studentCount || '', 0, 0, 0, studentCount || '']
  ];
  sheet.getRange(6, 2, 2, 8).setValues(populationRows);
  styleSheetBlock_(sheet, 6, 2, 2, 8);

  const energyRows = [
    ['Energía Eléctrica', '# Salas Cómputo', '# Computadores', '# Lámparas', '# Tiendas', '# Refrigeradores', '# Laboratorios', 'Otros'],
    ['', 0, 0, 0, 0, 0, 0, 0]
  ];
  sheet.getRange(9, 2, 2, 8).setValues(energyRows);
  styleSheetBlock_(sheet, 9, 2, 2, 8);

  const dataRows = [
    ['Datos base SiMeCO₂', 'Valor', 'Observación'],
    ['Consumo energía factura', fmt_(finiteOrZero_(d.consumption), 2) + ' kWh/mes', 'Dato extraído o confirmado desde la factura cargada.'],
    ['Número de estudiantes', studentCount ? fmt_(studentCount, 0) : 'No reportado', 'Campo opcional para instituciones educativas, colegios privados y universidades.'],
    ['kWh/mes por estudiante', kwhStudent ? fmt_(kwhStudent, 3) : 'Pendiente', 'Consumo kWh/mes de la factura dividido por número de estudiantes.'],
    ['Emisiones año base calculadas', fmt_(annualCarbon, 3) + ' t CO₂e/año', 'Indicador preliminar de planeación, no verificación de ahorro.']
  ];
  sheet.getRange(12, 2, dataRows.length, 3).setValues(dataRows);
  styleSheetBlock_(sheet, 12, 2, dataRows.length, 3);
  sheet.getRange(13, 4, 4, 1).setWrap(true);

  const narrativeRows = [
    ['Declaración de la Alta Dirección:', 'El establecimiento educativo se compromete a asignar responsables, recursos y seguimiento para gestionar eficientemente la energía y reducir las emisiones de GEI asociadas al consumo eléctrico.'],
    ['Objetivo General:', 'Reducir las emisiones de GEI mediante eficiencia energética, cultura institucional, seguimiento de indicadores y evaluación de autogeneración solar cuando exista viabilidad técnica y económica.'],
    ['Periodo de actualización:', 'El plan se revisará semestralmente o cuando existan nuevas facturas, cambios de matrícula, variaciones de operación, inversiones energéticas o mediciones técnicas relevantes.'],
    ['Plan de Reducción ' + institution, 'El Plan de Reducción de la Huella de Carbono en Alcance 2 parte del consumo mensual confirmado, calcula una línea base preliminar y propone acciones para reducir consumos, emisiones y costos.']
  ];
  sheet.getRange(19, 2, narrativeRows.length, 2).setValues(narrativeRows);
  sheet.getRange(19, 2, narrativeRows.length, 1).setFontWeight('bold').setBackground('#E8F3ED').setFontColor(BRAND_GREEN);
  sheet.getRange(19, 3, narrativeRows.length, 7).mergeAcross();
  sheet.getRange(19, 2, narrativeRows.length, 8).setBorder(true, true, true, true, true, true, '#D7E1DD', SpreadsheetApp.BorderStyle.SOLID).setWrap(true);
  sheet.setRowHeights(19, narrativeRows.length, 54);

  const actionsStart = 25;
  const firstHalf = [
    ['Actividades o acciones a realizar', 'Actividad', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'],
    ['', 'Fase 1: Diagnóstico y línea base', 'X', 'X', 'X', '', '', ''],
    ['', 'Recopilación de datos de consumo eléctrico', 'X', 'X', 'X', 'X', 'X', 'X'],
    ['', 'Cálculo de huella de carbono alcance 2', '', 'X', 'X', 'X', 'X', 'X'],
    ['', 'Fase 2: Diseño e implementación de estrategias', '', '', 'X', 'X', 'X', 'X'],
    ['', 'Implementación de iluminación LED y sensores', '', '', '', '', '', 'X']
  ];
  sheet.getRange(actionsStart, 2, firstHalf.length, 8).setValues(firstHalf);
  styleSheetBlock_(sheet, actionsStart, 2, firstHalf.length, 8);

  const secondHalfStart = actionsStart + firstHalf.length + 2;
  const secondHalf = [
    ['Actividades o acciones a realizar', 'Actividad', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    ['', 'Evaluación de energía solar fotovoltaica', 'X', 'X', '', '', '', ''],
    ['', 'Fase 3: Monitoreo', '', 'X', 'X', 'X', 'X', 'X'],
    ['', 'Capacitación a la comunidad educativa', '', 'X', 'X', 'X', 'X', ''],
    ['', 'Fase 4: Seguimiento y evaluación', '', '', 'X', 'X', 'X', 'X'],
    ['', 'Recolección de datos post-implementación', '', '', '', 'X', 'X', 'X'],
    ['', 'Informe final y ajuste de estrategias', '', '', '', '', '', 'X']
  ];
  sheet.getRange(secondHalfStart, 2, secondHalf.length, 8).setValues(secondHalf);
  styleSheetBlock_(sheet, secondHalfStart, 2, secondHalf.length, 8);

  let indicatorRow = secondHalfStart + secondHalf.length + 3;
  const years = [];
  for (let y = 2025; y <= 2050; y++) years.push(y);
  const yearValues = years.map(function(year) {
    if (year < planYear) return '0,000';
    if (year === planYear) return fmt_(annualCarbon, 3);
    return '0,000';
  });
  sheet.getRange(indicatorRow, 2).setValue('Indicador t CO₂e').setFontWeight('bold').setFontColor(BRAND_GREEN);
  indicatorRow++;
  for (let i = 0; i < years.length; i += 7) {
    const groupYears = years.slice(i, i + 7);
    const groupValues = yearValues.slice(i, i + 7);
    while (groupYears.length < 7) groupYears.push('');
    while (groupValues.length < 7) groupValues.push('');
    sheet.getRange(indicatorRow, 2, 1, 7).setValues([groupYears.map(String)]);
    sheet.getRange(indicatorRow + 1, 2, 1, 7).setValues([groupValues]);
    sheet.getRange(indicatorRow, 2, 1, 7).setBackground('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(indicatorRow + 1, 2, 1, 7).setBackground('#7A7D7A').setFontColor('#FFFFFF').setHorizontalAlignment('center');
    sheet.getRange(indicatorRow, 2, 2, 7).setBorder(true, true, true, true, true, true, '#111111', SpreadsheetApp.BorderStyle.SOLID);
    indicatorRow += 3;
  }
  sheet.getRange(indicatorRow, 2, 2, 2).setValues([
    ['Reducciones estimadas t CO₂e ' + nextYear + ' sin energía solar', '10%'],
    ['Reducciones estimadas t CO₂e ' + nextYear + ' con energía solar', 'Hasta 80%, sujeto a diseño y cobertura real']
  ]);
  styleSheetBlock_(sheet, indicatorRow, 2, 2, 2);

  const strategiesStart = indicatorRow + 4;
  sheet.getRange(strategiesStart, 2, 1, 8).merge().setValue('Estrategias para Reducir la Huella de Carbono en Alcance 2')
    .setBackground(BRAND_GREEN).setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange(strategiesStart + 1, 2, 1, 8).merge().setValue([
    'Implementar energía solar fotovoltaica cuando exista viabilidad técnica, financiera y regulatoria.',
    'Cambiar luminarias ineficientes por LED y revisar niveles de iluminación por uso del espacio.',
    'Instalar sensores, temporizadores o controles para consumos fuera de horario.',
    'Fortalecer hábitos de apagado y cultura energética con estudiantes, docentes y personal administrativo.',
    'Consolidar 12 facturas consecutivas para construir una línea base anual comparable.',
    'Actualizar mensualmente el indicador kWh/mes por estudiante para comparar instituciones educativas.'
  ].join('\n')).setWrap(true).setVerticalAlignment('top');
  sheet.setRowHeight(strategiesStart + 1, 130);
  sheet.getRange(strategiesStart, 2, 2, 8).setBorder(true, true, true, true, true, true, '#0B5D45', SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange('B:I').setWrap(true);
  sheet.autoResizeRows(1, strategiesStart + 2);
  SpreadsheetApp.flush();

  const file = DriveApp.getFileById(ss.getId());
  try {
    folder.addFile(file);
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== folder.getId()) {
        try { parent.removeFile(file); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('SiMeCO₂: no fue posible mover el Google Sheets al expediente. ' + (err && err.message ? err.message : err));
  }
  return file;
}

function styleSheetBlock_(sheet, row, col, numRows, numCols) {
  const range = sheet.getRange(row, col, numRows, numCols);
  range.setBorder(true, true, true, true, true, true, '#D7E1DD', SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true)
    .setVerticalAlignment('middle');
  sheet.getRange(row, col, 1, numCols)
    .setBackground(BRAND_GREEN)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  if (numRows > 1) {
    sheet.getRange(row + 1, col, numRows - 1, numCols).setHorizontalAlignment('center');
    sheet.getRange(row + 1, col, numRows - 1, 1).setBackground('#F1F8F4').setFontColor(BRAND_GREEN).setFontWeight('bold');
  }
}

function createReductionPlanGoogleDoc_(folder, d, codeId) {
  if (!folder) throw new Error('No se recibió la carpeta para crear el Plan de Reducciones GEI.');
  const planYear = new Date().getFullYear();
  const institution = cleanText_(d.institutionName) || 'Institución educativa';
  const doc = DocumentApp.create('Plan_Reducciones_GEI_' + planYear + '_' + safeName_(institution));
  const body = doc.getBody();
  setupBody_(body);

  addBrandHeader_(body, 'Plan de Reducciones para el año ' + planYear, 'Documento editable de gestión de reducciones GEI · Alcance 2', BRAND_GREEN);
  addSection_(body, institution, BRAND_GREEN);
  addMetricTable_(body, [
    ['Código', 'GEI-R-001 · ' + codeId],
    ['Edición', 'Editable'],
    ['Elaborado por', AUTHOR_NAME + ' | ' + PROJECT_URL],
    ['Aprobado por', cleanText_(d.offerRecipientName || 'Pendiente de aprobación institucional')],
    ['Fecha de aprobación', 'Pendiente'],
    ['Tipo de solicitante', cleanText_(d.requesterType)],
    ['Municipio', cleanText_(d.city || 'Pendiente')],
    ['Dirección', cleanText_(d.serviceAddress || 'Pendiente')]
  ], BRAND_GREEN, LIGHT_GREEN);

  addSection_(body, 'Población', BRAND_GREEN);
  const population = body.appendTable([
    ['Directivos docentes', 'Docentes', 'Estudiantes', 'Auxiliares admon.', 'Profesionales', 'Otros', 'Total'],
    ['0', '0', d.studentCount ? fmt_(d.studentCount, 0) : 'No reportado', '0', '0', '0', d.studentCount ? fmt_(d.studentCount, 0) : 'Pendiente']
  ]);
  styleTable_(population, BRAND_GREEN, 7);
  body.appendParagraph('');

  addSection_(body, 'Energía eléctrica', BRAND_GREEN);
  const inventory = body.appendTable([
    ['# Salas cómputo', '# Computadores', '# Lámparas', '# Tiendas', '# Refrigeradores', '# Laboratorios', 'Otros'],
    ['0', '0', '0', '0', '0', '0', '0']
  ]);
  styleTable_(inventory, BRAND_GREEN, 7);
  body.appendParagraph('');

  addSection_(body, 'Declaración de la alta dirección', BRAND_GREEN);
  body.appendParagraph('El establecimiento educativo se compromete a lograr las reducciones mediante la asignación de los recursos, responsables y acciones necesarias para gestionar eficientemente la energía y reducir las emisiones de GEI asociadas al consumo eléctrico.').editAsText().setFontFamily('Arial').setFontSize(10);

  addSection_(body, 'Objetivo general', BRAND_GREEN);
  body.appendParagraph('Reducir las emisiones de GEI mediante la aplicación de planes de eficiencia energética, cultura institucional, seguimiento de indicadores y evaluación de alternativas de autogeneración solar cuando exista viabilidad técnica y económica.').editAsText().setFontFamily('Arial').setFontSize(10);

  addSection_(body, 'Periodo de actualización', BRAND_GREEN);
  body.appendParagraph('El plan de gestión de reducciones de GEI se revisa y actualiza semestralmente, o cuando se cuente con nuevas facturas, cambios de matrícula, variaciones de operación, inversiones energéticas o mediciones técnicas relevantes.').editAsText().setFontFamily('Arial').setFontSize(10);

  addSection_(body, 'Descripción del plan de reducción', BRAND_GREEN);
  body.appendParagraph(
    'El Plan de Reducción de la Huella de Carbono en Alcance 2 para ' + institution +
    ' tiene como objetivo disminuir las emisiones de CO₂e derivadas del consumo de energía eléctrica. Para ello, se parte del consumo mensual confirmado en la factura, se calcula la huella de carbono asociada, se propone una línea base inicial y se recomiendan estrategias como eficiencia en iluminación, sensores, buenas prácticas, monitoreo energético, compras sostenibles y evaluación de energía solar fotovoltaica.'
  ).editAsText().setFontFamily('Arial').setFontSize(10);

  addSection_(body, 'Datos base SiMeCO₂', BRAND_GREEN);
  addMetricTable_(body, [
    ['Consumo energía factura', finiteOrZero_(d.consumption) ? fmt_(d.consumption, 2) + ' kWh/mes' : '0'],
    ['Número de estudiantes', d.studentCount ? fmt_(d.studentCount, 0) : 'No reportado'],
    ['Indicador educativo', d.energyKwhPerStudent ? fmt_(d.energyKwhPerStudent, 3) + ' kWh/mes por estudiante' : 'Pendiente'],
    ['Emisiones año base calculadas', fmt_(finiteOrZero_(d.annualCarbon), 3) + ' t CO₂e/año'],
    ['Factor de emisión usado', fmt_(ELECTRIC_FACTOR_KG_CO2_KWH, 3) + ' kg CO₂e/kWh']
  ], BRAND_GREEN, LIGHT_GREEN);

  addReductionPlanActions_(body, BRAND_GREEN);
  addReductionPlanIndicators_(body, d, planYear, BRAND_GREEN);
  addReductionPlanStrategies_(body, BRAND_GREEN);
  addDocumentControl_(body, d, codeId, 'GEI-R-001 · Documento editable histórico', BRAND_GREEN);
  addBrandSignature_(body, codeId);
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  file.setName('06_Plan_Reducciones_GEI_' + planYear + '_' + safeName_(institution));
  try {
    folder.addFile(file);
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== folder.getId()) {
        try { parent.removeFile(file); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('SiMeCO₂: no fue posible mover el documento editable histórico al expediente. ' + (err && err.message ? err.message : err));
  }
  return file;
}

function addReductionPlanActions_(body, color) {
  addSection_(body, 'Actividades o acciones a realizar', color);
  const firstHalf = body.appendTable([
    ['Actividad', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'],
    ['Fase 1: Diagnóstico y línea base', 'X', 'X', 'X', '', '', ''],
    ['Recopilación de datos de consumo eléctrico', 'X', 'X', 'X', 'X', 'X', 'X'],
    ['Cálculo de huella de carbono alcance 2', '', 'X', 'X', 'X', 'X', 'X'],
    ['Fase 2: Diseño e implementación de estrategias', '', '', 'X', 'X', 'X', 'X'],
    ['Implementación de iluminación LED y sensores', '', '', '', '', '', 'X']
  ]);
  styleTable_(firstHalf, color, 7);
  body.appendParagraph('');

  const secondHalf = body.appendTable([
    ['Actividad', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    ['Evaluación de energía solar fotovoltaica', 'X', 'X', '', '', '', ''],
    ['Fase 3: Monitoreo', '', 'X', 'X', 'X', 'X', 'X'],
    ['Capacitación a la comunidad educativa', '', 'X', 'X', 'X', 'X', ''],
    ['Fase 4: Seguimiento y evaluación', '', '', 'X', 'X', 'X', 'X'],
    ['Recolección de datos post-implementación', '', '', '', 'X', 'X', 'X'],
    ['Informe final y ajuste de estrategias', '', '', '', '', '', 'X']
  ]);
  styleTable_(secondHalf, color, 7);
  body.appendParagraph('');
}

function addReductionPlanIndicators_(body, d, planYear, color) {
  addSection_(body, 'Indicador t CO₂e', color);
  const years = [];
  for (let y = 2025; y <= 2050; y++) years.push(y);
  const rows = [];
  for (let i = 0; i < years.length; i += 7) {
    const group = years.slice(i, i + 7);
    while (group.length < 7) group.push('');
    rows.push(group.map(function(year) { return year ? String(year) : ''; }));
    rows.push(group.map(function(year) {
      if (!year) return '';
      if (year < planYear) return '0,000';
      if (year === planYear) return fmt_(finiteOrZero_(d.annualCarbon), 3);
      return '0,000';
    }));
  }
  const t = body.appendTable(rows);
  for (let r = 0; r < t.getNumRows(); r++) {
    for (let c = 0; c < t.getRow(r).getNumCells(); c++) {
      const cell = t.getCell(r, c);
      cell.setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(5).setPaddingRight(5);
      cell.setBackgroundColor(r % 2 === 0 ? '#FFFFFF' : '#7A7D7A');
      const p = cell.getChild(0).asParagraph();
      p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      p.editAsText()
        .setFontFamily('Arial')
        .setFontSize(r % 2 === 0 ? 10 : 9)
        .setBold(r % 2 === 0)
        .setForegroundColor(r % 2 === 0 ? '#111111' : '#FFFFFF');
    }
  }
  body.appendParagraph('');

  const nextYear = planYear + 1;
  const reduction = body.appendTable([
    ['Reducciones estimadas t CO₂e ' + nextYear + ' sin energía solar', '10%'],
    ['Reducciones estimadas t CO₂e ' + nextYear + ' con energía solar', 'Hasta 80%, sujeto a diseño y cobertura real']
  ]);
  for (let r = 0; r < reduction.getNumRows(); r++) {
    reduction.getCell(r, 0).setBackgroundColor(LIGHT_GREEN);
    reduction.getCell(r, 0).getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor(color);
  }
  setTableFontSize_(reduction, 8);
  body.appendParagraph('');
}

function addReductionPlanStrategies_(body, color) {
  addSection_(body, 'Estrategias para reducir la huella de carbono en alcance 2', color);
  addBullets_(body, [
    'Implementar energía solar fotovoltaica para autoconsumo cuando exista viabilidad técnica, financiera y regulatoria.',
    'Cambiar luminarias ineficientes por iluminación LED y revisar niveles de iluminación según uso del espacio.',
    'Instalar sensores de ocupación, temporizadores o controles donde existan consumos fuera de horario.',
    'Fortalecer hábitos de apagado en aulas, salas de sistemas, oficinas, laboratorios y zonas comunes.',
    'Consolidar 12 facturas consecutivas para construir una línea base anual comparable.',
    'Levantar inventario de cargas por área: equipo, cantidad, potencia, horas de uso y estado.',
    'Incorporar criterios de compras sostenibles y eficiencia energética en nuevas adquisiciones.',
    'Vincular estudiantes y líderes ambientales al seguimiento mensual del indicador kWh/mes por estudiante.'
  ]);
}

function saveBlobInFolder_(folder, blob, fallbackName) {
  if (!folder) throw new Error('No se recibió la carpeta del expediente.');
  if (!blob) throw new Error('No se recibió uno de los PDF para guardar en Drive.');

  const name = safeAttachmentName_(blob.getName && blob.getName(), fallbackName);
  const copy = blob.copyBlob ? blob.copyBlob() : Utilities.newBlob(blob.getBytes(), blob.getContentType(), name);
  copy.setName(name);
  return folder.createFile(copy);
}

function safeAttachmentName_(name, fallbackName) {
  const cleaned = cleanText_(name || fallbackName || 'documento.pdf')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180);
  return cleaned || fallbackName || 'documento.pdf';
}

function writeStudyDriveLinks_(dbRef, expediente) {
  if (!dbRef || !dbRef.codeId) throw new Error('No se recibió referencia de base de datos para escribir enlaces.');
  if (!expediente || !expediente.folderUrl) throw new Error('No se recibió expediente de Drive para escribir enlaces.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    const sheet = ensureDatabaseSheet_(ss);
    const targetRow = findDatabaseRowByCode_(sheet, dbRef);
    if (!targetRow) throw new Error('No se encontró la fila del estudio ' + dbRef.codeId + ' para escribir enlaces de Drive.');

    ensureDriveLinkHeaders_(sheet);
    setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START, 'Abrir expediente', expediente.folderUrl);
    setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START + 1, 'Abrir factura', expediente.facturaUrl);
    setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START + 2, 'Abrir GEI', expediente.geiUrl);
    setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START + 3, 'Abrir agua', expediente.aguaUrl);
    setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START + 4, 'Abrir gas', expediente.gasUrl);
    setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START + 5, 'Abrir solar', expediente.solarUrl);
    if (expediente.reductionPlanSheetUrl) {
      setNativeLink_(sheet, targetRow, DRIVE_LINK_COLUMN_START + 6, 'Abrir Sheets GEI', expediente.reductionPlanSheetUrl);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function findDatabaseRowByCode_(sheet, dbRef) {
  const lastRow = sheet.getLastRow();
  let targetRow = Number(dbRef.row) || 0;
  if (targetRow >= 2 && targetRow <= lastRow && String(sheet.getRange(targetRow, 2).getDisplayValue()) === String(dbRef.codeId)) {
    return targetRow;
  }
  if (lastRow < 2) return 0;
  const finder = sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(String(dbRef.codeId))
    .matchEntireCell(true)
    .findNext();
  return finder ? finder.getRow() : 0;
}

function setNativeLink_(sheet, row, col, label, url) {
  const range = sheet.getRange(row, col);
  if (!url) {
    range.clearContent();
    return;
  }
  const value = SpreadsheetApp.newRichTextValue()
    .setText(label)
    .setLinkUrl(String(url))
    .build();
  range
    .setRichTextValue(value)
    .setFontColor('#1155CC')
    .setFontLine('underline')
    .setHorizontalAlignment('center');
}

function ensureDatabaseSummary_(ss) {
  let summary = ss.getSheetByName('Resumen');
  if (!summary) summary = ss.insertSheet('Resumen');

  summary.clear();
  summary.getRange('A1:D1').merge();
  summary.getRange('A1').setValue('Resumen · Base de datos solicitudes SiMeCO₂');
  summary.getRange('A1:D1')
    .setBackground('#0B5D45')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center');

  const rows = [
    ['Indicador','Valor'],
    ['Total de solicitudes', '=COUNTA(\'' + DATABASE_SHEET_NAME + '\'!B2:B)'],
    ['Última solicitud', '=IFERROR(MAX(\'' + DATABASE_SHEET_NAME + '\'!A2:A);"")'],
    ['Consumo eléctrico registrado (kWh)', '=SUM(\'' + DATABASE_SHEET_NAME + '\'!K2:K)'],
    ['Potencia solar predimensionada (kWp)', '=SUM(\'' + DATABASE_SHEET_NAME + '\'!R2:R)'],
    ['Valor referencial de proyectos (COP)', '=SUM(\'' + DATABASE_SHEET_NAME + '\'!AA2:AA)'],
    ['Ahorro anual estimado (COP)', '=SUM(\'' + DATABASE_SHEET_NAME + '\'!X2:X)'],
    ['Solicitudes enviadas', '=COUNTIF(\'' + DATABASE_SHEET_NAME + '\'!AL2:AL;"Enviado")'],
    ['Solicitudes con consentimiento', '=COUNTIF(\'' + DATABASE_SHEET_NAME + '\'!AJ2:AJ;"Sí")'],
    ['Solicitudes educativas con estudiantes', '=COUNTIF(\'' + DATABASE_SHEET_NAME + '\'!BM2:BM;">0")'],
    ['Estudiantes registrados', '=SUM(\'' + DATABASE_SHEET_NAME + '\'!BM2:BM)'],
    ['Promedio kWh/mes por estudiante', '=IFERROR(AVERAGEIF(\'' + DATABASE_SHEET_NAME + '\'!BN2:BN;">0";\'' + DATABASE_SHEET_NAME + '\'!BN2:BN);"")']
  ];

  summary.getRange(3, 1, rows.length, 2).setValues(rows.map(function(r) {
    return [r[0], String(r[1]).charAt(0) === '=' ? '' : r[1]];
  }));
  for (let i = 1; i < rows.length; i++) {
    try { summary.getRange(3 + i, 2).setFormula(rows[i][1]); } catch (_) {}
  }

  summary.getRange('A3:B3').setBackground('#17775C').setFontColor('#FFFFFF').setFontWeight('bold');
  summary.getRange('A4:A14').setBackground('#F1F8F4').setFontWeight('bold');
  summary.getRange('B5').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  summary.getRange('B6:B7').setNumberFormat('#,##0.00');
  summary.getRange('B8:B9').setNumberFormat('$ #,##0');
  summary.getRange('B12').setNumberFormat('#,##0');
  summary.getRange('B13').setNumberFormat('#,##0');
  summary.getRange('B14').setNumberFormat('#,##0.000');
  summary.getRange('A16:E16').setValues([['Ranking educativo', 'Tipo', 'Estudiantes', 'kWh/mes por estudiante', 'Consumo kWh/mes']]);
  summary.getRange('A16:E16').setBackground('#17775C').setFontColor('#FFFFFF').setFontWeight('bold');
  try {
    summary.getRange('A17').setFormula('=QUERY(\'' + DATABASE_SHEET_NAME + '\'!A2:BN;"select F, AN, BM, BN, K where BN > 0 order by BN asc label F \'Solicitante\', AN \'Tipo\', BM \'Estudiantes\', BN \'kWh/mes por estudiante\', K \'Consumo kWh/mes\'";0)');
  } catch (_) {}
  summary.setFrozenRows(3);
  summary.setColumnWidth(1, 310);
  summary.setColumnWidth(2, 180);
  summary.setColumnWidth(3, 120);
  summary.setColumnWidth(4, 180);
  summary.setColumnWidth(5, 150);
}

function diagnosticoBaseDatosSiMeCO2_() {
  const result = {
    spreadsheetId: DATABASE_SPREADSHEET_ID,
    sheetName: DATABASE_SHEET_NAME,
    folderId: DATABASE_FOLDER_ID,
    ok: false
  };
  try {
    const ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    const sheet = ensureDatabaseSheet_(ss);
    result.title = ss.getName();
    result.lastRow = sheet.getLastRow();
    result.columns = sheet.getMaxColumns();
    result.url = ss.getUrl();
    result.ok = true;
  } catch (err) {
    result.error = err && err.message ? err.message : String(err);
  }
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function pruebaBaseDatosSolicitudes_() {
  const test = {
    fullName: 'Prueba SiMeCO₂', email: CONTACT_EMAIL, whatsapp: CONTACT_PHONE,
    institutionName: 'Registro de prueba', serviceAddress: 'Medellín, Antioquia',
    billingPeriod: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM'), contractNumber: 'PRUEBA',
    consumption: 635, tariff: 902.28, waterM3: 6, gasM3: 5.758,
    invoiceFileName: 'Factura_prueba.pdf', tariffMethod: 'gross_energy_charge_div_kwh', energyCharge: 572947.8,
    coverage: 100, kwp: 5.2, panels: 9, area: 27, generationMonthly: 637, actualCoverage: 100.31,
    monthlySaving: 572947.8, annualSaving: 6875373.6, solarCo2: 0.963, solarTrees: 80,
    projectValue: 26637225, valuePerKwp: 5147290, simpleRoi: 25.81, simplePayback: 3.87,
    financeRateMV: 1.5, financeRateEA: 19.56, finance48: 782468, finance60: 676410, finance120: 479963,
    consent: true, consentVersion: 'Autorización tratamiento de datos y revisión de factura · v1'
  };
  const codeId = 'SIMECO2-PRUEBA-DB-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss');
  const ref = registerStudyRequest_(test, codeId, 'Prueba');
  Logger.log(JSON.stringify(ref, null, 2));
  return ref;
}

function truncateText_(value, maxLen) {
  const s = cleanText_(value);
  return s.length <= maxLen ? s : s.slice(0, Math.max(0, maxLen - 1)) + '…';
}

/* =====================================================================
   TEMPORALES / FORMATO
   ===================================================================== */

function getTempFolder_() {
  const folders = DriveApp.getFoldersByName(TEMP_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(TEMP_FOLDER_NAME);
}

function cleanupOldTempFiles_() {
  const folder = getTempFolder_();
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    try {
      if (file.getDateCreated().getTime() < cutoff) file.setTrashed(true);
    } catch (_) {}
  }
}

function trashQuietly_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (_) {}
}

function fmt_(value, decimals) {
  const n = finiteOrZero_(value);
  const fixed = n.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals ? parts[0] + ',' + parts[1] : parts[0];
}

function money_(value) {
  return '$ ' + fmt_(Math.round(finiteOrZero_(value)), 0);
}

function finiteOrZero_(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function cleanText_(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparisonText_(text) {
  return stripAccents_(cleanText_(text)).toLowerCase();
}

function sanitizeFileName_(name) {
  return String(name || 'Factura')
    .replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]+/g, '_')
    .substring(0, 120);
}

function safeName_(text) {
  return String(text || 'Estudio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80) || 'Estudio';
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =====================================================================
   PRUEBAS / DIAGNÓSTICO MANUAL DESDE EL EDITOR
   ===================================================================== */

// Función privada: el sufijo "_" impide invocarla desde google.script.run
// cuando la Web App está publicada para acceso anónimo.
function diagnosticoSiMeCO2_() {
  const result = {
    app: APP_NAME,
    timezone: Session.getScriptTimeZone(),
    executionMode: 'Web App pública · ejecuta como usuario que implementa',
    driveAdvancedService: false,
    tempFolderId: '',
    author: AUTHOR_NAME,
    contact: CONTACT_EMAIL,
    projectUrl: PROJECT_URL
  };

  try {
    Drive.Files.list({pageSize: 1, fields: 'files(id,name)'});
    result.driveAdvancedService = true;
  } catch (err) {
    throw new Error('Drive API v3 no está disponible. Revisa Servicios > Drive API. Detalle: ' + err.message);
  }

  const folder = getTempFolder_();
  result.tempFolderId = folder.getId();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function pruebaTarifaCalculada_() {
  const sample = [
    'Servicio de Energía Eléctrica',
    'Consumo energía 635 kWh',
    'Valor energía $565.785'
  ].join('\n');
  const r = extractInvoiceData_(sample);
  if (Math.abs(r.energyTariff - 891) > 0.1) {
    throw new Error('Prueba fallida. Tarifa esperada ≈ 891 COP/kWh; obtenida: ' + r.energyTariff);
  }
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function pruebaTarifaDirecta_() {
  const sample = 'Consumo energía 635 kWh\nCosto unitario 891,35 COP/kWh';
  const r = extractInvoiceData_(sample);
  if (Math.abs(r.energyTariff - 891.35) > 0.01) {
    throw new Error('Prueba fallida. Tarifa esperada 891,35 COP/kWh; obtenida: ' + r.energyTariff);
  }
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function pruebaTarifaAntirruido_() {
  const mock = [
    'Institución Educativa Prueba',
    'Consumo energía 635 kWh',
    'Tarifa código 6.300',
    'Valor energía $565.785',
    'Total a pagar $900.000'
  ].join('\n');
  const r = extractInvoiceData_(mock);
  if (Math.abs(r.energyTariff - 890.999) > 1.5) {
    throw new Error('Prueba antirruido fallida. Debía ignorar 6.300 y calcular ≈ 891 COP/kWh; obtuvo: ' + r.energyTariff);
  }
  return r;
}

function pruebaFacturaEpmJulio2026_() {
  const sample = [
    'Energía',
    'Valores Facturados kWh x Costo ($) Valor ($)',
    'Energía jul-26 58 902,280 $ 52.332,24',
    'Subsidio $ -7.849,84',
    'Interés mora $ 73,60',
    'Total Energía $ 44.556,00',
    'Gas',
    'consumo 5,758 m3',
    'Cliente: Dario Betancur Hurtado',
    'Dirección de cobro: CR 80 CL 42 SUR -24 (INTERIOR 502 )',
    'Municipio: Medellín',
    'Contrato 11475294',
    'Periodo de consumo: Mayo 2026'
  ].join('\n');

  const r = extractInvoiceData_(sample);
  if (Math.abs(r.energyKwh - 58) > 0.001) throw new Error('EPM prueba: consumo esperado 58 kWh; obtenido ' + r.energyKwh);
  if (Math.abs(r.energyTariff - 902.28) > 0.02) throw new Error('EPM prueba: tarifa esperada 902,28 COP/kWh; obtenida ' + r.energyTariff);
  if (Math.abs(r.energyCharge - 52332.24) > 1) throw new Error('EPM prueba: valor bruto de energía esperado $52.332,24; obtenido ' + r.energyCharge);
  if (Math.abs(r.gasM3 - 5.758) > 0.001) throw new Error('EPM prueba: gas esperado 5,758 m3; obtenido ' + r.gasM3);
  if (r.customerName !== 'Dario Betancur Hurtado') throw new Error('EPM prueba: cliente incorrecto: ' + r.customerName);
  if (r.serviceAddress.indexOf('CR 80 CL 42 SUR -24') !== 0) throw new Error('EPM prueba: dirección incorrecta: ' + r.serviceAddress);
  if (r.city !== 'Medellín') throw new Error('EPM prueba: ciudad esperada Medellín; obtenida: ' + r.city);

  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function pruebaFacturaEpmMayo2026_() {
  const samples = [
    [
      'Valores Facturados kWh x Costo ($) Valor ($)',
      'Energía may-26 353.583 864,06 $305.516,93',
      'Subsidio -16.849,17',
      'Interés mora 841,54',
      'Total Energía $289.509,30'
    ].join('\n'),
    [
      'Valores Facturados',
      'kWh x Costo ($) Valor ($)',
      'Energía may-26',
      '353.583 864,06 $305.516,93',
      'Subsidio -16.849,17',
      'Total Energía $289.509,30'
    ].join('\n'),
    [
      'Valores Facturados',
      'Energía may-26',
      'Subsidio -16.849,17',
      'Interés mora 841,54',
      'Total Energía $289.509,30',
      'kWh x',
      '353.583',
      'Costo ($)',
      '864,06',
      'Valor ($)',
      '$305.516,93'
    ].join('\n')
  ];

  const results = samples.map(function(sample) {
    const r = extractInvoiceData_(sample);
    if (Math.abs(r.energyKwh - 353.583) > 0.001 && r.energyKwh !== 0) {
      throw new Error('EPM mayo: consumo esperado 353,583 kWh; obtenido ' + r.energyKwh);
    }
    if (Math.abs(r.energyTariff - 864.06) > 0.01) {
      throw new Error('EPM mayo: costo esperado 864,06 COP/kWh; obtenido ' + r.energyTariff);
    }
    if (Math.abs(r.energyCharge - 305516.93) > 0.02 && r.energyCharge !== 0) {
      throw new Error('EPM mayo: valor energía esperado $305.516,93; obtenido ' + r.energyCharge);
    }
    if (r.tariffMethod !== 'unit_cost_energy_row') {
      throw new Error('EPM mayo: la tarifa no fue clasificada como costo unitario de la fila Energía.');
    }
    return r;
  });
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}


function pruebaPredimensionamientosReferencia_() {
  // Pruebas de selección contra la tabla económica del Área Metropolitana de Medellín.
  const cases = [
    {consumption:635, coverage:100, expectedKwp:5.2, expectedGeneration:637, expectedProject:26637225},
    {consumption:1302, coverage:100, expectedKwp:10.9, expectedGeneration:1344, expectedProject:47220117},
    {consumption:1548, coverage:100, expectedKwp:12.7, expectedGeneration:1556, expectedProject:53267116}
  ];
  const out = [];
  cases.forEach(function(c){
    const d = {consumption:c.consumption, tariff:900, coverage:c.coverage};
    applySolarPredimensioning_(d);
    if (Math.abs(d.kwp - c.expectedKwp) > 0.001) throw new Error('Potencia esperada ' + c.expectedKwp + '; obtenida ' + d.kwp);
    if (Math.abs(d.generationMonthly - c.expectedGeneration) > 0.001) throw new Error('Generación esperada ' + c.expectedGeneration + '; obtenida ' + d.generationMonthly);
    if (Math.round(d.projectValue) !== c.expectedProject) throw new Error('Valor proyecto esperado ' + c.expectedProject + '; obtenido ' + d.projectValue);
    out.push({consumption:c.consumption, kwp:d.kwp, generation:d.generationMonthly, projectValue:d.projectValue, panels:d.panels, area:d.area});
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function pruebaTablaPreciosYFinanciacion_() {
  const d = {consumption:635, tariff:923, coverage:100};
  applySolarPredimensioning_(d);

  if (Math.abs(d.kwp - 5.2) > 0.001) throw new Error('La tabla debe seleccionar 5,2 kWp para 635 kWh/mes.');
  if (Math.round(d.projectValue) !== 26637225) throw new Error('Valor de tabla esperado: $26.637.225.');
  if (Math.abs(d.financeRateMV - 1.5) > 0.0001) throw new Error('Tasa M.V. esperada: 1,50%.');
  if (Math.abs(d.financeRateEA - 19.5618171462) > 0.001) throw new Error('Tasa E.A. esperada: ~19,56%.');

  // Valores esperados por la fórmula de anualidad al 1,50% M.V.
  if (Math.abs(Math.round(d.finance48) - 782468) > 2) throw new Error('Cuota 48 meses inesperada: ' + d.finance48);
  if (Math.abs(Math.round(d.finance60) - 676410) > 2) throw new Error('Cuota 60 meses inesperada: ' + d.finance60);
  if (Math.abs(Math.round(d.finance120) - 479963) > 2) throw new Error('Cuota 120 meses inesperada: ' + d.finance120);

  Logger.log(JSON.stringify({
    kwp:d.kwp,
    area:d.area,
    generation:d.generationMonthly,
    projectValue:d.projectValue,
    rateMV:d.financeRateMV,
    rateEA:d.financeRateEA,
    finance48:Math.round(d.finance48),
    finance60:Math.round(d.finance60),
    finance120:Math.round(d.finance120)
  }, null, 2));
  return d;
}

function pruebaGeneracionPlanes_() {
  const d = {
    fullName: 'Usuario de prueba',
    email: CONTACT_EMAIL,
    whatsapp: '3000000000',
    invoiceFileName: 'Factura_prueba.pdf',
    institutionName: 'I.E. de prueba SiMeCO₂',
    serviceAddress: 'Medellín, Antioquia',
    billingPeriod: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM'),
    billingStart: '2026-08-01',
    billingEnd: '2026-08-31',
    billingDays: 30,
    analysisConfidence: 'alta',
    contractNumber: 'PRUEBA',
    consumption: 635,
    tariff: 891,
    waterM3: 20,
    waterCharge: 120000,
    gasM3: 12,
    gasCharge: 72000,
    studentCount: 850,
    mealsPerMonth: 8500,
    monthlyBillApprox: 635 * 891,
    coverage: 100,
    factor: ELECTRIC_FACTOR_KG_CO2_KWH,
    annualCarbon: 635 * 12 * ELECTRIC_FACTOR_KG_CO2_KWH / 1000,
    carbonTrees: 635 * 12 * ELECTRIC_FACTOR_KG_CO2_KWH / TREE_CAPTURE_KG_YEAR,
    panelWp: SOLAR_PANEL_WP,
    currentQuote: 0
  };

  applySolarPredimensioning_(d);
  const codeId = 'SIMECO2-PRUEBA-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss');
  const blobs = [
    buildEnergyManagementPdf_(d, codeId),
    buildWaterPlanPdf_(d, codeId),
    buildGasPlanPdf_(d, codeId),
    buildSolarPdf_(d, codeId)
  ];
  const folder = getTempFolder_();
  const ids = blobs.map(function(blob) { return folder.createFile(blob).getId(); });
  Logger.log('PDF de prueba creados: ' + ids.join(', '));
  return ids;
}

/* =====================================================================
   FUNCIONES PRIVADAS DE DIAGNÓSTICO, AUTORIZACIÓN Y PRUEBA
   ---------------------------------------------------------------------
   El guion bajo final impide que los visitantes de la Web App invoquen
   estas funciones mediante google.script.run.
   ===================================================================== */

// Función privada de mantenimiento. No debe quedar disponible para visitantes
// anónimos a través de google.script.run.
function autorizarSiMeCO2_() {
  // Fuerza a Apps Script a comprobar TODOS los alcances OAuth declarados
  // antes de tocar Google Sheets. Si falta alguno, Apps Script detiene esta
  // ejecución y muestra la pantalla oficial "Revisar permisos".
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);

  const result = {
    ok: false,
    timestamp: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    spreadsheetId: DATABASE_SPREADSHEET_ID,
    sheetName: DATABASE_SHEET_NAME
  };

  // Esta función se ejecuta MANUALMENTE una sola vez desde el editor de Apps Script.
  // Su objetivo es forzar la pantalla de autorización del propietario de la Web App
  // para TODOS los servicios que necesita SiMeCO₂, incluido Google Sheets.
  try {
    Drive.Files.list({pageSize: 1, fields: 'files(id)'});
    result.driveAdvancedService = true;
  } catch (errDrive) {
    result.driveAdvancedService = false;
    result.driveError = String(errDrive && errDrive.message ? errDrive.message : errDrive);
  }

  try {
    const ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    const sheet = ensureDatabaseSheet_(ss);
    SpreadsheetApp.flush();
    result.spreadsheet = ss.getName();
    result.sheet = sheet.getName();
    result.sheetColumns = sheet.getMaxColumns();
    result.sheetAccess = true;
  } catch (errSheet) {
    result.sheetAccess = false;
    result.sheetError = String(errSheet && errSheet.message ? errSheet.message : errSheet);
    Logger.log(JSON.stringify(result, null, 2));
    throw new Error(
      'No fue posible autorizar Google Sheets. Ejecuta nuevamente autorizarSiMeCO2_(), ' +
      'acepta TODOS los permisos solicitados y verifica que la cuenta propietaria de la implementación ' +
      'tenga acceso de edición a la base. Detalle: ' + result.sheetError
    );
  }

  // Fuerza autorización de DocumentApp + DriveApp sin enviar correos.
  let authDocId = '';
  try {
    const doc = DocumentApp.create('SIMECO2_AUTORIZACION_TEMP_' + Date.now());
    authDocId = doc.getId();
    doc.getBody().appendParagraph('Archivo temporal de autorización SiMeCO₂.');
    doc.saveAndClose();
    DriveApp.getFileById(authDocId).setTrashed(true);
    result.documentsAndDrive = true;
  } catch (errDoc) {
    result.documentsAndDrive = false;
    result.documentsError = String(errDoc && errDoc.message ? errDoc.message : errDoc);
    try { if (authDocId) DriveApp.getFileById(authDocId).setTrashed(true); } catch (_) {}
  }

  try {
    result.mailQuotaRemaining = MailApp.getRemainingDailyQuota();
    result.mailPermission = true;
  } catch (errMail) {
    result.mailPermission = false;
    result.mailError = String(errMail && errMail.message ? errMail.message : errMail);
  }

  result.ok = result.sheetAccess === true && result.documentsAndDrive === true && result.mailPermission === true;
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function estadoAutorizacionSiMeCO2_() {
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/spreadsheets'
  ];
  const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, scopes);
  const status = String(info.getAuthorizationStatus());
  const url = info.getAuthorizationUrl() || '';
  const result = {
    status: status,
    authorizationUrl: url,
    scopes: scopes,
    instruction: status === 'REQUIRED'
      ? 'Ejecuta autorizarSiMeCO2_() y acepta todos los permisos. Si el editor no abre la pantalla, copia authorizationUrl del registro y ábrela en una pestaña.'
      : 'Los alcances requeridos ya están autorizados para esta cuenta.'
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// No se crean envoltorios públicos para las pruebas internas. Todas las
// funciones de diagnóstico, autorización y prueba terminan en "_" y quedan
// fuera del alcance de google.script.run. Las únicas funciones públicas del
// proyecto deben ser doGet, analyzeInvoice, previewSolarPredimensioning y
// generateAndSendStudy.

/* =====================================================================
   SIMECO2 v109 · PUENTE DOCUMENTAL DESDE LA APP ESTÁTICA
   Genera 4 PDF + Google Sheets + expediente Drive y, opcionalmente, e-mail.
   ===================================================================== */

const SIMECO2_DOC_MAX_GLOBAL_DAY = 200;
const SIMECO2_DOC_MAX_RECIPIENT_DAY = 8;

function enforceSiMeCO2DocumentRate_(payload) {
  var day = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd');
  var recipient = String(payload && payload.email || '').trim().toLowerCase() || safeName_(payload && payload.institutionName || 'sin-correo').toLowerCase();
  var digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, recipient)).slice(0, 20);
  var globalKey = 'SIMECO2_DOC_GLOBAL_' + day;
  var recipientKey = 'SIMECO2_DOC_RECIP_' + day + '_' + digest;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var props = PropertiesService.getScriptProperties();
    var globalCount = Number(props.getProperty(globalKey) || 0);
    var recipientCount = Number(props.getProperty(recipientKey) || 0);
    if (globalCount >= SIMECO2_DOC_MAX_GLOBAL_DAY) throw new Error('Se alcanzó el límite diario de generación documental. Intenta nuevamente mañana o contacta al administrador.');
    if (recipientCount >= SIMECO2_DOC_MAX_RECIPIENT_DAY) throw new Error('Este destinatario alcanzó el límite diario de generación documental.');
    props.setProperty(globalKey, String(globalCount + 1));
    props.setProperty(recipientKey, String(recipientCount + 1));
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    var raw = '';
    if (e && e.postData && e.postData.contents) raw = e.postData.contents;
    if ((!raw || raw.charAt(0) !== '{') && e && e.parameter && e.parameter.payload) raw = e.parameter.payload;
    var payload = raw ? JSON.parse(raw) : {};
    if (payload.action !== 'simeco2-documents') throw new Error('Acción no reconocida.');
    var result = generateSiMeCO2DocumentPackage_(payload);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err && err.message ? err.message : String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function generateSiMeCO2DocumentPackage_(payload) {
  payload = payload || {};
  enforceSiMeCO2DocumentRate_(payload);
  var mode = String(payload.mode || 'generate').toLowerCase() === 'send' ? 'send' : 'generate';
  if (payload.consent !== true) throw new Error('Se requiere autorización para generar y almacenar los documentos.');
  if (mode === 'send') {
    var recipient = String(payload.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('El correo destinatario no es válido.');
    assertMailQuotaAvailable_(recipient);
  }

  var data = normalizeStudyPayload_(payload);
  data.source = cleanText_(payload.source || 'Histórico consolidado SiMeCO₂');
  data.analysisConfidence = 'alta';
  data.billingDays = finiteOrZero_(payload.billingDays) || 30;
  data.waterM3 = finiteOrZero_(payload.waterM3);
  data.gasM3 = finiteOrZero_(payload.gasM3);
  data.city = cleanText_(payload.city || 'Medellín');
  data.billingPeriod = cleanText_(payload.billingPeriod || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM'));
  data.institutionName = cleanText_(payload.institutionName) || 'Institución educativa';
  data.serviceAddress = cleanText_(payload.serviceAddress) || 'Dirección no identificada';
  data.fullName = cleanText_(payload.fullName) || data.institutionName;
  data.email = String(payload.email || '').trim();
  data.requesterType = cleanText_(payload.requesterType || 'Institución Educativa');
  data.offerRecipientName = cleanText_(payload.offerRecipientName || data.fullName);
  data.offerRecipientRole = cleanText_(payload.offerRecipientRole || 'Responsable institucional');
  data.notes = cleanText_(payload.notes || 'Generado desde el histórico consolidado de SiMeCO₂.');
  data.consent = true;
  data.gsvConsent = payload.gsvConsent === true;
  data.consentVersion = PRIVACY_NOTICE_VERSION;
  data.retentionUntil = new Date();
  data.retentionUntil.setMonth(data.retentionUntil.getMonth() + DATA_RETENTION_MONTHS);
  data.invoiceFileName = 'Histórico consolidado SiMeCO₂';
  data.consumptionSource = 'Promedio mensual del histórico SiMeCO₂ confirmado por el usuario';
  data.tariffFinalSource = data.tariff > 0 ? 'Tarifa histórica o confirmada en SiMeCO₂' : 'Tarifa pendiente de confirmación';
  data.tariffSource = data.tariffFinalSource;
  data.tariffMethod = data.tariff > 0 ? 'simeco2_historical_or_manual' : 'pending';
  data.tariffExplanation = data.tariffFinalSource;
  data.monthlyBillApprox = data.consumption > 0 && data.tariff > 0 ? data.consumption * data.tariff : 0;
  data.ocrConsumption = 0;
  data.ocrTariff = 0;
  data.ocrEnergyCharge = 0;
  data.ocrCity = '';
  data.cityWasCorrected = false;
  data.citySource = 'Municipio asociado a la sede en SiMeCO₂';
  applyStudentMetrics_(data);
  applySolarPredimensioning_(data);

  if (!(data.consumption > 0)) throw new Error('No existe una línea base eléctrica mensual válida para generar el paquete documental.');

  var stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss');
  var codeId = 'SIMECO2-' + stamp + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  var energyPlan = buildEnergyManagementPdf_(data, codeId);
  var waterPlan = buildWaterPlanPdf_(data, codeId);
  var gasPlan = buildGasPlanPdf_(data, codeId);
  var solarPdf = buildSolarPdf_(data, codeId);
  var expediente = createSiMeCO2PlanExpediente_(data, codeId, {
    energyPlan: energyPlan,
    waterPlan: waterPlan,
    gasPlan: gasPlan,
    solarPdf: solarPdf
  });

  var emailed = false;
  if (mode === 'send') {
    var attachmentSelection = selectEmailAttachments_([energyPlan, waterPlan, gasPlan, solarPdf], []);
    var subject = 'SiMeCO₂ · Planes ambientales y predimensionamiento solar · ' + data.institutionName;
    var sheetLine = expediente.sheetUrl
      ? '<p><strong>Google Sheets editable:</strong> <a href="' + escapeHtml_(expediente.sheetUrl) + '">Plan de Reducciones GEI</a></p>'
      : '';
    var htmlBody = [
      '<div style="font-family:Arial,sans-serif;color:#173d33;line-height:1.55;max-width:760px;margin:auto">',
      '<div style="background:#0b6b4b;color:#fff;padding:22px;border-radius:14px 14px 0 0"><strong style="font-size:20px">SiMeCO₂ · Paquete documental ambiental</strong><br><span>' + escapeHtml_(data.institutionName) + '</span></div>',
      '<div style="border:1px solid #dcebe4;border-top:0;padding:22px;border-radius:0 0 14px 14px">',
      '<p>Cordial saludo ' + escapeHtml_(data.fullName) + '.</p>',
      '<p>Se generó el paquete documental de la sede a partir del histórico consolidado de SiMeCO₂.</p>',
      '<ol><li>Informe Detallado de Diagnóstico y Plan Inicial de Gestión Energética PGEE-UPME.</li><li>Plan de Acción de Ahorro de Agua.</li><li>Plan de Gestión y Uso Eficiente del Gas.</li><li>Predimensionamiento Solar completo de Líderes Ambientales.</li></ol>',
      sheetLine,
      '<p><strong>Expediente privado:</strong> <a href="' + escapeHtml_(expediente.folderUrl) + '">abrir carpeta en Drive</a></p>',
      '<p><strong>Lectura rápida:</strong> ' + fmt_(data.consumption, 2) + ' kWh/mes · ' + fmt_(data.kwp, 1) + ' kWp · ' + fmt_(data.generationMonthly, 0) + ' kWh/mes solares · ' + money_(data.monthlySaving) + ' de ahorro mensual estimado.</p>',
      '<div style="padding:12px;background:#fff9e9;border:1px solid #e5d9a6;border-radius:10px"><strong>Importante:</strong> los cálculos son de planeación y prefactibilidad. No constituyen auditoría, ahorro verificado, certificación ni cotización definitiva.</div>',
      '<p style="font-size:12px;color:#657871">Código: ' + escapeHtml_(codeId) + '</p>',
      '<p>Cordialmente,<br><strong>' + escapeHtml_(AUTHOR_NAME) + '</strong><br>Líderes Ambientales de Medellín</p>',
      '</div></div>'
    ].join('');
    var plainBody = [
      'Cordial saludo ' + data.fullName + '.', '',
      'Se generó el paquete documental ambiental de ' + data.institutionName + ' desde SiMeCO₂.', '',
      'Adjuntos:',
      '1. Informe de Gestión Energética PGEE-UPME.',
      '2. Plan de Ahorro de Agua.',
      '3. Plan de Gestión y Uso Eficiente del Gas.',
      '4. Predimensionamiento Solar completo.', '',
      'Expediente Drive: ' + expediente.folderUrl,
      expediente.sheetUrl ? 'Google Sheets editable: ' + expediente.sheetUrl : '', '',
      'Código: ' + codeId, '',
      'Cordialmente,', AUTHOR_NAME, 'Líderes Ambientales de Medellín'
    ].filter(String).join('\n');
    var mail = {
      to: data.email,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'Líderes Ambientales de Medellín',
      replyTo: CONTACT_EMAIL,
      attachments: attachmentSelection.attachments
    };
    if (COPY_EMAIL) mail.cc = COPY_EMAIL;
    MailApp.sendEmail(mail);
    emailed = true;
  }

  return {
    ok: true,
    code: codeId,
    emailed: emailed,
    sentTo: emailed ? data.email : '',
    reports: [energyPlan.getName(), waterPlan.getName(), gasPlan.getName(), solarPdf.getName()],
    links: expediente,
    solar: {
      consumption: data.consumption,
      tariff: data.tariff,
      coverage: data.coverage,
      kwp: data.kwp,
      panels: data.panels,
      area: data.area,
      generationMonthly: data.generationMonthly,
      monthlySaving: data.monthlySaving,
      projectValue: data.projectValue,
      finance48: data.finance48,
      finance60: data.finance60,
      finance120: data.finance120
    }
  };
}

function createSiMeCO2PlanExpediente_(d, codeId, files) {
  var parent = DriveApp.getFolderById(DATABASE_FOLDER_ID);
  var folderName = [codeId, safeName_(d.institutionName || 'Sin_institucion'), 'Plan_Ambiental', Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss')].join(' · ');
  var folder = parent.createFolder(folderName);
  var energy = saveBlobInFolder_(folder, files.energyPlan, '02_Plan_reduccion_GEI_' + safeName_(d.institutionName) + '.pdf');
  var water = saveBlobInFolder_(folder, files.waterPlan, '03_Plan_ahorro_agua_' + safeName_(d.institutionName) + '.pdf');
  var gas = saveBlobInFolder_(folder, files.gasPlan, '04_Plan_ahorro_gas_' + safeName_(d.institutionName) + '.pdf');
  var solar = saveBlobInFolder_(folder, files.solarPdf, '05_Predimensionamiento_solar_' + safeName_(d.institutionName) + '.pdf');
  var sheet = createReductionPlanGoogleSheet_(folder, d, codeId);
  var requesterAccessGranted = d.email ? grantPrivateFolderAccess_(folder, d.email) : false;
  if (sheet && d.email) grantEditableFileAccess_(sheet, d.email);
  return {
    folderUrl: folder.getUrl(),
    requesterAccessGranted: requesterAccessGranted,
    energyUrl: energy.getUrl(),
    waterUrl: water.getUrl(),
    gasUrl: gas.getUrl(),
    solarUrl: solar.getUrl(),
    sheetUrl: sheet ? sheet.getUrl() : '',
    sheetId: sheet ? sheet.getId() : ''
  };
}
