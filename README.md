# SiMeCO₂ v99 — Selección lateral visible

La v99 corrige el estado activo del menú lateral dentro de Google Sites. La opción seleccionada conserva siempre un fondo sólido de alto contraste, incluso cuando `body.is-embedded` está activo. En móvil, el menú funciona como drawer tipo app y centra automáticamente el módulo activo.

---
# SiMeCO₂ v98 — Sidebar lateral legible

La versión v98 corrige el problema visual observado en Google Sites donde los nombres de los módulos podían partirse letra por letra. El sidebar ahora usa una estructura flex estable: número a la izquierda y texto ocupando todo el ancho restante.

- Escritorio: 296 px.
- Iframe/tablet: 238 px.
- Móvil: drawer lateral de hasta 350 px.
- Modo contraído: muestra solo los números/iconos; no comprime los textos.

---
# SiMeCO₂ v97 — Navegación lateral

La navegación principal de SiMeCO₂ ahora es un **menú lateral** diseñado para funcionar correctamente dentro de un iframe de Google Sites.

### Escritorio
El menú aparece a la izquierda del contenido, agrupado en **Electricidad**, **Recursos** y **Fuentes**. Puede contraerse para ampliar el área del dashboard.

### Google Sites / tablet
Cuando el ancho disponible disminuye, el menú se convierte automáticamente en un **rail lateral compacto** que conserva únicamente los números e identidades visuales de los módulos.

### Móvil
El menú se convierte en un **drawer lateral** que se abre mediante un botón “Menú”. No existe una segunda barra inferior, evitando duplicidad y pérdida de espacio.

### Orden
1. Analizar Datos
2. Histórico
3. Ranking
4. Informe por sede
5. Estado de Información
6. Aula
7. Agua
8. Gas
9. Facturas por I.E. — transversal

---
# SiMeCO₂ v96 — Navegación reorganizada para Google Sites

El menú principal queda organizado así:

1. **Analizar Datos** — ⚡ Electricidad  
2. **Histórico** — ⚡ Electricidad  
3. **Ranking** — ⚡ Electricidad  
4. **Informe por sede** — ⚡ Electricidad  
5. **Estado de Información** — ⚡ Electricidad  
6. **Aula** — ⚡ Electricidad  
7. **Agua** — 💧 Agua  
8. **Gas** — 🔥 Gas  
9. **Facturas por I.E.** — 📄 Módulo transversal

**Facturas por I.E. no pertenece a Electricidad, Agua ni Gas.** Su función es centralizar la consulta y descarga de las fuentes PDF utilizadas por SiMeCO₂.

La navegación fue ajustada para incrustación en Google Sites: cuadrícula de tres columnas en escritorio, dos columnas en anchos de iframe/tablet y navegación táctil horizontal en móvil.

---
# SiMeCO₂ v95 — Identidad de módulos y gráficos históricos de Agua/Gas

La versión v95 organiza visualmente SiMeCO₂ por recurso:

- **Módulos 1–7: ⚡ Electricidad**
- **Módulo 8: 💧 Agua**
- **Módulo 9: 🔥 Gas**

Cada sección muestra una insignia de recurso y las pestañas superiores indican de forma explícita a qué recurso corresponde cada módulo. En móvil, los módulos 1–7 también se presentan como “Electricidad · …”.

## Gráficos en planes de acción

Los planes personalizados de **Agua** y **Gas** incluyen ahora una gráfica de barras dentro de su respectivo apartado histórico:

- “Histórico de agua de la sede”
- “Histórico de gas de la sede”

La gráfica se construye directamente con los registros mensuales de la sede, utiliza los mismos valores de la tabla, resalta el último periodo y está implementada como **SVG inline**. Por eso se mantiene visible dentro del documento A4 cuando el usuario selecciona **Guardar como PDF**.

---
# SiMeCO₂ v94 — Módulo 9 Gas

La versión v94 conserva los módulos de **Energía** y **Agua** e incorpora una nueva **sección 9: Gas**, enfocada en análisis de consumo, ahorro y planes de acción por sede.

