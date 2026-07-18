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


## Filtros territoriales de sedes (v34)

La plataforma incluye filtros globales por nombre o dirección, comuna/corregimiento, núcleo educativo, periodo, servicio disponible y prioridad energética. Los filtros se aplican al comparador, ranking, dashboard y registros.

Como las facturas de servicios públicos no incluyen comuna ni núcleo, el botón **Clasificar sedes** permite asignarlos manualmente. La clasificación se conserva en el almacenamiento local del navegador y se incluye en las exportaciones CSV y JSON.

## Actualización v36 · filtros territoriales dependientes

Se incorporó el directorio territorial de 422 sedes educativas usado por la Red Escolar de Pluviómetros de Medellín. La plataforma intenta relacionar automáticamente las sedes encontradas en las facturas y habilita filtros en cascada por zona, tipo de territorio, comuna o corregimiento, barrio o vereda, núcleo, tipo de sede y sede específica. La clasificación puede revisarse manualmente desde la interfaz y queda guardada en el navegador.


## Módulos independientes
- `dashboard.html`: Dashboard ambiental por sede.
- `filtros-territoriales.html`: Búsqueda territorial y filtros de sedes educativas.
- `aula-climatica.html`: Aula climática.

Todos incluyen un botón “Volver al inicio” que dirige a `index.html#inicio`.

## Corrección de secuencia inicial
- Se restauró la diapositiva de ranking en `index.html`.
- El ranking se dibuja aunque la tabla completa del Dashboard esté en una página independiente.
- La secuencia continúa automáticamente: carga → ranking → indicadores → portada.
- Se añadió una salida segura hacia la portada si una diapositiva no está disponible.


## Reparación integral v50
- Se corrigieron listeners que detenían todo el JavaScript cuando una página no incluía determinados botones.
- Cada página inicializa únicamente los controles que realmente contiene.
- Se reparó el flujo carga → ranking → indicadores → portada.
- Se forzó una nueva versión de CSS y JavaScript para evitar que el navegador use archivos antiguos en caché.
- Las páginas publicadas usan los archivos fuente validados `app.js` y `styles.css`.

## Corrección de carga de datos (v60)
- Se corrigió una declaración duplicada de `isServiceMarker` que dejaba las funciones de análisis de PDF fuera del alcance global.
- Se añadió `data/registros.json` con la base consolidada para que gráficas e informes carguen de inmediato sin esperar el reprocesamiento de miles de páginas PDF.
- Si la base consolidada no está disponible, el sistema conserva el procesamiento directo de las facturas como respaldo.
- Se corrigió la interpretación numérica colombiana: `12.384` se procesa como 12 384 y `12.384,50` como 12 384,50.
