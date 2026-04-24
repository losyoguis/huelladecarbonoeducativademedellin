# SiMeCO₂ · Plataforma de Huella de Carbono Educativa v26

Sistema web en HTML, CSS y JavaScript para medir, visualizar e interpretar la huella de carbono educativa a partir del consumo de servicios públicos de sedes educativas.

## Propósito

SiMeCO₂ transforma información de facturas en indicadores ambientales comprensibles para directivos, docentes, estudiantes y aliados técnicos. La plataforma permite estimar emisiones de CO₂e en alcance 2, priorizar sedes con mayor consumo eléctrico y generar planes de gestión ambiental escolar.

## Mejoras incorporadas en v26

- Portada institucional con enfoque de proyecto educativo ambiental.
- Resumen ejecutivo automático con lectura interpretativa.
- Indicadores de impacto del proyecto.
- Alertas inteligentes sobre sedes prioritarias, aumentos o reducciones de consumo.
- Comparación de periodos con interpretación automática.
- Ranking de sedes con clasificación de prioridad: alta, media y preventiva.
- Dashboard por sede con chips de prioridad.
- Plan de Gestión fortalecido con matriz operativa, responsables, indicadores y evidencias.
- Módulo pedagógico “Aula climática / Guardianes Climáticos”.
- Modo presentación para socializar resultados ante directivos, estudiantes o aliados.
- Mejoras responsive tipo app móvil: navegación inferior y tablas convertidas en tarjetas.
- Textos institucionales más claros y orientados a toma de decisiones.

## Archivos principales

```text
index.html        Estructura de la plataforma
styles.css        Diseño visual, responsive, modo presentación y experiencia móvil
app.js            Lógica de lectura, cálculos, visualizaciones, planes e interpretaciones
data/             Carpeta con archivos de soporte y PDF existentes
```

## Uso básico

1. Publicar el proyecto en GitHub Pages o abrirlo en un servidor local.
2. Entrar a la web.
3. Presionar **Actualizar información del sistema** o usar **Cargar PDF local** para pruebas.
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



## Actualización v27 · Footer institucional Los Yoguis

Esta versión incorpora un pie de página institucional con la imagen oficial de Los Yoguis y el enlace central a `www.losyoguis.com`.

Archivos actualizados:

- `index.html`
- `styles.css`
- `assets/los-yoguis-footer.png`
