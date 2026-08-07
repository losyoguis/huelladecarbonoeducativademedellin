#!/usr/bin/env python3
"""Genera y concilia los totales oficiales por periodo desde las facturas PDF."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MONTHS = {
    "enero":"01", "febrero":"02", "marzo":"03", "abril":"04", "mayo":"05", "junio":"06",
    "julio":"07", "agosto":"08", "septiembre":"09", "octubre":"10", "noviembre":"11", "diciembre":"12",
}


def number(text: str | None):
    if text is None:
        return None
    s = re.sub(r"[^0-9,.-]", "", text.strip())
    if not s:
        return None
    negative = s.startswith("-")
    s = s.replace("-", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        value = float(("-" if negative else "") + s)
    except ValueError:
        return None
    return round(value, 5)


def first_page(pdf: Path) -> str:
    return subprocess.check_output(
        ["pdftotext", "-layout", "-f", "1", "-l", "1", str(pdf), "-"],
        text=True, errors="ignore", stderr=subprocess.DEVNULL,
    )


def money_after(text: str, label: str):
    match = re.search(rf"Total\s+{label}\s*\$\s*([\d.,-]+)", text, re.I)
    return number(match.group(1)) if match else None


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_blob_sha(path: Path) -> str:
    payload = path.read_bytes()
    return hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()


def page_count(path: Path) -> int:
    output = subprocess.check_output(["pdfinfo", str(path)], text=True, errors="ignore", stderr=subprocess.DEVNULL)
    match = re.search(r"^Pages:\s+(\d+)", output, re.M)
    return int(match.group(1)) if match else 0


def parse(pdf: Path):
    text = first_page(pdf)
    period_match = re.search(r"Resumen de facturaci[oó]n\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+de\s+(20\d{2})", text, re.I)
    if not period_match:
        raise RuntimeError(f"No se detectó el periodo en {pdf.name}")
    month = period_match.group(1).lower().translate(str.maketrans("áéíóú", "aeiou"))
    period = f"{period_match.group(2)}-{MONTHS[month]}"
    m3 = [number(v) for v in re.findall(r"ACTUAL\s+([\d.,]*)\s*m3", text, re.I)]
    energy_match = re.search(r"ACTUAL\s+([\d.,]+)\s*kwh", text, re.I)
    return {
        "period": period,
        "source": pdf.name,
        "sourceUrl": f"data/{pdf.name}",
        "waterM3": m3[0] if len(m3) > 0 else None,
        "alcM3": m3[1] if len(m3) > 1 else None,
        "energyKwh": number(energy_match.group(1)) if energy_match else None,
        "gasM3": m3[2] if len(m3) > 2 else None,
        "waterValue": money_after(text, "Acueducto"),
        "alcValue": money_after(text, "Alcantarillado"),
        "energyValue": money_after(text, "Energ[ií]a"),
        "gasValue": money_after(text, "Gas Natural"),
        "otherValue": money_after(text, "Otras Entidades"),
        "verifiedFrom": "Resumen de facturación, página 1",
    }


def pct_difference(detail: float, official: float | None):
    if not official:
        return None
    return round((detail - official) / official * 100, 4)


def main():
    detail_bundle = json.loads((DATA / "registros.json").read_text(encoding="utf-8"))
    records = detail_bundle["records"]
    detail = defaultdict(lambda: defaultdict(float))
    detail_count = defaultdict(int)
    for row in records:
        period = row.get("period")
        detail_count[period] += 1
        for key in ("energyKwh", "waterM3", "alcM3", "gasM3", "wasteTon"):
            detail[period][key] += float(row.get(key) or 0)

    pdfs = sorted(DATA.glob("*.pdf"))
    summaries = sorted((parse(pdf) for pdf in pdfs), key=lambda row: row["period"])
    for index, row in enumerate(summaries):
        d = detail[row["period"]]
        row["previousEnergyKwh"] = summaries[index - 1]["energyKwh"] if index else None
        row["detailRecords"] = detail_count[row["period"]]
        row["reconciliation"] = {
            "energyDifferencePct": pct_difference(d["energyKwh"], row.get("energyKwh")),
            "waterDifferencePct": pct_difference(d["waterM3"], row.get("waterM3")),
            "alcDifferencePct": pct_difference(d["alcM3"], row.get("alcM3")),
            "gasDifferencePct": pct_difference(d["gasM3"], row.get("gasM3")),
        }
        energy_abs = abs(row["reconciliation"]["energyDifferencePct"] or 0)
        row["qualityStatus"] = "verified" if energy_abs <= 3 else "review"

    file_index = {}
    for pdf in pdfs:
        summary = next(row for row in summaries if row["source"] == pdf.name)
        file_index[pdf.name] = {
            "name": pdf.name,
            "fingerprint": git_blob_sha(pdf),
            "sha256": sha256(pdf),
            "algorithm": "git-blob-sha1 + sha256",
            "period": summary["period"],
            "count": detail_count[summary["period"]],
            "canonical": True,
            "size": pdf.stat().st_size,
            "pages": page_count(pdf),
            "qualityStatus": summary["qualityStatus"],
        }

    payload = {
        "version": "v56-reconciled-data-20260801",
        "generatedAt": date.today().isoformat(),
        "summaries": summaries,
        "files": file_index,
    }
    (DATA / "resumenes.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "resumenes.js").write_text(
        "window.SIMECO_SUMMARY_BUNDLE = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    manifest = {
        "description": "Facturas canónicas verificadas para SiMeCO₂.",
        "dataVersion": payload["version"],
        "generatedAt": payload["generatedAt"],
        "files": [
            {
                "name": pdf.name,
                "url": f"data/{pdf.name}",
                "sha": file_index[pdf.name]["fingerprint"],
                "sha256": file_index[pdf.name]["sha256"],
                "algorithm": "git-blob-sha1 + sha256",
                "period": file_index[pdf.name]["period"],
                "size": file_index[pdf.name]["size"],
                "pages": file_index[pdf.name]["pages"],
            }
            for pdf in pdfs
        ],
    }
    (DATA / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generados y conciliados {len(summaries)} resúmenes oficiales.")


if __name__ == "__main__":
    main()
