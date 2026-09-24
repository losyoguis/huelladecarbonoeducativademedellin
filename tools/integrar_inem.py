#!/usr/bin/env python3
"""Integra ``data/inem/*.pdf`` en los bundles de SiMeCO₂ sin reprocesar los PDF generales."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from inem_energy import enrich_records, parse_inem_pdf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def write_full_bundles(payload: dict) -> None:
    records = payload["records"]
    (DATA / "registros.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    js = (
        "window.SIMECO_PRELOADED_BUNDLE = " + compact + ";\n"
        "window.SIMECO_REGISTROS = window.SIMECO_PRELOADED_BUNDLE.records;\n"
    )
    (DATA / "registros.js").write_text(js, encoding="utf-8")
    (ROOT / "registros.js").write_text(js, encoding="utf-8")

    dict_columns = ["period", "site", "address", "source", "sourceUrl", "type"]
    dictionaries = {col: list(dict.fromkeys(row.get(col) for row in records)) for col in dict_columns}
    indexes = {col: {value: idx for idx, value in enumerate(values)} for col, values in dictionaries.items()}
    all_columns = list(dict.fromkeys(col for row in records for col in row.keys()))
    other_columns = [col for col in all_columns if col not in dict_columns]
    columns = dict_columns + other_columns
    rows = [[*(indexes[col][row.get(col)] for col in dict_columns), *(row.get(col) for col in other_columns)] for row in records]
    compact_payload = {
        "version": "v106-compact-inem",
        "dictColumns": dict_columns,
        "d": dictionaries,
        "c": columns,
        "r": rows,
    }
    (DATA / "registros.compact.json").write_text(json.dumps(compact_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    compact_js = json.dumps({"d": dictionaries, "c": columns, "r": rows}, ensure_ascii=False, separators=(",", ":"))
    decoder = (
        "/* SiMeCO2 v106 · registros compactos + electricidad INEM */\n"
        "(()=>{'use strict';const P=" + compact_js + ",D=P.d,C=P.c,N=" + str(len(dict_columns)) + ";"
        "const R=P.r.map(a=>{const o={};for(let i=0;i<C.length;i++){const k=C[i];o[k]=i<N?D[k][a[i]]:a[i];}return o;});"
        "window.SIMECO_PRELOADED_BUNDLE={version:'v106-compact-inem-20260924',generatedFrom:'facturas consolidadas + data/inem',records:R};"
        "window.SIMECO_REGISTROS=R;})();\n"
    )
    (DATA / "registros.compact.js").write_text(decoder, encoding="utf-8")


def write_electricity_bundle(records: list[dict]) -> None:
    projected = []
    for row in records:
        # El bundle eléctrico usa como evidencia primaria la fuente específica de energía.
        energy_source_url = str(row.get("energySourceUrl") or "")
        if row.get("energyKwh") is not None and energy_source_url.startswith("data/"):
            source = energy_source_url[len("data/"):]
            page = row.get("energySourcePage") or row.get("page") or 1
        else:
            source = row.get("source") or ""
            page = row.get("page") or 1
        projected.append({
            "period": row.get("period"),
            "site": row.get("site"),
            "address": row.get("address"),
            "source": source,
            "energyKwh": row.get("energyKwh"),
            "energyValue": row.get("energyValue"),
            "page": page,
            "co2kg": row.get("co2kg"),
            "pages": row.get("pages"),
        })

    dict_columns = ["period", "site", "address", "source"]
    dictionaries = {col: list(dict.fromkeys(row.get(col) for row in projected)) for col in dict_columns}
    indexes = {col: {value: idx for idx, value in enumerate(values)} for col, values in dictionaries.items()}
    columns = dict_columns + ["energyKwh", "energyValue", "page", "co2kg", "pages"]
    rows = [
        [*(indexes[col][row.get(col)] for col in dict_columns), row.get("energyKwh"), row.get("energyValue"), row.get("page"), row.get("co2kg"), row.get("pages")]
        for row in projected
    ]
    packed = json.dumps({"d": dictionaries, "c": columns, "r": rows}, ensure_ascii=False, separators=(",", ":"))
    decoder = (
        "/* SiMeCO2 v106 · bundle ultracompacto de electricidad + INEM. */\n"
        "(()=>{'use strict';const P=" + packed + ",D=P.d,C=P.c,N=4;"
        "const R=P.r.map((a,idx)=>{const o={};for(let i=0;i<C.length;i++){const k=C[i];o[k]=i<N?D[k][a[i]]:a[i];}"
        "o.type='sede';o.sourceUrl='data/'+o.source;o.key=`${o.period}|${o.site}|${o.address}|${idx}|${o.source}`;return o;});"
        "window.SIMECO_PRELOADED_BUNDLE={version:'v106-electricidad-inem-20260924',generatedFrom:'17 facturas consolidadas + data/inem',records:R};"
        "window.SIMECO_REGISTROS=R;window.SIMECO_DATA_READY=true;})();\n"
    )
    (DATA / "registros.electricidad.min.js").write_text(decoder, encoding="utf-8")
    (DATA / "registros.electricidad.js").write_text(decoder, encoding="utf-8")




def write_inem_overlay(records: list[dict]) -> None:
    """Genera una capa eléctrica pequeña del INEM para evitar datos obsoletos en caché.

    La capa se carga después del bundle eléctrico general y antes de app.js. Si el
    navegador conserva una copia antigua del bundle principal, estas lecturas se
    superponen por periodo/sede/dirección. También permite agregar meses nuevos.
    """
    rows = []
    for row in records:
        if str(row.get("energySourceType") or "") != "inem_external_contract":
            continue
        if row.get("energyKwh") is None:
            continue
        rows.append({
            "period": row.get("period"),
            "site": row.get("site"),
            "address": row.get("address"),
            "energyKwh": row.get("energyKwh"),
            "energyValue": row.get("energyValue"),
            "co2kg": row.get("co2kg"),
            "source": str(row.get("energySourceUrl") or row.get("sourceUrl") or "").removeprefix("data/"),
            "sourceUrl": row.get("energySourceUrl") or row.get("sourceUrl"),
            "page": row.get("energySourcePage") or row.get("page") or 1,
            "energySource": row.get("energySource"),
            "energySourceUrl": row.get("energySourceUrl"),
            "energySourcePage": row.get("energySourcePage"),
            "energySourceType": row.get("energySourceType"),
            "energyInvoicePeriod": row.get("energyInvoicePeriod"),
            "energyContract": row.get("energyContract"),
            "energyServiceId": row.get("energyServiceId"),
            "energyMarket": row.get("energyMarket"),
            "energyCategory": row.get("energyCategory"),
            "energyVoltageLevel": row.get("energyVoltageLevel"),
            "type": "sede",
        })
    rows.sort(key=lambda r: str(r.get("period") or ""))
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    js = f"""/* SiMeCO2 v106 · capa eléctrica INEM para sincronización de PDF e interfaz. */
(()=>{{'use strict';
const incoming={payload};
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const base=Array.isArray(window.SIMECO_REGISTROS)?window.SIMECO_REGISTROS:[];
for(const row of incoming){{
  const idx=base.findIndex(x=>String(x.period||'')===String(row.period||'')&&norm(x.site)===norm(row.site)&&norm(x.address)===norm(row.address));
  if(idx>=0) Object.assign(base[idx],row,{{key:base[idx].key||`${{row.period}}|${{row.site}}|${{row.address}}|inem-overlay|${{row.source||''}}`}});
  else base.push(Object.assign({{}},row,{{key:`${{row.period}}|${{row.site}}|${{row.address}}|inem-overlay|${{row.source||''}}`}}));
}}
window.SIMECO_REGISTROS=base;
window.SIMECO_INEM_ELECTRICITY={{version:'v106-inem-overlay-20260924',records:incoming}};
}})();
"""
    target = DATA / "inem" / "registros.inem.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(js, encoding="utf-8")

def format_co(value: float, decimals: int = 2) -> str:
    raw = f"{value:,.{decimals}f}"
    return raw.replace(",", "§").replace(".", ",").replace("§", ".")


def update_inem_exception(stats: dict) -> None:
    """Sincroniza el estado visible del contrato INEM con los PDF de data/inem."""
    source_path = DATA / "excepciones-servicios.json"
    if source_path.exists():
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    else:
        payload = {"exceptions": []}

    exceptions = payload.setdefault("exceptions", [])
    item = next((x for x in exceptions if "inem" in str(x.get("displayName") or x.get("site") or "").lower()), None)
    if item is None:
        item = {
            "key": "inem j f de rpo|cr 48 cl 1 125",
            "site": "Inem J F De Rpo",
            "displayName": "I.E. INEM José Félix de Restrepo",
            "address": "Cr 48 Cl 1 -125",
            "service": "energyKwh",
            "confidence": "Alta",
            "zeroMeaning": False,
        }
        exceptions.append(item)

    periods = stats.get("periodList") or []
    total = float(stats.get("totalKwh") or 0)
    if periods:
        item.update({
            "status": "external_contract_integrated",
            "label": "Contrato separado integrado",
            "shortLabel": "INEM integrado",
            "summary": "La energía eléctrica del INEM se gestiona mediante un contrato de mercado no regulado separado del consolidado educativo. SiMeCO₂ integra automáticamente la serie verificable disponible desde la subcarpeta data/inem.",
            "dataState": f"{len(periods)} periodo(s) integrados ({periods[0]} a {periods[-1]}): {format_co(total)} kWh. La serie se actualiza al incorporar nuevas facturas en data/inem y ejecutar el integrador.",
            "recommendedAction": "Continuar incorporando en data/inem las nuevas facturas eléctricas del INEM y ejecutar npm run integrate:inem para ampliar la serie sin perder trazabilidad.",
        })
    else:
        item.update({
            "status": "external_contract",
            "label": "Contrato separado pendiente",
            "shortLabel": "INEM pendiente",
            "summary": "La energía eléctrica del INEM corresponde a un contrato de mercado no regulado separado del consolidado educativo.",
            "dataState": "No hay una factura eléctrica verificable disponible actualmente en data/inem. Este estado no representa consumo cero.",
            "recommendedAction": "Agregar la facturación eléctrica del INEM en data/inem y ejecutar npm run integrate:inem.",
        })

    # Cada PDF local queda enlazado como evidencia; conservamos las evidencias externas ya existentes.
    local_evidence = []
    for pdf in sorted((DATA / "inem").glob("*.pdf")):
        readings = parse_inem_pdf(pdf, DATA)
        invoice_period = readings[0].invoice_period if readings else None
        title_period = invoice_period or "facturación disponible"
        local_evidence.append({
            "type": "local_invoice",
            "title": f"Factura eléctrica INEM · {title_period}",
            "url": f"data/inem/{pdf.name}",
            "detail": f"Fuente eléctrica integrada desde data/inem. Archivo: {pdf.name}.",
        })
    external_evidence = [e for e in item.get("evidence", []) if e.get("type") != "local_invoice"]
    item["evidence"] = local_evidence + external_evidence

    payload["version"] = "v106-service-exceptions-inem-integrated"
    payload["generatedAt"] = date.today().isoformat()
    payload["description"] = "Excepciones y fuentes eléctricas separadas verificadas. El INEM se sincroniza desde data/inem."

    pretty = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    for target in (DATA / "excepciones-servicios.json", ROOT / "excepciones-servicios.json"):
        target.write_text(pretty, encoding="utf-8")
    js = "window.SIMECO_SERVICE_EXCEPTIONS = " + compact + ";\n"
    for target in (DATA / "excepciones-servicios.js", ROOT / "excepciones-servicios.js"):
        target.write_text(js, encoding="utf-8")

def main() -> None:
    payload = json.loads((DATA / "registros.json").read_text(encoding="utf-8"))
    records, stats = enrich_records(payload.get("records", []), DATA)
    payload["version"] = "v106-detail-inem-20260924"
    payload["generatedFrom"] = "17 facturas consolidadas verificadas + electricidad INEM desde data/inem"
    payload["records"] = records
    write_full_bundles(payload)
    write_electricity_bundle(records)
    write_inem_overlay(records)
    update_inem_exception(stats)
    print(json.dumps({"ok": True, **stats}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
