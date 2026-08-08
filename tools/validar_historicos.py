#!/usr/bin/env python3
"""Valida la coherencia e integridad de los históricos eléctricos de SiMeCO₂ v92."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EXPECTED_PERIODS = [
    "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
    "2025-07", "2025-08", "2025-11", "2025-12", "2026-01", "2026-02",
    "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
]
THRESHOLDS = {"energyKwh": 3.0}
EXPECTED_ENERGY = {
    "2025-01": 710596.02, "2025-02": 854824.14, "2025-03": 1237425.50,
    "2025-04": 1236143.74, "2025-05": 1161043.02, "2025-06": 1259958.95,
    "2025-07": 987201.89, "2025-08": 1228480.90, "2025-11": 1229352.43,
    "2025-12": 1169243.39, "2026-01": 755186.76, "2026-02": 833873.56,
    "2026-03": 1252323.71, "2026-04": 1266248.75, "2026-05": 1255948.11,
    "2026-06": 1284372.89, "2026-07": 1078205.60,
}
LABELS = {"energyKwh": "Energía"}


def load_json(name: str) -> Any:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def git_blob_sha(path: Path) -> str:
    size = path.stat().st_size
    h = hashlib.sha1()
    h.update(f"blob {size}\0".encode("utf-8"))
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def pdf_pages(path: Path) -> int:
    result = subprocess.run(
        ["pdfinfo", str(path)], capture_output=True, text=True, check=True, timeout=30
    )
    for line in result.stdout.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise RuntimeError(f"No fue posible leer el número de páginas de {path.name}")


def pct_difference(detail: float, official: float) -> float:
    if official == 0:
        return 0.0 if detail == 0 else float("inf")
    return (detail - official) / official * 100.0


def fmt(value: float) -> str:
    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    registros_bundle = load_json("registros.json")
    resumenes_bundle = load_json("resumenes.json")
    manifest = load_json("manifest.json")

    records = registros_bundle.get("records", [])
    summaries = resumenes_bundle.get("summaries", [])
    manifest_files = manifest.get("files", [])

    periods_records = sorted({str(r.get("period", "")) for r in records if r.get("period")})
    periods_summaries = sorted({str(s.get("period", "")) for s in summaries if s.get("period")})
    periods_manifest = sorted({str(f.get("period", "")) for f in manifest_files if f.get("period")})

    if periods_records != EXPECTED_PERIODS:
        errors.append(f"Periodos del detalle inesperados: {periods_records}")
    if periods_summaries != EXPECTED_PERIODS:
        errors.append(f"Periodos de resúmenes inesperados: {periods_summaries}")
    if periods_manifest != EXPECTED_PERIODS:
        errors.append(f"Periodos del manifiesto inesperados: {periods_manifest}")
    if len(records) != 9147:
        errors.append(f"Se esperaban 9.147 registros detallados y se encontraron {len(records):,}.")
    if len(summaries) != 17:
        errors.append(f"Se esperaban 17 resúmenes oficiales y se encontraron {len(summaries)}.")
    if len(manifest_files) != 17:
        errors.append(f"Se esperaban 17 PDF en el manifiesto y se encontraron {len(manifest_files)}.")

    keys = [str(r.get("key", "")) for r in records]
    duplicate_keys = len(keys) - len(set(keys))
    if duplicate_keys:
        errors.append(f"Hay {duplicate_keys} claves duplicadas en registros.json.")
    blank_sites = sum(not str(r.get("site", "")).strip() for r in records)
    generic_sites = [r for r in records if str(r.get("site", "")).strip().casefold() == "sede sin nombre"]
    generic_addresses = sorted({str(r.get("address", "")).strip() for r in generic_sites if str(r.get("address", "")).strip()})
    if blank_sites:
        errors.append(f"Hay {blank_sites} registros con nombre de sede vacío.")
    if generic_sites:
        warnings.append(
            f"Hay {len(generic_sites)} registros con la etiqueta fuente 'Sede sin nombre' en {len(generic_addresses)} dirección(es). "
            "Se conservan sin renombrar porque la factura no identifica una I.E. específica."
        )
    july_count = sum(r.get("period") == "2026-07" for r in records)
    if july_count <= 0:
        errors.append("Julio de 2026 no tiene detalle precargado.")

    by_period: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for row in records:
        period = str(row.get("period", ""))
        for field in THRESHOLDS:
            try:
                by_period[period][field] += float(row.get(field) or 0)
            except (TypeError, ValueError):
                errors.append(f"Valor no numérico en {field}, periodo {period}, clave {row.get('key')}")

    max_diffs = {field: 0.0 for field in THRESHOLDS}
    reconciliation_rows: list[str] = []
    summary_by_source = {str(s.get("source")): s for s in summaries}
    summary_by_period = {str(s.get("period")): s for s in summaries}

    for period in EXPECTED_PERIODS:
        summary = summary_by_period.get(period)
        if not summary:
            continue
        energy_detail = by_period[period]["energyKwh"]
        energy_official = float(summary.get("energyKwh") or 0)
        expected_energy = EXPECTED_ENERGY[period]
        if abs(energy_official - expected_energy) > 0.01:
            errors.append(
                f"El total oficial de energía cambió en {period}: {energy_official:.2f} != {expected_energy:.2f}."
            )
        energy_pct = pct_difference(energy_detail, energy_official)
        reconciliation_rows.append(
            f"{period} | {fmt(energy_detail)} | {fmt(energy_official)} | {energy_pct:+.3f}% | {summary.get('detailRecords', 0)}"
        )
        if int(summary.get("detailRecords") or 0) != sum(r.get("period") == period for r in records):
            errors.append(f"detailRecords no coincide en {period}.")
        if summary.get("verifiedFrom") != "Resumen de facturación, página 1":
            warnings.append(f"La fuente oficial de {period} no tiene la etiqueta esperada.")
        if summary.get("qualityStatus") != "verified":
            errors.append(f"El estado de calidad de {period} no es verified.")

        stored_recon = summary.get("reconciliation") or {}
        recon_key = {
            "energyKwh": "energyDifferencePct",
            "waterM3": "waterDifferencePct",
            "alcM3": "alcDifferencePct",
            "gasM3": "gasDifferencePct",
        }
        for field, threshold in THRESHOLDS.items():
            detail = by_period[period][field]
            official = float(summary.get(field) or 0)
            difference = pct_difference(detail, official)
            max_diffs[field] = max(max_diffs[field], abs(difference))
            if abs(difference) > threshold + 1e-9:
                errors.append(
                    f"{LABELS[field]} excede el umbral en {period}: {difference:+.4f}% > {threshold:.1f}%."
                )
            stored = stored_recon.get(recon_key[field])
            if stored is None or abs(float(stored) - round(difference, 4)) > 0.001:
                errors.append(
                    f"La conciliación almacenada de {LABELS[field].lower()} no coincide en {period}."
                )

    total_official = sum(float(s.get("energyKwh") or 0) for s in summaries)
    expected_total = sum(EXPECTED_ENERGY.values())
    if abs(total_official - expected_total) > 0.01:
        errors.append(f"Total oficial acumulado inesperado: {total_official:.2f} != {expected_total:.2f}.")

    integrity_rows: list[str] = []
    for item in manifest_files:
        name = str(item.get("name", ""))
        path = DATA / name
        item_errors: list[str] = []
        if not path.is_file():
            item_errors.append("archivo ausente")
        else:
            if path.stat().st_size != int(item.get("size") or -1):
                item_errors.append("tamaño diferente")
            if sha256(path) != item.get("sha256"):
                item_errors.append("SHA-256 diferente")
            if git_blob_sha(path) != item.get("sha"):
                item_errors.append("Git blob SHA-1 diferente")
            try:
                if pdf_pages(path) != int(item.get("pages") or -1):
                    item_errors.append("páginas diferentes")
            except Exception as exc:  # noqa: BLE001
                item_errors.append(f"pdfinfo falló: {exc}")
        summary = summary_by_source.get(name)
        if not summary:
            item_errors.append("sin resumen oficial")
        elif summary.get("period") != item.get("period"):
            item_errors.append("periodo distinto entre resumen y manifiesto")
        status = "OK" if not item_errors else "ERROR: " + "; ".join(item_errors)
        integrity_rows.append(f"{status} | {name}")
        errors.extend(f"{name}: {message}" for message in item_errors)

    lines = [
        "CONTROL DE CALIDAD DE HISTÓRICOS — SiMeCO₂ v99",
        f"Fecha: {date.today().isoformat()}",
        "",
        "CRITERIO DE FUENTE",
        "El histórico global usa exclusivamente el valor ACTUAL del Resumen de facturación de la página 1 de cada PDF.",
        "El detalle por sede se usa para búsquedas, rankings, informes y planes de gestión; se concilia contra el total oficial.",
        "",
        "RESUMEN",
        f"PDF oficiales: {len(manifest_files)}",
        f"Periodos oficiales: {len(summaries)}",
        f"Registros detallados: {len(records):,}",
        f"Registros de julio de 2026: {july_count:,}",
        f"Energía oficial acumulada: {fmt(total_official)} kWh",
        f"Claves duplicadas: {duplicate_keys}",
        f"Nombres de sede vacíos: {blank_sites}",
        f"Registros con etiqueta fuente 'Sede sin nombre': {len(generic_sites)} ({len(generic_addresses)} direcciones)",
        "",
        "CONCILIACIÓN DE ENERGÍA",
        "Periodo | Detalle por sede (kWh) | Total oficial (kWh) | Diferencia | Registros",
        *reconciliation_rows,
        "",
        "DIFERENCIA MÁXIMA ABSOLUTA DEL DETALLE FRENTE AL TOTAL OFICIAL",
        *(f"{LABELS[field]}: {value:.4f}% (umbral {THRESHOLDS[field]:.1f}%)" for field, value in max_diffs.items()),
        "",
        "INTEGRIDAD DE LOS PDF",
        *integrity_rows,
        "",
    ]
    if warnings:
        lines.extend(["ADVERTENCIAS", *[f"- {w}" for w in warnings], ""])
    lines.extend([
        "RESULTADO",
        "APROBADO" if not errors else "REVISAR",
    ])
    if errors:
        lines.extend(["", "ERRORES", *[f"- {e}" for e in errors]])

    report = "\n".join(lines) + "\n"
    (ROOT / "CONTROL-CALIDAD-HISTORICOS-v92.txt").write_text(report, encoding="utf-8")
    print(report)
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