## Funciones del módulo Gas

- Consumo oficial acumulado de gas basado en el resumen de la página 1 de cada factura PDF.
- Histórico mensual de los 17 periodos oficiales con acceso directo al PDF fuente.
- Ranking de sedes/cuentas que más consumen gas, con filtro mensual, búsqueda, Google Maps y paginación.
- Ranking de ahorro de gas:
  - comparación mensual únicamente entre meses calendario consecutivos con lectura válida;
  - tendencia general con **Índice de Gestión del Ahorro de Gas = 70% constancia + 30% magnitud del ahorro neto**.
- Plan de Acción de Ahorro de Gas para cualquier sede.
- El plan incluye diagnóstico, consumo acumulado, promedio, tendencia, prioridad relativa, meta propuesta, acciones, responsables, plazos e indicadores.
- El plan se abre como informe A4 y puede guardarse como **PDF**.
- Las sedes sin lectura de gas reciben un plan de línea base y verificación técnica, sin inventar consumos.
- Por seguridad, el sistema no recomienda manipular instalaciones de gas: toda intervención en redes, válvulas o equipos debe realizarla personal competente o autorizado.
- La carga futura de PDF extrae energía, agua y gas y actualiza los módulos correspondientes sin releer las 17 facturas canónicas que no hayan cambiado.

## Control de calidad de gas

- 9.147 registros base.
- 381 registros con lectura de gas.
- 304 lecturas reales de **0 m³**, conservadas como datos válidos.
- 28 sedes/cuentas con al menos una lectura de gas.
- 11 sedes/cuentas con consumo positivo acumulado.
- 17 periodos oficiales.
- Consumo oficial acumulado: **1.094,52 m³**.
- Consumo detallado vinculado: **1.095,658 m³**.
- Diferencia acumulada detalle/oficial: **0,104%**.
- Diferencia máxima mensual: **2,274%**, dentro del umbral de control del 3%.
- 2 sedes/cuentas presentan ahorro neto verificable en la tendencia general con las comparaciones consecutivas disponibles.

---

# SiMeCO₂ v93 — Módulo 8 Agua

La versión v93 conserva los módulos eléctricos de SiMeCO₂ e incorpora una nueva **sección 8: Agua**, diseñada para gestión hídrica escolar.

## Funciones del módulo Agua

- Consumo oficial acumulado de agua basado en el resumen de la página 1 de cada factura PDF.
- Histórico mensual de los 17 periodos oficiales con acceso a la factura fuente.
- Ranking de sedes que más consumen agua, con filtro mensual, búsqueda, Google Maps y paginación.
- Ranking de sedes que más ahorran agua:
  - por mes: compara únicamente meses calendario consecutivos con lectura válida;
  - tendencia general: Índice de Gestión del Ahorro de Agua = 70% constancia + 30% magnitud del ahorro neto.
- Plan de Acción de Ahorro de Agua para cualquier sede.
- El plan incluye diagnóstico, cobertura, consumo acumulado, promedio mensual, tendencia, prioridad relativa, meta recomendada, acciones, responsables, plazos e indicadores.
- El plan puede abrirse como informe A4 y guardarse en **PDF**.
- Las sedes sin lectura de agua también reciben un plan, orientado primero a construir una línea base confiable.
- La carga futura de PDF extrae energía y agua; los nuevos datos se integran al módulo 8 sin procesar de nuevo las facturas canónicas que no cambiaron.

## Control de calidad de agua

- 9.147 registros base.
- 7.317 registros con lectura de agua.
- 256 lecturas reales de 0 m³, conservadas como datos válidos.
- 17 periodos oficiales.
- Consumo oficial acumulado: **1.351.583,22 m³**.
- Consumo detallado vinculado: **1.337.964,432 m³**.
- Diferencia acumulada detalle/oficial: **1,008%**.
- Diferencia máxima por periodo: **4,162%**, dentro del umbral de control del 5%.
- 446 sedes/cuentas con al menos una lectura de agua.
- 103 sedes con ahorro neto verificable en la tendencia general.

