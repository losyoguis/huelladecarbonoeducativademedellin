SiMeCO₂ · Electricidad INEM
===========================

Esta subcarpeta es la fuente exclusiva para la facturación/medición eléctrica de la
I.E. INEM José Félix de Restrepo (Cr 48 Cl 1 -125), cuyo suministro corresponde a
un contrato de mercado no regulado separado del consolidado educativo.

Flujo de actualización:
1. Copiar aquí las nuevas facturas PDF del INEM.
2. Ejecutar desde la raíz del proyecto: python tools/integrar_inem.py
3. Ejecutar: npm run check && npm test
4. Publicar la carpeta data/inem junto con el resto del sistema.

El integrador toma la lectura más reciente disponible para cada mes, evita duplicar
la fila consolidada del mismo periodo y conserva trazabilidad al PDF de esta carpeta.

SiMeCO₂ v106:
- `registros.inem.js` se genera automáticamente al ejecutar `npm run integrate:inem`.
- Esta capa se carga después del bundle eléctrico general y antes de `app.js`.
- El Plan de Gestión Energética/PDF toma las lecturas y la factura eléctrica desde esta carpeta.
- Los meses sin lectura verificable se muestran como N.I.; no se asumen como 0 kWh.
