# SiMeCO₂ v44 — Comparación inicial/final y PDF estable

- Histórico selecciona automáticamente el primer y el último periodo disponible.
- Se corrigió la generación del informe histórico PDF.
- Los informes se abren en una vista previa independiente y solo muestran el diálogo de impresión al pulsar **Guardar como PDF**, evitando bloquear la plataforma.
- Se eliminó el botón PDF general del dashboard por sede.
- Se reforzó la generación del Plan de Gestión por sede para evitar doble ejecución o bloqueo de la página.

---

# SiMeCO₂ v43 — Interfaz sin filtros territoriales

- Se retiraron de la interfaz los filtros por comuna, corregimiento y núcleo educativo.
- Histórico conserva la comparación por tipo, sede y periodos.
- Informe por sede conserva el buscador institucional y la descarga PDF.
- Facturas por I.E. conserva búsqueda por sede, periodo, servicio y ordenamiento.
- Los controles internos se mantienen ocultos para garantizar compatibilidad con la lógica existente.

---

# SiMeCO₂ v42 — Etiquetas más claras y prioridades con mayor contraste

- El gráfico histórico ahora muestra etiquetas de periodo más comprensibles, con abreviaturas de mes y año.
- La columna **Prioridad** del dashboard muestra solo el nivel: **Alta**, **Media** o **Preventiva**.
- La leyenda y los chips de prioridad usan colores con mayor contraste para facilitar la lectura.

---

# SiMeCO₂ v39 — Carga automática de facturas

- Las facturas se cargan automáticamente al abrir la plataforma.
- Se muestra el mensaje “Espere, cargando facturas...” durante el proceso.
- Se evita ejecutar dos cargas simultáneas.
- El botón Actualizar datos continúa disponible para actualizaciones manuales posteriores.
- Se informa visualmente cuando la carga finaliza o presenta un error.

---

# SiMeCO₂ v37

## Novedad principal
Todos los campos de selección usados para búsqueda, filtros y comparaciones cuentan ahora con autocompletado: se puede escribir para filtrar opciones, navegar con flechas y confirmar con Enter.

Incluye autocompletado en tipo de comparación, sede, periodos, filtro de periodo, servicio y ordenamiento, además del buscador institucional existente. Se conserva la lógica original de los selectores y la compatibilidad con GitHub Pages y Google Sites.

# SiMeCO₂ · Plataforma de Huella de Carbono Educativa v32

Sistema web en HTML, CSS y JavaScript para medir, visualizar e interpretar la huella de carbono educativa a partir del consumo de servicios públicos de sedes educativas.

## Propósito

SiMeCO₂ transforma información de facturas en indicadores ambientales comprensibles para directivos, docentes, estudiantes y aliados técnicos. La plataforma permite estimar emisiones de CO₂e en alcance 2, priorizar sedes con mayor consumo eléctrico y generar planes de gestión ambiental escolar.

## Mejoras incorporadas en v32

- Portada institucional con enfoque de proyecto educativo ambiental.
- Resumen ejecutivo automático con lectura interpretativa.
- Indicadores de impacto del proyecto.
- Alertas inteligentes sobre sedes prioritarias, aumentos o reducciones de consumo.
- Comparación de periodos con interpretación automática.
- Ranking de sedes con clasificación de prioridad: alta, media y preventiva.
- Dashboard por sede con chips de prioridad.
- Plan de Gestión fortalecido con matriz operativa, responsables, indicadores y evidencias.
- Módulo pedagógico “Aula climática / Guardianes Climáticos”.
- Se elimina el botón de modo presentación de la portada para una interfaz más limpia.
- Mejoras responsive tipo app móvil: navegación inferior y tablas convertidas en tarjetas.
- Textos institucionales más claros y orientados a toma de decisiones.

## Archivos principales

```text
index.html        Estructura de la plataforma
styles.css        Diseño visual, responsive y experiencia móvil
app.js            Lógica de lectura, cálculos, visualizaciones, planes e interpretaciones
data/             Carpeta con archivos de soporte y PDF existentes
```

## Uso básico

1. Publicar el proyecto en GitHub Pages o abrirlo en un servidor local.
2. Entrar a la web.
3. Presionar **Actualizar datos ahora** o usar **Cargar factura PDF local** para pruebas.
4. Revisar el resumen ejecutivo, dashboard, ranking y comparación de periodos.
5. En el dashboard por sede, presionar **Generar informe / Plan de Gestión**.
6. Descargar o imprimir el informe institucional.

## Metodología ambiental

Las emisiones se calculan con la fórmula:

```text
Emisiones CO₂e = consumo eléctrico en kWh × factor de emisión kg CO₂e/kWh
```

El sistema permite modificar el factor de emisión y la equivalencia de captura anual por árbol desde el dashboard ambiental.

## Recomendación de publicación

Para GitHub Pages, subir todos los archivos conservando esta estructura. El archivo principal debe llamarse `index.html`.



