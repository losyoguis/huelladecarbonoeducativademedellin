# SiMeCO₂ · Dashboard de Servicios Públicos Educativos

Versión v8 con dashboard ambiental por sede.

## Qué hace

- Lee facturas PDF consolidadas de EPM ubicadas en la carpeta `data/`.
- Identifica automáticamente el periodo real desde el texto de la factura, por ejemplo: `Resumen de facturación Abril de 2025`.
- Importa sedes nuevas automáticamente cuando aparecen en futuros PDF.
- Calcula por sede:
  - Consumo total de energía eléctrica en kWh.
  - Toneladas de dióxido de carbono equivalente, t CO₂e.
  - Número estimado de árboles requeridos para mitigar ese CO₂e.
  - Promedio mensual de consumo en kWh.
- Muestra el total general del sistema.
- Permite comparar meses cargados.
- Exporta CSV y JSON.

## Cómo usarlo en GitHub Pages

1. Sube todos los archivos del ZIP al repositorio.
2. Sube las facturas PDF a la carpeta `data/`.
3. En `data/manifest.json`, registra los PDF que quieras leer, por ejemplo:

```json
{
  "files": [
    "Enero.pdf",
    "Abril2025.pdf"
  ]
}
```

4. Abre la página publicada en GitHub Pages.
5. Presiona **Buscar nuevos PDF en /data**.
6. Revisa el dashboard ambiental por sede.

## Factores ambientales editables

El dashboard incluye dos campos ajustables:

- **Factor CO₂ kg/kWh:** por defecto `0.126` kg CO₂e/kWh.
- **kg CO₂ capturados por árbol/año:** por defecto `22` kg CO₂e/árbol/año.

Estos valores son configurables desde la interfaz y se guardan en el navegador. Si la investigación define otro factor oficial, solo se cambia en el campo correspondiente y se presiona **Actualizar cálculos**.

## Recomendación para nombres de PDF

Aunque el sistema identifica el mes desde el contenido de la factura, se recomienda nombrar los archivos así:

```text
2025-01.pdf
2025-04.pdf
2025-05.pdf
```

Si un archivo se llama `Mayo2025.pdf`, pero internamente dice `Resumen de facturación Abril de 2025`, el sistema lo registra como `2025-04`, porque ese es el periodo oficial de la factura.

## Archivos principales

- `index.html`: estructura de la aplicación.
- `styles.css`: diseño responsive tipo dashboard.
- `app.js`: lectura PDF, cálculos, dashboard, filtros, comparación y exportación.
- `data/manifest.json`: listado de PDF disponibles en la carpeta `data/`.


## Actualización v9

- Se reorganizó la interfaz para ubicar en la parte superior los indicadores generales, el dashboard ambiental por sede y la sección de comparación mensual.
- La importación, diagnóstico y tabla detallada quedan debajo para priorizar la lectura ejecutiva de resultados.


## Actualización v10

- La gráfica **Ranking de sedes por consumo eléctrico total (kWh)** quedó ubicada inmediatamente debajo de los indicadores del **Dashboard ambiental por sede**.
- Las barras fueron ajustadas para no ocupar todo el ancho del panel, reservando espacio a la derecha para visualizar claramente: **kWh**, **t CO₂e** y **árboles requeridos**.
- En pantallas pequeñas, la gráfica permite desplazamiento horizontal para evitar cortes de texto.
