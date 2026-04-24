# SiMeCO₂ · Servicios públicos educativos v7

## Qué hace
- Busca automáticamente nuevos PDF dentro de la carpeta `data/` del repositorio.
- Identifica mes y año desde textos como `Resumen de facturación Enero de 2025`.
- Extrae registros por sede cuando el PDF contiene bloques `Prestación del servicio`.
- Calcula energía, agua, alcantarillado, gas, aseo/residuos y CO₂ estimado.
- Permite comparar periodos.
- Guarda el histórico en el navegador mediante `localStorage`.

## Instalación en GitHub Pages
1. Sube todos los archivos de este ZIP al repositorio.
2. Crea o conserva la carpeta `data/`.
3. Cada mes, sube manualmente la factura PDF dentro de `data/`, por ejemplo:
   - `data/Enero-2025.pdf`
   - `data/Febrero-2025.pdf`
4. Publica el repositorio con GitHub Pages.
5. Abre la web y presiona **Buscar nuevos PDF en /data**.

## Configuración
Si la web está publicada como `https://usuario.github.io/repositorio/`, el sistema detecta automáticamente:
- owner = usuario
- repo = repositorio

Si usas dominio personalizado o una ruta diferente, escribe manualmente:
- Owner GitHub
- Repositorio
- Rama (`main` o `master`)

## Importante
GitHub Pages no permite que JavaScript escriba archivos nuevos en el repositorio sin API/token. Esta versión no necesita token porque solo **lee** los PDF que tú subes manualmente a `data/`.

## Pruebas locales
Si abres `index.html` directamente desde el computador, el navegador puede bloquear la lectura de `data/`. Para pruebas locales puedes:
- usar el botón **Cargar PDF local**, o
- ejecutar un servidor local sencillo.

## Factor CO₂
El factor usado está en `app.js`:
`const FACTOR_CO2_KG_KWH = 0.126;`
Puedes reemplazarlo por el factor oficial que defina el proyecto.
