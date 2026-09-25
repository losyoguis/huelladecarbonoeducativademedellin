const fs=require('fs');
const code=fs.readFileSync('Code.gs','utf8');
for (const needle of [
  "const OFFICIAL_SENDER_EMAIL = 'lideres.ambientales@iemanueljbetancur.edu.co'",
  'function assertOfficialSender_()',
  'function verificarCuentaRemitenteSiMeCO2()',
  'function autorizarYProbarCorreoSiMeCO2()',
  'var effectiveSender = assertOfficialSender_();'
]) { if (!code.includes(needle)) throw new Error('Falta: '+needle); }
console.log('✓ v112 remitente institucional verificado');
