# SiMeCO₂ Servicios Públicos v6

Sistema web estático en HTML, CSS y JavaScript para importar facturas consolidadas de EPM de sedes educativas, detectar automáticamente mes y año, acumular registros históricos y comparar periodos.

## Archivos

- `index.html`: interfaz principal.
- `styles.css`: estilos responsive tipo app.
- `app.js`: lectura PDF, extracción de datos, almacenamiento y comparación.
- `data/`: carpeta sugerida para guardar los JSON mensuales en GitHub.

## Instalación en GitHub Pages

1. Descomprime el ZIP.
2. Sube todos los archivos al repositorio de GitHub.
3. Verifica que exista la carpeta `data`.
4. Activa GitHub Pages desde Settings > Pages.
5. Abre la URL publicada.

## Uso mensual

1. Clic en **Seleccionar PDF**.
2. Sube la factura consolidada de EPM.
3. El sistema identifica el mes y año desde el texto: `Resumen de facturación [Mes] de [Año]`.
4. Los datos quedan guardados en el navegador.
5. Clic en **Descargar JSON para /data**.
6. Sube el archivo generado, por ejemplo `2025-01.json`, a la carpeta `data` del repositorio.

## Guardado directo en GitHub

El sistema incluye guardado directo usando la API de GitHub. Para usarlo necesitas:

- Usuario/owner.
- Nombre del repositorio.
- Rama, normalmente `main`.
- Token personal de GitHub con permisos de escritura sobre el repositorio.

Advertencia: no guardes tokens dentro del código ni los publiques. Para un sistema institucional se recomienda usar backend o GitHub Actions.

## Comparación mensual

Después de cargar dos o más facturas puedes seleccionar Periodo A y Periodo B para comparar:

- Energía kWh.
- Agua m³.
- Alcantarillado m³.
- Gas m³.
- CO₂ kg.

## Nota técnica

GitHub Pages es un hosting estático. Por seguridad, una página HTML no puede escribir archivos directamente dentro del repositorio sin usar API, token, backend o flujo de carga manual. Por eso el sistema ofrece dos opciones: descarga JSON para subir a `/data` o guardado directo mediante API de GitHub.
