# API SiMeCO₂ v61

La versión 61 agrega una API de consulta determinística y un Asistente Ambiental con OpenAI. Los valores numéricos salen de `data/registros.json`, la sincronización territorial y las excepciones verificadas. La IA interpreta esos resultados, pero no reemplaza la base de datos.

## Endpoints

- `GET /api/health` — estado del servicio y de la configuración IA.
- `GET /api/institutions?q=texto&limit=8` — búsqueda por nombre, alias, dirección, código o núcleo.
- `GET /api/institution?q=texto&period=YYYY-MM&year=YYYY` — ficha/informe estructurado. `period` y `year` son opcionales.
- `GET /api/history?q=texto&metric=energyKwh&year=YYYY` — histórico mensual.
- `GET /api/ranking?metric=energyKwh&period=YYYY-MM&limit=10` — ranking sin convertir datos ausentes en cero.
- `GET /api/quality?q=texto` — calidad de una institución; sin `q`, panorama general.
- `GET /api/compare?q=Institución%201|Institución%202&metric=waterM3&period=YYYY-MM` — comparación.
- `POST /api/chat` — Asistente Ambiental IA.

Indicadores válidos: `energyKwh`, `waterM3`, `alcM3`, `gasM3`, `wasteTon`.

## POST /api/chat

Ejemplo de cuerpo:

```json
{
  "message": "Dame un informe de Fe y Alegría Santo Domingo Savio",
  "history": [],
  "sessionId": "identificador-aleatorio-del-navegador"
}
```

La clave de OpenAI se lee únicamente desde `OPENAI_API_KEY` en el servidor. **Nunca** debe copiarse en `index.html`, `app.js`, `assistant.js` o `assistant-config.js`.

## Variables de entorno

Copia `.env.example` solo como referencia y configura las variables en el proveedor del backend:

- `OPENAI_API_KEY`: obligatoria para respuestas IA.
- `OPENAI_MODEL`: por defecto `gpt-5.6-terra`.
- `SIMECO_ALLOWED_ORIGINS`: lista separada por comas. Si el frontend está en GitHub Pages, incluye su origen exacto.
- `SIMECO_MAX_REQUESTS_PER_MINUTE`: por defecto 12.

## Fuente de verdad

La capa IA tiene instrucciones explícitas para mantener estas diferencias:

- `0` = valor realmente registrado como cero.
- `null` = no existe un valor verificable.
- `energia_no_identificada` = el consolidado no permite asociar energía a la institución.
- `energia_contrato_separado` = existe evidencia de una fuente/contrato distinto y el consumo aún no está integrado.

En cualquiera de los tres últimos casos el asistente no debe fabricar kWh, CO₂e ni una posición de ranking.
