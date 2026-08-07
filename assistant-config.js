/* SiMeCO2 v61 · Configuración pública del cliente. NO coloques aquí OPENAI_API_KEY. */
window.SIMECO_ASSISTANT_CONFIG = Object.assign({
  // Si frontend y API se publican juntos en Vercel, deja apiUrl vacío: usará /api/chat.
  // Si el frontend sigue en GitHub Pages, coloca aquí la URL pública del backend Vercel, por ejemplo:
  // apiUrl: 'https://simeco2-api.vercel.app/api/chat',
  apiUrl: '',
  preferAI: true,
  timeoutMs: 30000
}, window.SIMECO_ASSISTANT_CONFIG || {});
