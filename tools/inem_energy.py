#!/usr/bin/env python3
"""Utilidades para integrar la electricidad del INEM desde ``data/inem``.

Las facturas eléctricas del INEM corresponden a un contrato de mercado no
regulado y no tienen el mismo formato que el consolidado educativo. Este módulo
extrae la tabla "Comportamiento histórico de consumos" y la vincula con la sede
canónica ya existente en SiMeCO₂.
"""
from __future__ import annotations

import re
import subprocess
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

FACTOR_CO2 = 0.126
INEM_SITE = "Inem J F De Rpo"
INEM_DISPLAY_NAME = "I.E. INEM José Félix de Restrepo"
INEM_ADDRESS = "Cr 48 Cl 1 -125"

MONTH_SHORT = {
    "ene": "01", "feb": "02", "mar": "03", "abr": "04", "may": "05", "jun": "06",
    "jul": "07", "ago": "08", "sep": "09", "oct": "10", "nov": "11", "dic": "12",
}
MONTH_LONG = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04", "mayo": "05", "junio": "06",
    "julio": "07", "agosto": "08", "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}


def strip_accents(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value or "") if unicodedata.category(c) != "Mn")


def norm(value: str) -> str:
    value = strip_accents(value or "").lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def number_co(value: str | None) -> float | None:
    """Convierte 39.643,75 / 28035,74 al valor decimal esperado."""
    if value is None:
        return None
    s = re.sub(r"[^0-9,.-]", "", value.strip())
    if not s:
        return None
    neg = s.startswith("-")
    s = s.replace("-", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        out = float(("-" if neg else "") + s)
    except ValueError:
        return None
    return round(out, 5)


def pdf_text(pdf: Path) -> str:
    return subprocess.check_output(
        ["pdftotext", "-layout", str(pdf), "-"],
        text=True, errors="ignore", stderr=subprocess.DEVNULL,
    )


def period_from_bill(text: str) -> str | None:
    m = re.search(r"Resumen\s+facturaci[oó]n\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s*/\s*(20\d{2})", text, re.I)
    if not m:
        return None
    month = strip_accents(m.group(1)).lower()
    code = MONTH_LONG.get(month)
    return f"{m.group(2)}-{code}" if code else None


def text_value(text: str, pattern: str) -> str | None:
    m = re.search(pattern, text, re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


@dataclass(frozen=True)
class InemReading:
    period: str
    energy_kwh: float
    source_name: str
    source_url: str
    source_page: int
    invoice_period: str | None
    contract: str | None
    service_id: str | None
    market: str | None
    category: str | None
    voltage_level: str | None


def parse_inem_pdf(pdf: Path, root_data: Path) -> list[InemReading]:
    text = pdf_text(pdf)
    normalized = strip_accents(text).lower()
    if "inem" not in normalized or "consumo activa" not in normalized:
        return []

    invoice_period = period_from_bill(text)
    contract = text_value(text, r"Contrato\s*:\s*(\d+)")
    service_id = text_value(text, r"servicio\s+suscrito\s+(\d+)")
    market = text_value(text, r"(Mercado\s+No\s+Regulado)")
    category = text_value(text, r"Categor[ií]a\s*:\s*([A-Za-zÁÉÍÓÚáéíóú]+)")
    voltage_level = text_value(text, r"Nivel\s+De\s+Tensi[oó]n\s*:\s*([^\-\n]+)")

    start = re.search(r"Comportamiento\s+hist[oó]rico\s+de\s+consumos", text, re.I)
    if not start:
        return []
    tail = text[start.end():]
    end = re.search(r"Activa\s+Promedio", tail, re.I)
    table = tail[: end.end() if end else 5000]

    values: dict[str, float] = {}
    pattern = re.compile(r"\b(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)-(\d{2})\s+([\d.]+,\d{1,3})", re.I)
    for m in pattern.finditer(table):
        month = MONTH_SHORT[m.group(1).lower()]
        year = 2000 + int(m.group(2))
        value = number_co(m.group(3))
        if value is not None:
            values[f"{year:04d}-{month}"] = value

    try:
        rel = pdf.relative_to(root_data).as_posix()
    except ValueError:
        rel = f"inem/{pdf.name}"
    source_url = f"data/{rel}"
    return [
        InemReading(
            period=period,
            energy_kwh=value,
            source_name=pdf.name,
            source_url=source_url,
            source_page=1,
            invoice_period=invoice_period,
            contract=contract,
            service_id=service_id,
            market=market,
            category=category,
            voltage_level=voltage_level,
        )
        for period, value in sorted(values.items())
    ]


def collect_inem_readings(data_dir: Path) -> dict[str, InemReading]:
    """Devuelve la lectura más reciente disponible para cada periodo."""
    inem_dir = data_dir / "inem"
    if not inem_dir.exists():
        return {}
    candidates: list[tuple[str, InemReading]] = []
    for pdf in sorted(inem_dir.glob("*.pdf")):
        for reading in parse_inem_pdf(pdf, data_dir):
            candidates.append((reading.invoice_period or "0000-00", reading))
    candidates.sort(key=lambda item: (item[0], item[1].source_name))
    latest: dict[str, InemReading] = {}
    for _, reading in candidates:
        latest[reading.period] = reading
    return latest


def is_inem_record(row: dict) -> bool:
    return norm(row.get("site", "")) == norm(INEM_SITE) and norm(row.get("address", "")) == norm(INEM_ADDRESS)


def enrich_records(records: Iterable[dict], data_dir: Path) -> tuple[list[dict], dict]:
    """Integra lecturas INEM sin duplicar la fila consolidada del mismo periodo.

    Si la serie eléctrica incluye un periodo que todavía no existe en el consolidado,
    crea una fila energética independiente para no perder el dato.
    """
    # data/inem es la fuente de verdad para esta integración. Antes de aplicar
    # los PDF actuales, retiramos una integración INEM previa para que el proceso
    # sea idempotente y para que eliminar/reemplazar una factura no deje datos
    # eléctricos obsoletos en los bundles.
    rows: list[dict] = []
    for original in records:
        row = dict(original)
        if str(row.get("energySourceType") or "") == "inem_external_contract":
            source_url = str(row.get("sourceUrl") or "")
            is_generated_external_row = source_url.startswith("data/inem/") and all(
                row.get(field) is None for field in ("waterM3", "alcM3", "gasM3", "wasteTon")
            )
            if is_generated_external_row:
                continue
            row["energyKwh"] = None
            row["energyValue"] = None
            row["co2kg"] = None
            for key in list(row):
                if key.startswith("energySource") or key in {
                    "energyInvoicePeriod", "energyContract", "energyServiceId",
                    "energyMarket", "energyCategory", "energyVoltageLevel",
                }:
                    row.pop(key, None)
        rows.append(row)

    readings = collect_inem_readings(data_dir)
    matched: set[str] = set()

    for row in rows:
        if not is_inem_record(row):
            continue
        reading = readings.get(str(row.get("period") or ""))
        if not reading:
            continue
        matched.add(reading.period)
        row["energyKwh"] = reading.energy_kwh
        row["co2kg"] = round(reading.energy_kwh * FACTOR_CO2, 3)
        # El valor monetario histórico mensual no aparece completo en la tabla;
        # por rigor se conserva energyValue como null cuando no existe una serie comparable.
        row["energyValue"] = row.get("energyValue") if row.get("energyValue") is not None else None
        row["energySource"] = reading.source_name
        row["energySourceUrl"] = reading.source_url
        row["energySourcePage"] = reading.source_page
        row["energySourceType"] = "inem_external_contract"
        row["energyInvoicePeriod"] = reading.invoice_period
        row["energyContract"] = reading.contract
        row["energyServiceId"] = reading.service_id
        row["energyMarket"] = reading.market
        row["energyCategory"] = reading.category
        row["energyVoltageLevel"] = reading.voltage_level

    # Permite integrar un mes INEM aunque aún no exista la factura consolidada general.
    for period, reading in sorted(readings.items()):
        if period in matched:
            continue
        idx = len(rows)
        source_rel = reading.source_url.removeprefix("data/")
        rows.append({
            "period": period,
            "site": INEM_SITE,
            "address": INEM_ADDRESS,
            "waterM3": None,
            "alcM3": None,
            "energyKwh": reading.energy_kwh,
            "gasM3": None,
            "wasteTon": None,
            "waterValue": None,
            "alcValue": None,
            "energyValue": None,
            "gasValue": None,
            "wasteValue": None,
            "source": source_rel,
            "sourceUrl": reading.source_url,
            "page": reading.source_page,
            "type": "sede",
            "co2kg": round(reading.energy_kwh * FACTOR_CO2, 3),
            "key": f"{period}|{norm(INEM_SITE)}|{norm(INEM_ADDRESS)}|inem-{idx}|{source_rel}",
            "energySource": reading.source_name,
            "energySourceUrl": reading.source_url,
            "energySourcePage": reading.source_page,
            "energySourceType": "inem_external_contract",
            "energyInvoicePeriod": reading.invoice_period,
            "energyContract": reading.contract,
            "energyServiceId": reading.service_id,
            "energyMarket": reading.market,
            "energyCategory": reading.category,
            "energyVoltageLevel": reading.voltage_level,
        })

    rows.sort(key=lambda r: (str(r.get("period") or ""), norm(r.get("site", "")), norm(r.get("address", "")), str(r.get("source") or "")))
    total_kwh = round(sum(r.energy_kwh for r in readings.values()), 5)
    stats = {
        "pdfs": len(list((data_dir / "inem").glob("*.pdf"))) if (data_dir / "inem").exists() else 0,
        "periods": len(readings),
        "periodList": sorted(readings),
        "totalKwh": total_kwh,
        "co2kg": round(total_kwh * FACTOR_CO2, 3),
        "records": len(rows),
    }
    return rows, stats