## Actualización v31 · Footer institucional Los Yoguis

Esta versión incorpora un pie de página institucional con la imagen oficial de Los Yoguis y el enlace central a `www.losyoguis.com`.

Archivos actualizados:

- `index.html`
- `styles.css`
- `assets/los-yoguis-footer.png`

## Mejoras incorporadas en v32

- Se rediseñó el bloque **Actualizando los datos** con una apariencia más llamativa e institucional.
- Se incorporó el mensaje: carga de facturas de servicios públicos de todas las Instituciones Educativas de Medellín desde el año 2025.
- Se añadieron distintivos visuales de alcance: Medellín, Instituciones Educativas y Desde 2025.
- Se conservaron los identificadores funcionales de botones y lectura PDF para mantener la compatibilidad del sistema.


## Cabecera Los Yoguis v31

- Cabecera adaptada al estilo visual Guardianes Climáticos / Los Yoguis.
- Botón principal hacia **Red Escolar de Pluviómetros de Medellín**.
- Logo Los Yoguis integrado en cabecera y favicon.
- Se mantiene la tarjeta destacada de **Huella de Carbono Educativa de Medellín**.


## Ajuste visual v31

- Se agregó movimiento al botón principal **Actualizar datos ahora** mediante pulso, brillo, barrido luminoso e ícono de actualización animado.
- El botón conserva accesibilidad con `aria-label` y respeta `prefers-reduced-motion`.


## Actualización v34 — Autocompletado y filtros

- Buscador inteligente por institución, sede y dirección.
- Coincidencias sin depender de tildes y con múltiples palabras.
- Sugerencias ordenadas por relevancia, dirección y periodos disponibles.
- Navegación del autocompletado con teclado (flechas, Enter y Escape).
- Selección exacta de una sede.
- Filtros combinables por periodo y servicio con datos.
- Ordenamiento por periodo, sede, energía y CO₂e.
- Contador de registros y sedes visibles.
- Etiquetas de filtros activos y limpieza individual o general.
- Estado vacío con orientación para recuperar resultados.
- `manifest.json` actualizado con todos los PDF incluidos.


## Ajuste v34
- El módulo de carga y actualización de facturas se ubicó como primera sección después del encabezado y la navegación principal.
- Se eliminó el módulo “Indicadores de avance y alertas inteligentes”.

## Versión 35 · Organización en cuatro secciones

La plataforma se reorganizó como una aplicación de cuatro secciones internas, sin recargar la página y conservando todos los cálculos y controles:

1. Resumen institucional: carga de facturas, lectura ejecutiva e indicadores generales.
2. Análisis temporal: comparación de periodos y ranking de sedes.
3. Gestión por sede: dashboard ambiental y planes de gestión institucional.
4. Aula y registros: Guardianes Climáticos, autocompletado, filtros, exportaciones y tabla de registros.

La navegación funciona mediante pestañas superiores y una barra móvil. Los enlaces directos y los botones de generación de planes activan automáticamente la sección correspondiente.

## Versión 36 · cinco módulos

- Se eliminaron los dos botones del encabezado principal.
- El módulo 1 ahora se llama **Actualizar datos** y su botón ejecuta directamente la actualización de facturas.
- El módulo 2 se llama **Histórico**.
- El módulo 3 se llama **Informe por sede**.
- El módulo 4 se llama **Facturas por I.E.** e incluye filtros, registros y descarga directa de la factura desde la columna Fuente.
- Se creó el módulo 5 **Aula**, donde se trasladó íntegramente Guardianes Climáticos.


## Versión 39
- Autocompletado de instituciones y sedes en Histórico.
- Buscador con autocompletado en Informe por sede.
- Búsqueda tolerante a tildes, nombres parciales y direcciones.
- Navegación por teclado y limpieza rápida de cada buscador.

## Versión 40 · filtros territoriales jerárquicos

Se incorporaron filtros combinables en Histórico, Informe por sede y Facturas por I.E.:

- Ámbito territorial: Medellín, comuna, corregimiento o registros sin clasificar.
- Comuna o corregimiento dependiente del ámbito elegido.
- Núcleo educativo dependiente del territorio.
- Institución o sede con autocompletado limitado por los filtros territoriales activos.

La clasificación prioriza coincidencias institucionales conocidas y reglas territoriales presentes en el nombre o la dirección. Los registros que todavía no tienen una relación territorial confiable se conservan bajo **Sin clasificar**, evitando asignaciones inventadas. Para ampliar la cobertura se deben añadir relaciones verificadas al catálogo `TERRITORY_CATALOG` de `app.js`.


## Versión 41
- Filtros territoriales visibles en Histórico, Informe por sede y Facturas por I.E.
- Listado base de las 16 comunas y los 5 corregimientos de Medellín.
- Descargas de resultados limitadas a informes en PDF mediante una plantilla institucional mejorada.
- Eliminadas las exportaciones CSV, JSON y HTML.
