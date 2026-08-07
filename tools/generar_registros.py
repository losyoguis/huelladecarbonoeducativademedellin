#!/usr/bin/env python3
"""Regenera el detalle por sede de las facturas PDF de SiMeCO₂.

El parser distingue la notación colombiana por tipo de magnitud:
- energía: el punto suele separar miles (2.684 kWh -> 2684);
- agua/gas: la coma representa decimales (398,500 m³ -> 398.5);
- residuos: admite cuatro o cinco decimales en toneladas.
"""
from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FACTOR_CO2 = 0.126
MONTHS = {
    "enero":"01", "febrero":"02", "marzo":"03", "abril":"04", "mayo":"05", "junio":"06",
    "julio":"07", "agosto":"08", "septiembre":"09", "octubre":"10", "noviembre":"11", "diciembre":"12",
}


def strip_accents(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value or "") if unicodedata.category(c) != "Mn")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip(" -\t\r\n")


def number(value: str | None, kind: str = "generic") -> float | None:
    if value is None:
        return None
    s = re.sub(r"[^0-9,.-]", "", value.strip())
    if not s:
        return None
    negative = s.startswith("-")
    s = s.replace("-", "")
    if kind in {"water", "gas", "m3", "ton"}:
        # La coma es decimal. En agua/alcantarillado, un punto aislado separa
        # miles (1.245 m³); en gas y residuos el punto puede ser decimal.
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        elif kind == "water" and "." in s:
            parts = s.split(".")
            s = "".join(parts) if all(len(p) == 3 for p in parts[1:]) else s
        elif s.count(".") > 1:
            parts = s.split(".")
            s = "".join(parts[:-1]) + "." + parts[-1]
    elif kind == "energy":
        # La energía se imprime sin decimales relevantes y con separador de miles.
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            # En el detalle EPM la coma representa decimales incluso con tres cifras
            # (356,441 kWh = 356.441 kWh). El punto sí se usa como separador de miles.
            s = s.replace(",", ".")
        elif "." in s:
            parts = s.split(".")
            if all(len(p) == 3 for p in parts[1:]):
                s = "".join(parts)
    else:
        if "," in s and "." in s:
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif "," in s:
            parts = s.split(",")
            s = "".join(parts) if len(parts) > 2 else ".".join(parts)
        elif s.count(".") > 1:
            s = s.replace(".", "")
    try:
        out = float(("-" if negative else "") + s)
    except ValueError:
        return None
    if abs(out) < 1e-12:
        return 0.0
    return round(out, 5)


def currency(value: str | None) -> float | None:
    if value is None:
        return None
    s = re.sub(r"[^0-9,.-]", "", value)
    if not s:
        return None
    # Formato monetario colombiano: 1.234.567,89
    return number(s, "generic")


def period_from_text(text: str, fallback_name: str) -> str:
    m = re.search(r"Resumen de facturaci[oó]n\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+de\s+(20\d{2})", text, re.I)
    if m:
        month = strip_accents(m.group(1)).lower()
        if month in MONTHS:
            return f"{m.group(2)}-{MONTHS[month]}"
    name = strip_accents(fallback_name).lower()
    year = re.search(r"20\d{2}", name)
    for month, code in MONTHS.items():
        if month in name and year:
            return f"{year.group(0)}-{code}"
    raise RuntimeError(f"No se pudo determinar el periodo de {fallback_name}")


def total_value(section: str, label_pattern: str) -> float | None:
    m = re.search(rf"Total\s+{label_pattern}\s*\$?\s*([\d.,-]+)", section, re.I)
    return currency(m.group(1)) if m else None


def metric_segment(section: str, target_pattern: str, previous_patterns: tuple[str, ...]) -> str | None:
    """Obtiene el tramo que termina en el total del servicio solicitado.

    La maquetación del PDF coloca a veces el rótulo visual (Agua/Energía) después
    de la línea de consumo. Por eso el límite fiable son los textos «Total …».
    """
    target = re.search(rf"Total\s+{target_pattern}\b", section, re.I)
    if not target:
        return None
    start = 0
    for previous in previous_patterns:
        for match in re.finditer(rf"Total\s+{previous}\b", section[:target.start()], re.I):
            start = max(start, match.end())
    return section[start:target.start()]


def billed_metric(section: str, target_pattern: str, previous_patterns: tuple[str, ...], kind: str) -> float | None:
    segment = metric_segment(section, target_pattern, previous_patterns)
    if not segment:
        return None
    if kind == "energy":
        patterns = [
            r"Energ[ií]a(?:\s+activa)?\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x",
            r"Consumo\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x",
            r"([\d.,]+)\s*kWh\s+.*?=\s*Consumo",
        ]
    else:
        patterns = [
            r"Consumo\s+[A-Za-z]{3,4}-\d{2}\s+([\d.,]+)\s*x",
            r"([\d.,]+)\s*(?:m3|mt\s*3)\s+.*?=\s*Consumo",
        ]
    for pattern in patterns:
        matches = list(re.finditer(pattern, segment, re.I | re.S))
        if matches:
            return number(matches[-1].group(1), kind)
    return None


