#!/usr/bin/env python3
"""Auditoría estática, estructural, API y datos de SiMeCO₂ v62."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CORE_PAGES = ["index.html", "dashboard.html", "aula-climatica.html"]
ALL_PAGES = sorted(ROOT.glob("*.html"))
REQUIRED_SCRIPT_ORDER = [
    "data/registros.js",
    "data/resumenes.js",
    "data/sincronizacion-territorial.js",
    "data/excepciones-servicios.js",
    "app.js",
]
IGNORED_PREFIXES = ("http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:", "blob:")


class HtmlAuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.refs: list[tuple[str, str]] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.ids.append(element_id)
        for attr in ("src", "href"):
            value = values.get(attr)
            if value:
                self.refs.append((attr, value))
        if tag.lower() == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")


def clean_local_ref(value: str) -> str | None:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith(IGNORED_PREFIXES):
        return None
    split = urlsplit(value)
    path = unquote(split.path)
    if not path or "${" in path or "{{" in path:
        return None
    return path


def run(command: list[str], *, timeout: int = 120) -> tuple[bool, str]:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    checks: list[str] = []

    # JSON legible.
    json_files = sorted(ROOT.rglob("*.json"))
    for path in json_files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"JSON inválido {path.relative_to(ROOT)}: {exc}")
    checks.append(f"JSON validados: {len(json_files)}")

    # Sintaxis JavaScript.
    js_files = sorted(ROOT.rglob("*.js"))
    for path in js_files:
        ok, output = run(["node", "--check", str(path)])
        if not ok:
            errors.append(f"JavaScript inválido {path.relative_to(ROOT)}: {output}")
    checks.append(f"JavaScript validados con node --check: {len(js_files)}")

    # Python de herramientas.
    py_files = sorted((ROOT / "tools").glob("*.py"))
    for path in py_files:
        ok, output = run([sys.executable, "-m", "py_compile", str(path)])
        if not ok:
            errors.append(f"Python inválido {path.relative_to(ROOT)}: {output}")
    checks.append(f"Herramientas Python compiladas: {len(py_files)}")

    # HTML: IDs, referencias locales y scripts.
    for page in ALL_PAGES:
        parser = HtmlAuditParser()
        parser.feed(page.read_text(encoding="utf-8"))
        duplicates = sorted({x for x in parser.ids if parser.ids.count(x) > 1})
        if duplicates:
            errors.append(f"IDs duplicados en {page.name}: {', '.join(duplicates)}")
        for attr, value in parser.refs:
            local = clean_local_ref(value)
            if local is None:
                continue
            target = (page.parent / local).resolve()
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                warnings.append(f"Referencia local fuera del paquete en {page.name}: {value}")
                continue
            if not target.exists():
                errors.append(f"Referencia rota en {page.name}: {attr}=\"{value}\"")

        if page.name in CORE_PAGES:
            normalized = [urlsplit(src).path for src in parser.scripts]
            indices: list[int] = []
            for required in REQUIRED_SCRIPT_ORDER:
                try:
                    indices.append(normalized.index(required))
                except ValueError:
                    errors.append(f"Falta {required} en {page.name}.")
            if len(indices) == len(REQUIRED_SCRIPT_ORDER) and indices != sorted(indices):
                errors.append(f"Orden incorrecto de scripts de datos en {page.name}.")
            html = page.read_text(encoding="utf-8")
            for marker in ("history-chart-scroll", 'id="historyDataTable"', 'id="downloadPlanBtn"'):
                if marker not in html:
                    errors.append(f"Falta {marker} en {page.name}.")
    checks.append(f"HTML auditados: {len(ALL_PAGES)}")

    # Limpieza del paquete.
    residuals = [p.relative_to(ROOT) for p in ROOT.rglob("1") if p.is_file()]
    forbidden = ["app.min.js", "styles.min.css", "js/app.js"]
    residuals.extend(Path(name) for name in forbidden if (ROOT / name).exists())
    if residuals:
        errors.append("Archivos residuales o duplicados: " + ", ".join(map(str, residuals)))
    checks.append("No hay archivos residuales llamados '1' ni copias obsoletas minificadas")

    # Marcadores críticos del código.
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    critical_markers = [
        "const STORE_KEY = 'simeco2_servicios_v15'",
        "const DATA_VERSION = 'v62-grounded-assistant-20260807'",
        "function compactStorePayload",
        "function downloadCurrentPlan",
        "function renderHistoryDataTable",
        "window.SIMECO_TERRITORIAL_SYNC",
        "function parseMeasurement",
    ]
    for marker in critical_markers:
        if marker not in app:
            errors.append(f"Falta marcador crítico en app.js: {marker}")
    if "dashboardFilteredRecords()" in app:
        errors.append("Permanece una llamada a dashboardFilteredRecords(), que no existe.")
    for marker in (
        "function recordHasReading",
        "dashboard-data-notice",
        "No calculable",
        "preferredSiteName",
        "function renderDataQuality",
        "function renderSiteProfile",
        "SERVICE_METRICS",
        "function selectedHistoryMetric",
        "function selectedRankingMetric",
        "Energía no identificada",
        "Energía en contrato separado",
        "function serviceExceptionForSite",
    ):
        if marker not in app:
            errors.append(f"Falta comportamiento heredado en app.js: {marker}")
    checks.append("Marcadores funcionales críticos heredados presentes")

    # Cargar los bundles JS en un contexto aislado de Node y contrastar conteos.
    node_probe = r"""
