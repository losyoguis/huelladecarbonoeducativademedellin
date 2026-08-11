#!/usr/bin/env python3
from pathlib import Path
import json, math, sys

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/registros.compact.json').read_text(encoding='utf-8'))
summaries=json.loads((ROOT/'data/resumenes.json').read_text(encoding='utf-8')).get('summaries',[])

cols=data['c']; d=data['d']; dict_cols=data.get('dictColumns',[])
records=[]
for row in data['r']:
    rec={}
    for i,k in enumerate(cols):
        rec[k]=d[k][row[i]] if i<len(dict_cols) else row[i]
    records.append(rec)

valid=[r for r in records if r.get('gasM3') is not None and isinstance(r.get('gasM3'),(int,float)) and math.isfinite(r['gasM3'])]
detail_total=sum(r['gasM3'] for r in valid)
official=[s for s in summaries if s.get('gasM3') is not None]
official_total=sum(float(s['gasM3']) for s in official)

by_period={}
for r in valid:
    by_period[r['period']]=by_period.get(r['period'],0)+r['gasM3']

sites={}
for r in records:
    key=(r.get('site') or '',r.get('address') or '')
    item=sites.setdefault(key,{'periods':set(),'gas_periods':set(),'gas':0})
    if r.get('period'): item['periods'].add(r['period'])
    if r.get('gasM3') is not None and isinstance(r.get('gasM3'),(int,float)) and math.isfinite(r['gasM3']):
        item['gas_periods'].add(r['period'])
        item['gas']+=r['gasM3']
gas_sites=[x for x in sites.values() if x['gas_periods']]
positive_sites=[x for x in gas_sites if x['gas']>0]

print('CONTROL DE CALIDAD DE GAS — SiMeCO₂ v104')
print('Fecha: 2026-08-08\n')
print(f'Registros base: {len(records):,}')
print(f'Registros con lectura de gas: {len(valid):,}')
print(f'Lecturas válidas de 0 m³: {sum(1 for r in valid if r["gasM3"]==0):,}')
print(f'Sedes/cuentas con lectura de gas: {len(gas_sites)}')
print(f'Sedes/cuentas con consumo positivo acumulado: {len(positive_sites)}')
print(f'Periodos oficiales: {len(official)}')
print(f'Consumo oficial acumulado: {official_total:,.3f} m³')
print(f'Consumo detallado vinculado: {detail_total:,.3f} m³')
print(f'Diferencia acumulada: {detail_total-official_total:+,.3f} m³ ({100*(detail_total-official_total)/official_total:+.3f}%)\n')
print('CONCILIACIÓN POR PERIODO')
print('Periodo | Detalle m³ | Oficial m³ | Diferencia %')
max_abs=0
for s in sorted(official,key=lambda x:x['period']):
    o=float(s['gasM3']); det=by_period.get(s['period'],0)
    pct=((det-o)/o*100) if o else 0
    max_abs=max(max_abs,abs(pct))
    print(f"{s['period']} | {det:,.3f} | {o:,.3f} | {pct:+.3f}%")

print(f'\nDiferencia máxima absoluta: {max_abs:.4f}% (umbral 3.0%)')

pdf_ok=True
for s in official:
    p=ROOT/(s.get('sourceUrl') or f"data/{s['source']}")
    if not p.exists() or p.stat().st_size<100000 or p.read_bytes()[:4]!=b'%PDF':
        pdf_ok=False
        print('PDF NO VÁLIDO:',p)

errors=[]
if len(records)!=9147: errors.append('La base debe contener 9.147 registros.')
if len(valid)!=381: errors.append('Se esperaban 381 registros con lectura de gas.')
if sum(1 for r in valid if r['gasM3']==0)!=304: errors.append('Se esperaban 304 lecturas válidas de 0 m³.')
if len(gas_sites)!=28: errors.append('Se esperaban 28 sedes/cuentas con lectura de gas.')
if len(official)!=17: errors.append('Se esperaban 17 periodos oficiales.')
if abs(official_total-1094.52)>0.001: errors.append('El consumo oficial acumulado no coincide.')
if abs(detail_total-1095.658)>0.001: errors.append('El consumo detallado acumulado no coincide.')
if max_abs>3.0: errors.append('La conciliación detalle/oficial supera 3%.')
if not pdf_ok: errors.append('Hay PDF de fuente inválidos o faltantes.')
for f in ['gas.js','data/registros.gas.min.js','data/resumenes.gas.min.js']:
    if not (ROOT/f).exists(): errors.append(f'Falta {f}.')

print('\nRESULTADO')
if errors:
    for e in errors: print('ERROR -',e)
    print('NO APROBADO')
    sys.exit(1)
print('APROBADO')
