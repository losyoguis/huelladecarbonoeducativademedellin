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

valid=[r for r in records if r.get('waterM3') is not None and isinstance(r.get('waterM3'),(int,float)) and math.isfinite(r['waterM3'])]
detail_total=sum(r['waterM3'] for r in valid)
official=[s for s in summaries if s.get('waterM3') is not None]
official_total=sum(float(s['waterM3']) for s in official)

by_period={}
for r in valid:
    by_period[r['period']]=by_period.get(r['period'],0)+r['waterM3']

print('CONTROL DE CALIDAD DE AGUA — SiMeCO₂ v101')
print('Fecha: 2026-08-08\n')
print(f'Registros base: {len(records):,}')
print(f'Registros con lectura de agua: {len(valid):,}')
print(f'Lecturas válidas de 0 m³: {sum(1 for r in valid if r["waterM3"]==0):,}')
print(f'Periodos oficiales: {len(official)}')
print(f'Consumo oficial acumulado: {official_total:,.2f} m³')
print(f'Consumo detallado vinculado: {detail_total:,.3f} m³')
print(f'Diferencia acumulada: {official_total-detail_total:,.3f} m³ ({100*(official_total-detail_total)/official_total:.3f}%)\n')
print('CONCILIACIÓN POR PERIODO')
print('Periodo | Detalle m³ | Oficial m³ | Diferencia %')
max_abs=0
for s in sorted(official,key=lambda x:x['period']):
    o=float(s['waterM3']); det=by_period.get(s['period'],0)
    pct=((det-o)/o*100) if o else 0
    max_abs=max(max_abs,abs(pct))
    print(f"{s['period']} | {det:,.2f} | {o:,.2f} | {pct:+.3f}%")

print(f'\nDiferencia máxima absoluta: {max_abs:.4f}% (umbral 5.0%)')

pdf_ok=True
for s in official:
    p=ROOT/(s.get('sourceUrl') or f"data/{s['source']}")
    if not p.exists() or p.stat().st_size<100000 or p.read_bytes()[:4]!=b'%PDF':
        pdf_ok=False
        print('PDF NO VÁLIDO:',p)

errors=[]
if len(records)!=9147: errors.append('La base debe contener 9.147 registros.')
if len(valid)!=7317: errors.append('Se esperaban 7.317 registros con lectura de agua.')
if len(official)!=17: errors.append('Se esperaban 17 periodos oficiales.')
if abs(official_total-1351583.22)>0.01: errors.append('El consumo oficial acumulado no coincide.')
if max_abs>5.0: errors.append('La conciliación detalle/oficial supera 5%.')
if not pdf_ok: errors.append('Hay PDF de fuente inválidos o faltantes.')
if not (ROOT/'water.js').exists(): errors.append('Falta water.js.')
if not (ROOT/'data/registros.agua.min.js').exists(): errors.append('Falta bundle de agua.')

print('\nRESULTADO')
if errors:
    for e in errors: print('ERROR -',e)
    print('NO APROBADO')
    sys.exit(1)
print('APROBADO')
