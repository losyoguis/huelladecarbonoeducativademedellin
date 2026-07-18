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