def billed_total(section: str, target_pattern: str) -> float | None:
    return total_value(section, target_pattern)

def waste_tons(section: str) -> float | None:
    if not re.search(r"Total\s+Aseo", section, re.I):
        return None
    values = []
    for label in [r"No\s+Aprov(?:echables)?-?Ordinarios", r"Barrido\s+y\s+limpieza", r"Limpieza\s+urbana", r"Rechazados"]:
        m = re.search(rf"{label}\s+([\d.,]+)", section, re.I)
        if m:
            val = number(m.group(1), "ton")
            if val is not None:
                values.append(val)
    if values:
        return round(sum(values), 5)
    # En algunas versiones aparece directamente el total del mes.
    m = re.search(r"Cantidad\s+de\s+Residuos\s*\(Ton\).*?(?:[A-Za-z]{3}-\d{2})\s+([\d.,]+)\s+([\d.,]+)", section, re.I | re.S)
    if m:
        a = number(m.group(1), "ton") or 0
        b = number(m.group(2), "ton") or 0
        return round(a + b, 5)
    return None


HEADER = re.compile(
    r"Prestaci[oó]n\s+del\s+servicio:\s*(.*?)\s+-\s+"
    r"((?:Cl|Cll|Calle|Cr|Cra|Carrera|Kr|Dg|Diagonal|Tv|Transversal|Circular|Vda|Vereda|Km)\b.*?)"
    r"\s+-\s+Municipio:\s*.*?(?:Medell[ií]n|$)",
    re.I | re.S,
)
HEADER_FALLBACK = re.compile(r"Prestaci[oó]n\s+del\s+servicio:\s*(.*?)\s+-\s+Municipio:", re.I | re.S)


def parse_header(section: str) -> tuple[str, str] | None:
    m = HEADER.search(section[:1800])
    if m:
        return clean(m.group(1)), clean(m.group(2))
    m = HEADER_FALLBACK.search(section[:1800])
    if not m:
        return None
    before = clean(m.group(1))
    # Busca el último separador antes de una dirección reconocible.
    dm = re.search(r"^(.*?)\s+-\s+((?:Cl|Cll|Calle|Cr|Cra|Carrera|Kr|Dg|Diagonal|Tv|Transversal|Circular|Vda|Vereda|Km)\b.*)$", before, re.I | re.S)
    return (clean(dm.group(1)), clean(dm.group(2))) if dm else (before, "Sin dirección registrada")


def parse_pdf(pdf_str: str) -> tuple[str, str, list[dict]]:
    pdf = Path(pdf_str)
    text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], text=True, errors="ignore", stderr=subprocess.DEVNULL)
    period = period_from_text(text[:20000], pdf.name)
    records: list[dict] = []
    starts = [m.start() for m in re.finditer(r"Prestaci[oó]n\s+del\s+servicio:", text, re.I)]
    starts.append(len(text))
    for idx in range(len(starts)-1):
        section_start = starts[idx]
        section = text[section_start:starts[idx+1]]
        page_no = text.count("\f", 0, section_start) + 1
        header = parse_header(section)
        if not header:
            continue
        site, address = header
        site = site or "Sede sin nombre"
        water = billed_metric(section, r"(?:Agua|Acueducto)", (), "water")
        alc = billed_metric(section, r"Alcantarillado", (r"(?:Agua|Acueducto)",), "water")
        energy = billed_metric(section, r"Energ[ií]a", (r"Alcantarillado", r"(?:Agua|Acueducto)"), "energy")
        gas = billed_metric(section, r"Gas", (r"Energ[ií]a", r"Alcantarillado", r"(?:Agua|Acueducto)"), "gas")
        waste = waste_tons(section)
        row = {
            "period": period,
            "site": site,
            "address": address,
            "waterM3": water,
            "alcM3": alc,
            "energyKwh": energy,
            "gasM3": gas,
            "wasteTon": waste,
            "waterValue": billed_total(section, r"(?:Agua|Acueducto)"),
            "alcValue": billed_total(section, r"Alcantarillado"),
            "energyValue": billed_total(section, r"Energ[ií]a"),
            "gasValue": billed_total(section, r"Gas"),
            "wasteValue": total_value(section, r"Aseo"),
            "source": pdf.name,
            "sourceUrl": f"data/{pdf.name}",
            "page": page_no,
            "type": "sede",
        }
        if not any(row[k] not in (None, 0, 0.0) for k in ("waterM3","alcM3","energyKwh","gasM3","wasteTon","waterValue","alcValue","energyValue","gasValue","wasteValue")):
            continue
        row["co2kg"] = round((energy or 0) * FACTOR_CO2, 3)
        records.append(row)
    return pdf.name, period, records