---

## Actualización v67 — Identificación por dirección en rankings

- El ranking de consumo muestra cada I.E./sede junto a su dirección.
- El ranking de ahorro muestra cada I.E./sede junto a su dirección.
- La dirección se presenta en una cápsula visual contigua al nombre para diferenciar sedes con nombres similares.
- Se conserva búsqueda, filtros, paginación, tratamiento de datos faltantes y cálculo de ahorro de v66.

## Actualización v66 — Ranking de ahorro eléctrico

Se incorpora un segundo ranking debajo del ranking de consumo. Este nuevo módulo reconoce las sedes que disminuyen su energía mes a mes, permite seleccionar un periodo y compara únicamente contra el mes calendario anterior cuando ambos poseen una lectura válida. La tendencia general resume el ahorro neto y la constancia de las disminuciones sin inventar comparaciones a través de meses faltantes.

## Actualización v60

La versión v60 incorpora agrupación institucional por sedes. El primer caso verificado integra las dos cuentas de Fe y Alegría Santo Domingo Savio sin modificar la trazabilidad de los registros originales.

# SiMeCO₂ v58 — Calidad de datos, histórico multivariable y trazabilidad por sede

Plataforma web de la **Huella de Carbono Educativa de Medellín** para consultar facturas de servicios públicos, comparar periodos, priorizar sedes, generar informes y construir planes de gestión ambiental escolar.

## Corrección principal del histórico

Las dos gráficas observadas no representaban una variación real del consumo. El sistema estaba mezclando resultados parciales de la lectura detallada de los PDF con datos almacenados previamente en el navegador. Según el orden de carga, algunos meses podían aparecer completos y otros incompletos.

Desde v56 se separaron claramente las dos fuentes:

- **Histórico general de Medellín:** utiliza únicamente el valor **ACTUAL** del “Resumen de facturación” de la página 1 de cada PDF oficial.
- **Búsqueda, ranking e informe por sede:** utilizan los registros detallados extraídos del cuerpo de cada factura.
- **Conciliación:** cada periodo compara el detalle por sede con el total oficial y registra la diferencia porcentual.

Así, la gráfica general ya no depende del orden de procesamiento de PDF.js ni de una caché previa.

## Datos incluidos

- 17 facturas PDF oficiales.
- 17 periodos entre enero de 2025 y julio de 2026.
- 9.147 registros detallados por sede y servicio.
- 533 registros detallados para julio de 2026.
- 0 claves duplicadas.
- 0 registros con nombre de sede vacío.
- 246 coincidencias territoriales verificadas o de referencia.

Los totales oficiales de energía que alimentan la gráfica general están en `data/resumenes.json`. El detalle está en `data/registros.json`.


## Mejoras de v58

### Calidad y cobertura de datos

- Nuevo panel **Calidad y trazabilidad** con cobertura energética y territorial.
- Estados por sede: **Datos completos**, **Datos parciales**, **Energía no identificada** y **En revisión**.
- La ausencia de una lectura ya no se interpreta como consumo cero.
- Tabla de sedes que requieren verificación con acceso directo a su ficha integral.

### Histórico multivariable

- El histórico ya no está limitado a energía: permite seleccionar **Energía, Agua, Alcantarillado, Gas natural y Aseo/Residuos**.
- La gráfica, la tabla de valores exactos, la comparación, la interpretación automática y el informe PDF cambian según el indicador seleccionado.
- Energía, agua, alcantarillado y gas usan el resumen oficial cuando se consulta todo Medellín.
- Residuos usa el detalle por sede porque no existe un total volumétrico equivalente en la portada de la factura.

### Ranking por servicio

- El ranking puede ordenarse por energía, agua, alcantarillado, gas o residuos.
- Las sedes sin lectura del servicio seleccionado permanecen visibles al final como pendientes.
- No se asigna artificialmente 0 a un dato faltante.

### Ficha integral por sede

