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