def norm(value: str) -> str:
    value = strip_accents(clean(value)).lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def base_address(value: str) -> str:
    value = re.sub(r"\([^)]*interior[^)]*\)", "", value or "", flags=re.I)
    value = re.sub(r"\binterior\s+\d+\b", "", value, flags=re.I)
    return norm(value)


def is_generic_site(site: str) -> bool:
    s = norm(site)
    return any(token in s for token in (
        "distrito especial de ciencia tecnologia e innovacion de medellin",
        "municipio de medellin educacion sedes educativas",
        "municipio de medellin",
        "secretaria de educacion",
    ))


def merge_rows(rows: list[dict]) -> list[dict]:
    # Primero unifica secciones repetidas del mismo sitio/dirección.
    merged: dict[tuple[str,str,str,str], dict] = {}
    for row in rows:
        key = (row["period"], norm(row["site"]), norm(row["address"]), row["source"])
        if key not in merged:
            merged[key] = dict(row)
            merged[key]["pages"] = [row["page"]]
        else:
            dst = merged[key]
            dst["pages"].append(row["page"])
            for field in ("waterM3","alcM3","energyKwh","gasM3","wasteTon","waterValue","alcValue","energyValue","gasValue","wasteValue"):
                if row.get(field) is not None:
                    if dst.get(field) is None:
                        dst[field] = row[field]
                    elif abs(float(dst[field]) - float(row[field])) > 1e-9:
                        # Servicios distintos suman; repeticiones idénticas no se duplican.
                        dst[field] = round(float(dst[field]) + float(row[field]), 5)
            dst["co2kg"] = round((dst.get("energyKwh") or 0) * FACTOR_CO2, 3)
    rows = list(merged.values())

    # Asocia cargos genéricos (habitualmente gas) a la sede educativa única de la misma dirección.
    by_location: dict[tuple[str,str], list[dict]] = defaultdict(list)
    for row in rows:
        by_location[(row["period"], base_address(row["address"]))].append(row)
    to_remove: set[int] = set()
    for group in by_location.values():
        named = [r for r in group if not is_generic_site(r["site"])]
        generic = [r for r in group if is_generic_site(r["site"])]
        if len(named) != 1 or not generic:
            continue
        dst = named[0]
        for src in generic:
            for field in ("waterM3","alcM3","energyKwh","gasM3","wasteTon","waterValue","alcValue","energyValue","gasValue","wasteValue"):
                if src.get(field) is not None and dst.get(field) is None:
                    dst[field] = src[field]
            dst["pages"] = sorted(set(dst.get("pages",[]) + src.get("pages",[])))
            dst["co2kg"] = round((dst.get("energyKwh") or 0) * FACTOR_CO2, 3)
            to_remove.add(id(src))
    rows = [r for r in rows if id(r) not in to_remove]

    rows.sort(key=lambda r:(r["period"], norm(r["site"]), norm(r["address"]), r["source"]))
    for i, row in enumerate(rows):
        pages = sorted(set(row.pop("pages", [row.get("page",1)])))
        row["page"] = pages[0]
        if len(pages) > 1:
            row["pages"] = pages
        row["key"] = f"{row['period']}|{norm(row['site'])}|{norm(row['address'])}|{i}|{row['source']}"
    return rows


def main() -> None:
    pdfs = sorted(DATA.glob("*.pdf"))
    all_rows: list[dict] = []
    with ProcessPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(parse_pdf, str(pdf)): pdf for pdf in pdfs}
        for future in as_completed(futures):
            pdf = futures[future]
            name, period, rows = future.result()
            print(f"{name}: {period} · {len(rows)} secciones", flush=True)
            all_rows.extend(rows)
    records = merge_rows(all_rows)
    payload = {
        "version": "v56-detail-20260801",
        "generatedFrom": "17 facturas PDF verificadas con pdftotext",
        "records": records,
    }
    (DATA / "registros.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    (DATA / "registros.js").write_text(
        "window.SIMECO_PRELOADED_BUNDLE = " + compact + ";\n" +
        "window.SIMECO_REGISTROS = window.SIMECO_PRELOADED_BUNDLE.records;\n",
        encoding="utf-8",
    )
    print(f"Generados {len(records):,} registros detallados.")


if __name__ == "__main__":
    main()