- Nombre oficial y alias usado en la factura.
- Dirección, comuna/corregimiento, núcleo, zona y confianza del vínculo.
- Cobertura por servicio y número de periodos.
- Estado de calidad de datos.
- Enlace de trazabilidad a la factura y página más reciente asociada a la sede.

### Consulta institucional

- `busqueda-institucional.html` conserva valores faltantes como tales.
- Para una sede sin electricidad individualizada se muestra **“No identificada”** y CO₂e **“No calculable”**, en vez de 0.
- La búsqueda reconoce el nombre oficial, nombre de factura y alias sincronizados.

### Caché

- Nueva versión: `simeco2_servicios_v11`, para evitar reutilizar estados anteriores incompatibles.

## Mejoras de v57

### Consultas institucionales y datos faltantes

- Una sede ya no desaparece del Dashboard por no tener lectura de energía eléctrica.
- El sistema diferencia **“Sin dato”** de un consumo real de **0 kWh**.
- El Dashboard muestra también agua, alcantarillado, gas y aseo/residuos cuando están disponibles.
- Se incorporó una advertencia explicativa para sedes con otros servicios registrados pero sin energía asociada.
- Se vinculó **“Inem J F De Rpo” (Cr 48 Cl 1 -125)** con **“I.E. INEM José Félix de Restrepo”**, Núcleo 932, El Poblado.
- El autocompletado acepta nombre oficial, nombre abreviado de factura, alias y dirección.
- Los Planes de Gestión no calculan CO₂e, árboles ni metas porcentuales cuando falta el dato eléctrico; generan en su lugar un plan de calidad y asociación de datos.
- Nueva versión de caché: `simeco2_servicios_v10`.

## Mejoras heredadas de v56

### Históricos

- Fuente oficial estable para todos los periodos.
- Escala vertical y cuadrícula legibles.
- Contenedor horizontal desplazable para evitar que 17 periodos se amontonen.
- Etiquetas de valores exactos y tabla accesible debajo de la gráfica.
- Nota visible que informa si el gráfico usa el resumen oficial o el detalle de una sede.
- Comparación inicial/final e informe histórico en PDF.

### Carga y almacenamiento

- La versión v56 introdujo la caché `simeco2_servicios_v9`; v57 la renueva a `simeco2_servicios_v10` para invalidar resultados anteriores.
- Los 9.147 registros canónicos se cargan desde los archivos JS del proyecto y no se duplican en `localStorage`.
- El navegador solo conserva archivos importados o modificados por el usuario.
- Al reemplazar una factura se eliminan primero sus registros anteriores.
- Las facturas se identifican por Git blob SHA-1 y se verifican también con SHA-256.

### Lectura de facturas

- Parser contextual para formatos numéricos colombianos.
- Segmentación por “Prestación del servicio” para manejar continuaciones entre páginas.
- Lectura diferenciada de energía, agua, alcantarillado, gas, aseo y residuos.
- Se eliminó el corte fijo que podía descartar información de bloques extensos.
- Julio de 2026 quedó precargado y no depende de procesamiento posterior.

### Sistema completo

- Inicialización segura aunque una página no contenga todos los controles del `index`.
- Tablas adaptadas automáticamente al número de columnas de cada módulo.
- Filtros por nombre o dirección con observación visible para el usuario.
- Sincronización territorial por sede y dirección, con nombres reales de comunas y corregimientos.
- Exportación CSV y JSON de la consulta.
- Plan de Gestión Ambiental descargable como PDF o HTML independiente.
- Limpieza de archivos residuales y copias obsoletas.

## Estructura principal

- `index.html`: aplicación principal.
- `dashboard.html`: informe ambiental por sede.
- `aula-climatica.html`: módulo pedagógico y de registros.
- `busqueda-institucional.html`: consulta institucional.
- `filtros-territoriales.html`: consulta territorial.
- `app.js`: lógica principal.
- `styles.css`: estilos generales y responsive.
- `assistant.js`: Asistente Ambiental local.
- `data/registros.js` / `data/registros.json`: detalle precargado.
- `data/resumenes.js` / `data/resumenes.json`: totales oficiales.
- `data/manifest.json`: integridad, tamaño, páginas y periodos de los PDF.
- `data/sincronizacion-territorial.js`: clasificación territorial.
- `tools/`: regeneración y validación de los datos.

