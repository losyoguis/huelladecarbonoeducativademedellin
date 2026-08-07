const fs=require('fs');
const src=fs.readFileSync('app.js','utf8');
function ok(v,msg){if(!v) throw new Error(msg);}
ok(src.includes('r.managementScore=(0.70*consistency)+(0.30*magnitude)'), 'Falta fórmula 70/30');
ok(src.includes('b.managementScore-a.managementScore'), 'El ranking general no ordena por índice');
ok(src.includes('🏆 ${fmt(r.managementScore,1)} pts'), 'No se visualiza el índice');
console.log('OK ranking-management-score');
