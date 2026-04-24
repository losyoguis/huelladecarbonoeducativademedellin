# SiMeCO₂ Servicios Públicos Educativos

Sistema web estático en HTML, CSS y JavaScript para importar mensualmente facturas consolidadas de EPM en PDF y alimentar una base histórica local de servicios públicos por sede educativa.

## Archivos

- `index.html`: interfaz principal.
- `css/styles.css`: estilos responsivos tipo aplicación.
- `js/app.js`: lectura del PDF, extracción de datos, almacenamiento local, dashboard y exportaciones.

## Uso

1. Abre `index.html` en el navegador o publícalo en GitHub Pages.
2. Selecciona el mes de análisis.
3. Haz clic en **Seleccionar PDF** y carga la factura consolidada mensual.
4. El sistema leerá el PDF, buscará los bloques `Prestación del servicio` y extraerá consumos y valores de agua, alcantarillado, energía, gas y aseo.
5. Cada nueva carga mensual se guarda en el navegador mediante `localStorage`.
6. Exporta los datos en CSV o JSON para respaldo o análisis en Excel.

## Corrección aplicada en esta versión

La versión anterior podía mostrar el mensaje “No se identificaron registros” porque algunos navegadores entregan el texto del PDF en un orden visual diferente. Esta versión incorpora:

- Lectura profunda del PDF por coordenadas de texto.
- Fallback de lectura plana si la lectura por líneas falla.
- Búsqueda flexible de `Prestación del servicio` con y sin acento.
- Diagnóstico visible con número de marcadores encontrados.
- Parser más tolerante para valores de agua, alcantarillado, energía, gas y aseo.

## Recomendación

Para un funcionamiento estable, publícalo en GitHub Pages. Si lo abres directamente desde el computador, debe existir conexión a internet para cargar PDF.js y Chart.js desde CDN.