## Ejecución local

No abra el proyecto únicamente con `file://`, porque algunos navegadores limitan la lectura de recursos locales. Desde la carpeta del proyecto ejecute:

```bash
python3 -m http.server 8000
```

Luego abra `http://localhost:8000/`.

## Publicación en GitHub Pages

1. Suba **todo el contenido** del proyecto al repositorio, conservando la carpeta `data`.
2. En GitHub vaya a **Settings → Pages**.
3. Seleccione la rama de publicación y la carpeta raíz.
4. Espere la publicación y abra la URL generada.
5. Para insertarla en Google Sites use **Insertar → Incorporar → URL**.

La información precargada funciona desde los archivos locales del proyecto. La lectura de facturas nuevas usa PDF.js desde CDN y requiere conexión a internet.

## Controles de calidad

Ejecute:

```bash
python3 tools/validar_sistema.py
```

Este control verifica:

- sintaxis de todos los JavaScript;
- compilación de las herramientas Python;
- validez de JSON;
- referencias locales e IDs HTML;
- orden de los scripts de datos;
- carga de los bundles JS;
- número de registros y periodos;
- duplicados y nombres vacíos;
- conciliación de energía, agua, alcantarillado y gas;
- tamaño, páginas, SHA-256 y Git blob SHA-1 de los 17 PDF.

Los resultados quedan en:

- `CONTROL-CALIDAD-v57.txt`
- `CONTROL-CALIDAD-HISTORICOS-v56.txt`

## Alcance de la validación

La entrega fue sometida a validación estática, estructural, sintáctica, documental y de integridad de datos. El entorno de construcción bloquea la navegación automatizada del navegador a rutas locales; por eso la validación visual final debe hacerse en la URL definitiva de GitHub Pages y dentro de Google Sites. La validación estática y de regresión específica para el caso INEM queda incluida en `tools/validar_sistema.py`.


## v59 · Contratos separados y trazabilidad energética

SiMeCO₂ distingue ahora tres estados eléctricos diferentes: consumo medido, energía no identificada y energía gestionada mediante contrato separado. La primera excepción verificada es la I.E. INEM José Félix de Restrepo (Cr 48 Cl 1 -125): el consolidado educativo contiene otros servicios, mientras la documentación pública del Distrito identifica la sede dentro del suministro de energía para usuario no regulado. La plataforma no asigna 0 kWh ni calcula CO₂e/ranking energético hasta incorporar una serie eléctrica verificable de esa fuente.

## v61 · API y Asistente Ambiental IA

La v61 añade una API serverless en `/api` y conecta el widget **Asistente Ambiental** con OpenAI mediante function calling. La clave de OpenAI permanece en el servidor. Si la API no está configurada o falla, el asistente vuelve automáticamente al modo local básico.

Consulta `API-SIMECO2-v61.md` e `INSTRUCCIONES-DESPLIEGUE-v61.txt` antes de publicar.

## v65 · Rendimiento y consultas data-first

La versión 65 optimiza la carga sin cambiar la fuente de verdad. El navegador usa `data/registros.compact.js` (mismos 9.147 registros), PDF.js/PDF-Lib se cargan bajo demanda y la tabla detallada pagina 200 filas. El asistente resuelve consultas estructuradas directamente desde la API de SiMeCO₂; OpenAI se reserva para análisis avanzados. Por ello, conteos, informes institucionales, ranking, calidad de datos y casos como INEM pueden seguir respondiendo aunque exista una incidencia temporal de cuota de IA.

Para diagnóstico de OpenAI usa manualmente `/api/health?probe=1`. La interfaz normal usa `/api/health` y no consume una comprobación a OpenAI en cada apertura.
