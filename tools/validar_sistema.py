#!/usr/bin/env python3
"""Control de calidad integral de SiMeCO₂ v67: datos, rendimiento, API y frontend."""
from __future__ import annotations
import json, re, subprocess, sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT=Path(__file__).resolve().parents[1]
CORE=['index.html','dashboard.html','aula-climatica.html']

class P(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.refs=[]; self.scripts=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        for a in ('src','href'):
            if d.get(a): self.refs.append(d[a])
        if tag=='script' and d.get('src'): self.scripts.append(d['src'])

def run(cmd):
    p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True)
    return p.returncode==0,(p.stdout+p.stderr).strip()

def main():
    errors=[]; checks=[]
    for p in ROOT.rglob('*.json'):
        try: json.loads(p.read_text(encoding='utf8'))
        except Exception as e: errors.append(f'JSON inválido {p.relative_to(ROOT)}: {e}')
    checks.append('JSON válidos')

    for p in ROOT.rglob('*.js'):
        ok,out=run(['node','--check',str(p)])
        if not ok: errors.append(f'JS inválido {p.relative_to(ROOT)}: {out}')
    checks.append('JavaScript válido')

    for p in (ROOT/'tools').glob('*.py'):
        ok,out=run([sys.executable,'-m','py_compile',str(p)])
        if not ok: errors.append(f'Python inválido {p.relative_to(ROOT)}: {out}')
    checks.append('Herramientas Python válidas')

    for page in ROOT.glob('*.html'):
        parser=P(); parser.feed(page.read_text(encoding='utf8'))
        dup={x for x in parser.ids if parser.ids.count(x)>1}
        if dup: errors.append(f'IDs duplicados en {page.name}: {sorted(dup)}')
        for ref in parser.refs:
            if not ref or ref.startswith(('#','http:','https:','//','mailto:','tel:','javascript:','data:','blob:')): continue
            local=unquote(urlsplit(ref).path)
            if local and not (page.parent/local).exists(): errors.append(f'Referencia rota {page.name}: {ref}')
        if page.name in CORE:
            scripts=[urlsplit(x).path for x in parser.scripts]
            if 'data/registros.compact.js' not in scripts: errors.append(f'{page.name} no usa registros.compact.js')
            if 'data/registros.js' in scripts: errors.append(f'{page.name} todavía carga registros.js pesado')
            if any('pdf.min.js' in x for x in scripts): errors.append(f'{page.name} carga PDF.js al inicio')
    checks.append('HTML sin referencias rotas y carga compacta verificada')

    search=(ROOT/'busqueda-institucional.html').read_text(encoding='utf8')
    if 'pdf-lib.min.js' in search: errors.append('Búsqueda institucional todavía carga PDF-Lib al inicio')
    if 'ensurePdfLib' not in (ROOT/'institucional.js').read_text(encoding='utf8'): errors.append('Falta carga bajo demanda de PDF-Lib')
    app=(ROOT/'app.js').read_text(encoding='utf8')
    for marker in ["simeco2_servicios_v16","v67-ranking-direccion-20260807","function ensurePdfJs","RECORD_TABLE_PAGE_SIZE = 200","function renderRecordPagination","function renderSavingsRanking","function monthBefore","function rankingAddressText","function drawRankingIdentity","La verificación de PDF queda bajo demanda"]:
        if marker not in app: errors.append(f'Falta marcador v66 en app.js: {marker}')
    checks.append('PDF.js/PDF-Lib bajo demanda y tabla paginada')

    # Bundle compacto: igualdad exacta y reducción.
    probe=r"""
const fs=require('fs'),vm=require('vm'); const c={window:{}};vm.createContext(c);
vm.runInContext(fs.readFileSync('data/registros.compact.js','utf8'),c);
const compact=c.window.SIMECO_REGISTROS||[];
const raw=JSON.parse(fs.readFileSync('data/registros.json','utf8')).records;
let equal=compact.length===raw.length;
for(let i=0;equal&&i<raw.length;i++){
  const keys=new Set([...Object.keys(raw[i]),...Object.keys(compact[i])]);
  for(const k of keys){const a=compact[i][k]??null,b=raw[i][k]??null;if(JSON.stringify(a)!==JSON.stringify(b)){equal=false;break;}}
}
console.log(JSON.stringify({n:compact.length,equal}));
"""
    ok,out=run(['node','-e',probe])
    if not ok: errors.append('No se pudo validar registros.compact.js: '+out)
    else:
        x=json.loads(out.splitlines()[-1]);
        if x['n']!=9147 or not x['equal']: errors.append(f'Bundle compacto no coincide: {x}')
    old=(ROOT/'data/registros.js').stat().st_size; new=(ROOT/'data/registros.compact.js').stat().st_size
    reduction=(1-new/old)*100
    if reduction<50: errors.append(f'Reducción insuficiente del bundle: {reduction:.1f}%')
    logo_old=(ROOT/'assets/los-yoguis-logo.png').stat().st_size; logo_new=(ROOT/'assets/los-yoguis-logo-optimized.png').stat().st_size
    if logo_new>=logo_old: errors.append('Logo optimizado no reduce peso')
    checks.append(f'Bundle navegador: {old:,} → {new:,} bytes ({reduction:.1f}% menos); logo: {logo_old:,} → {logo_new:,} bytes')

    ok,out=run(['npm','run','check'])
    if not ok: errors.append('npm run check falló: '+out)
    ok2,out2=run(['npm','test'])
    if not ok2: errors.append('npm test falló: '+out2)
    checks.append('Pruebas API, grounding, schemas y consultas data-first aprobadas')

    # Casos críticos.
    data_test=out2 if ok2 else ''
    for marker in ['"records": 9147','"feEnergy": 73924','"inemStatus": "energia_contrato_separado"','"mode": "data-first"']:
        if marker not in data_test: errors.append(f'No se confirmó prueba crítica: {marker}')

    print('CONTROL DE CALIDAD SiMeCO2 v67')
    for c in checks: print('OK -',c)
    if errors:
        for e in errors: print('ERROR -',e)
        print(f'RESULTADO: NO APROBADO ({len(errors)} errores)')
        return 1
    print('RESULTADO: APROBADO')
    return 0

if __name__=='__main__': raise SystemExit(main())
