const fs=require('fs');
function ok(v,m){if(!v)throw new Error(m);}
const html=fs.readFileSync('index.html','utf8');
const readme=fs.readFileSync('README.md','utf8');

ok(html.includes('SrQj2rXw1ow?start=0'),'Embed no empieza en 0');
ok(html.includes('El video empieza desde el segundo 0.'),'La interfaz no informa inicio en 0');
ok(!/start=\x31\x38/.test(html),'index.html todavía contiene un inicio antiguo');
ok(!new RegExp('segundo\\s+'+(9*2)).test(html),'index.html todavía menciona un segundo de inicio antiguo');
ok(readme.includes('empieza desde el segundo 0'),'README no fue actualizado');

console.log(JSON.stringify({ok:true,youtubeId:'SrQj2rXw1ow',startSecond:0}));