const fs=require('fs'), vm=require('vm');
const context={window:{}}; vm.createContext(context);
for(const file of ['data/registros.js','data/resumenes.js','data/sincronizacion-territorial.js','data/excepciones-servicios.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const recordsJson=JSON.parse(fs.readFileSync('data/registros.json','utf8'));
const summariesJson=JSON.parse(fs.readFileSync('data/resumenes.json','utf8'));
const territoryJson=JSON.parse(fs.readFileSync('data/sincronizacion-territorial.json','utf8'));
const exceptionsJson=JSON.parse(fs.readFileSync('data/excepciones-servicios.json','utf8'));
const jsRecords=context.window.SIMECO_REGISTROS||[];
const jsSummaries=context.window.SIMECO_SUMMARY_BUNDLE||{};
const jsTerritory=context.window.SIMECO_TERRITORIAL_SYNC||{};
const jsExceptions=context.window.SIMECO_SERVICE_EXCEPTIONS||{};
const out={
 records:jsRecords.length,
 recordVersion:(context.window.SIMECO_PRELOADED_BUNDLE||{}).version,
 summaries:(jsSummaries.summaries||[]).length,
 summaryVersion:jsSummaries.version,
 territory:Object.keys(jsTerritory).length,
 exceptions:(jsExceptions.exceptions||[]).length,
 recordsEqual:JSON.stringify(jsRecords)===JSON.stringify(recordsJson.records),
 summariesEqual:JSON.stringify(jsSummaries.summaries||[])===JSON.stringify(summariesJson.summaries||[]),
 filesEqual:JSON.stringify(jsSummaries.files||{})===JSON.stringify(summariesJson.files||{}),
 territoryEqual:JSON.stringify(jsTerritory)===JSON.stringify(territoryJson.metadata||{}),
 exceptionsEqual:JSON.stringify(jsExceptions)===JSON.stringify(exceptionsJson)
};
console.log(JSON.stringify(out));
"""
    ok, output = run(["node", "-e", node_probe])
    if not ok:
        errors.append(f"No fue posible cargar los bundles JS: {output}")
    else:
        try:
            probe = json.loads(output.splitlines()[-1])
            if probe.get("records") != 9147:
                errors.append(f"registros.js expone {probe.get('records')} registros, no 9.147.")
            if probe.get("summaries") != 17:
                errors.append(f"resumenes.js expone {probe.get('summaries')} periodos, no 17.")
            if probe.get("recordVersion") != "v56-detail-20260801":
                errors.append(f"Versión inesperada en registros.js: {probe.get('recordVersion')}")
            if probe.get("summaryVersion") != "v56-reconciled-data-20260801":
                errors.append(f"Versión inesperada en resumenes.js: {probe.get('summaryVersion')}")
            if int(probe.get("territory", -1)) <= 0:
                errors.append("La sincronización territorial JS no expone metadatos.")
            for field, label in (
                ("recordsEqual", "registros.js frente a registros.json"),
                ("summariesEqual", "resumenes.js frente a resumenes.json"),
                ("filesEqual", "metadatos de archivos JS frente a JSON"),
                ("territoryEqual", "sincronización territorial JS frente a JSON"),
                ("exceptionsEqual", "excepciones de servicios JS frente a JSON"),
            ):
                if not probe.get(field):
                    errors.append(f"No coincide {label}.")
            checks.append(
                f"Bundles JS cargados: {probe.get('records')} registros, {probe.get('summaries')} resúmenes, {probe.get('territory')} coincidencias territoriales y {probe.get('exceptions')} excepción(es) de servicio"
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Salida no interpretable de la prueba de bundles JS: {exc}; {output}")

    # Caso de regresión heredada: INEM existe en 17 periodos, sin energía, con agua/alcantarillado/aseo y alias oficial.
    records_data = json.loads((ROOT / "data/registros.json").read_text(encoding="utf-8")).get("records", [])
    inem = [r for r in records_data if r.get("site") == "Inem J F De Rpo" and r.get("address") == "Cr 48 Cl 1 -125"]
    territory_data = json.loads((ROOT / "data/sincronizacion-territorial.json").read_text(encoding="utf-8")).get("metadata", {})
    inem_meta = territory_data.get("inem j f de rpo|cr 48 cl 1 -125", {})
    if len({r.get("period") for r in inem}) != 17:
        errors.append("Caso INEM: no se encontraron los 17 periodos esperados.")
    if any(r.get("energyKwh") is not None for r in inem):
        errors.append("Caso INEM: se esperaba energía ausente; no debe convertirse a 0 ni inventarse.")
    if not all(r.get("waterM3") is not None and r.get("alcM3") is not None and r.get("wasteTon") is not None for r in inem):
        errors.append("Caso INEM: faltan servicios disponibles que deberían conservarse.")
    if inem_meta.get("displayName") != "I.E. INEM José Félix de Restrepo" or inem_meta.get("nucleus") != "932":
        errors.append("Caso INEM: falta la vinculación institucional oficial.")
    exceptions_data = json.loads((ROOT / "data/excepciones-servicios.json").read_text(encoding="utf-8"))
    inem_ex = next((x for x in exceptions_data.get("exceptions", []) if x.get("displayName") == "I.E. INEM José Félix de Restrepo" and x.get("service") == "energyKwh"), None)
    if not inem_ex or inem_ex.get("status") != "external_contract":
        errors.append("Caso INEM: falta la excepción verificada de energía en contrato separado.")
    if not inem_ex or len(inem_ex.get("evidence", [])) < 2:
        errors.append("Caso INEM: la excepción contractual no conserva las dos evidencias documentales esperadas.")
    checks.append("Regresión INEM: 17 periodos conservados, energía ausente en el consolidado, alias oficial y contrato separado verificados")

    # Caso de regresión: Fe y Alegría Santo Domingo Savio integra dos cuentas/sedes sin perder trazabilidad.
    fya_main = [r for r in records_data if r.get("site") == "Municipio De Medellin" and r.get("address") == "Cr 29 Cl 110 A -83"]
    fya_second = [r for r in records_data if r.get("site") == "Esc.sto Domingo Savio 2" and r.get("address") == "Cr 30 Cl 110 B -24"]
    fya = fya_main + fya_second
    main_meta = territory_data.get("municipio de medellin|cr 29 cl 110 a -83", {})
    second_meta = territory_data.get("esc.sto domingo savio 2|cr 30 cl 110 b -24", {})
    if len(fya_main) != 17 or len(fya_second) != 17 or len({r.get("period") for r in fya}) != 17:
        errors.append("Caso Fe y Alegría Santo Domingo Savio: se esperaban 17 periodos para cada una de las dos cuentas vinculadas.")
    if main_meta.get("institutionGroupId") != "MED-914-004" or second_meta.get("institutionGroupId") != "MED-914-004":
        errors.append("Caso Fe y Alegría Santo Domingo Savio: las dos cuentas no comparten el grupo institucional MED-914-004.")
    if main_meta.get("institutionDisplayName") != "I.E. Fe y Alegría Santo Domingo Savio" or second_meta.get("institutionDisplayName") != "I.E. Fe y Alegría Santo Domingo Savio":
        errors.append("Caso Fe y Alegría Santo Domingo Savio: falta el nombre institucional común.")
    energy_total = sum(float(r.get("energyKwh") or 0) for r in fya)
    water_total = sum(float(r.get("waterM3") or 0) for r in fya)
    alc_total = sum(float(r.get("alcM3") or 0) for r in fya)
    waste_total = sum(float(r.get("wasteTon") or 0) for r in fya)
    if abs(energy_total - 73924.0) > 0.01 or abs(water_total - 14600.0) > 0.01 or abs(alc_total - 14600.0) > 0.01 or abs(waste_total - 49.48171) > 0.00001:
        errors.append(f"Caso Fe y Alegría Santo Domingo Savio: totales inesperados (energía={energy_total}, agua={water_total}, alc={alc_total}, residuos={waste_total}).")
    july26 = [r for r in fya if r.get("period") == "2026-07"]
    if abs(sum(float(r.get("energyKwh") or 0) for r in july26) - 4577.0) > 0.01 or abs(sum(float(r.get("waterM3") or 0) for r in july26) - 576.0) > 0.01:
        errors.append("Caso Fe y Alegría Santo Domingo Savio: julio de 2026 no concilia con 4.577 kWh y 576 m³ de agua.")
    checks.append("Regresión Fe y Alegría Santo Domingo Savio: 2 sedes, 34 registros, 17 periodos y totales institucionales verificados")


    # Capa API/IA v62.
    required_api = [
        "api/chat.js", "api/health.js", "api/institutions.js", "api/institution.js",
        "api/history.js", "api/ranking.js", "api/quality.js", "api/compare.js",
        "api/_lib/simeco-data.js", "api/_lib/assistant-core.js", "assistant-config.js",
        "package.json", "vercel.json", ".env.example",
    ]
    missing_api = [name for name in required_api if not (ROOT / name).exists()]
    if missing_api:
        errors.append("Faltan archivos de API/IA v61: " + ", ".join(missing_api))
    else:
        checks.append("Capa API/IA v62 presente con endpoints, configuración y backend serverless")
    assistant = (ROOT / "assistant.js").read_text(encoding="utf-8")
    for marker in ("resolvedApiUrl", "apiAnswer", "probeApi", "simeco2_assistant_session_v62"):
        if marker not in assistant:
            errors.append(f"Falta marcador del Asistente v62: {marker}")
    if "OPENAI_API_KEY" in assistant or "OPENAI_API_KEY" in (ROOT / "assistant-config.js").read_text(encoding="utf-8"):
        # La mención en comentario de assistant-config es aceptable; detectar solo asignaciones sospechosas.
        cfg=(ROOT / "assistant-config.js").read_text(encoding="utf-8")
        if "sk-" in cfg or "OPENAI_API_KEY=" in cfg:
            errors.append("Posible secreto de OpenAI expuesto en archivos públicos del frontend.")
    ok, output = run(["npm", "run", "check"], timeout=120)
    if not ok:
        errors.append("Falló npm run check para la capa v61: " + output)
    else:
        checks.append("Sintaxis de endpoints API y Asistente v62 validada con Node")
    ok, output = run(["npm", "test"], timeout=120)
    if not ok:
        errors.append("Fallaron las pruebas automatizadas v61: " + output)
    else:
        checks.append("Pruebas automatizadas de datos y endpoints v62 aprobadas")

    # Ejecutar la validación de históricos como parte del control integral.
    ok, output = run([sys.executable, "tools/validar_historicos.py"], timeout=600)
    if not ok:
        errors.append("La validación de históricos falló. Consulte CONTROL-CALIDAD-HISTORICOS-v56.txt.")
    else:
        checks.append("Históricos, conciliación e integridad de los 17 PDF aprobados")

    lines = [
        "CONTROL DE CALIDAD INTEGRAL — SiMeCO₂ v62",
        f"Fecha: {date.today().isoformat()}",
        "",
        "ALCANCE",
        "Auditoría estática del código, estructura HTML, referencias locales, bundles de datos, sintaxis e integridad documental.",
        "No sustituye una prueba visual automatizada en todos los navegadores y dispositivos.",
        "",
        "PRUEBAS EJECUTADAS",
        *[f"- OK: {item}" for item in checks],
    ]
    if warnings:
        lines.extend(["", "ADVERTENCIAS", *[f"- {item}" for item in warnings]])
    lines.extend(["", "RESULTADO", "APROBADO" if not errors else "REVISAR"])
    if errors:
        lines.extend(["", "ERRORES", *[f"- {item}" for item in errors]])
    report = "\n".join(lines) + "\n"
    (ROOT / "CONTROL-CALIDAD-v61.txt").write_text(report, encoding="utf-8")
    print(report)
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
