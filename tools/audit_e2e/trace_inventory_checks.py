"""Checks del generador/documentación; NO ejecuta pruebas del producto ni UAT."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

import trace_inventory as trace


def check_synthetic_discovery():
    """Fuentes futuras en memoria: sin escribir nada en las carpetas del producto."""
    controller = "src/main/java/example/FutureController.java"
    page = "web-admin/src/features/future/FuturePage.tsx"
    router = "web-admin/src/FutureRouter.tsx"
    flutter = "mobile-app/lib/future/deep/future_widget.dart"
    hook = "web-admin/src/hooks/useQuery.ts"
    texts = {
        controller: '@RestController\n@RequestMapping("/future")\npublic class FutureController {\n@GetMapping("/{id}")\npublic Mono<String> readFuture(Long id) { return Mono.just("x"); }\n}\n',
        page: 'import { useQuery } from "../../hooks/useQuery";\nexport function FuturePage() {\nconst rows = useQuery<string[]>(`/future/${id}`);\nreturn <form><input name="future" /></form>;\n}\n',
        router: 'import FuturePage from "./features/future/FuturePage";\nconst tree = <Routes><Route element={<ProtectedRoute roles={["ADMIN"]} />}><Route path="/future" element={<FuturePage />} /></Route></Routes>;',
        flutter: 'class FutureWidget extends StatelessWidget {\nWidget build(BuildContext context) { return TextField(); }\n}\n',
        hook: 'export function useQuery<T>(url: string) { return api.get<T>(url); }',
    }
    sources = {file: {"text": text, "clean": trace.masked(text)} for file, text in texts.items()}
    methods = trace.scan_methods(sources)
    endpoints = trace.scan_endpoints(sources, methods)
    assert [e["id"] for e in endpoints] == ["GET /future/{id}"], endpoints
    clients = trace.scan_client_calls(sources, methods, endpoints)
    assert any(c["file"] == page and c["endpointIds"] == ["GET /future/{id}"] for c in clients), clients
    screens = trace.scan_screens(sources, methods, trace.import_graph(sources), clients)
    assert {page, flutter} <= {s["id"] for s in screens}
    routes = trace.route_inventory(sources, screens)
    route = next(r for r in routes if r["path"] == "/future")
    assert route["screenId"] == page and route["rolesInRoute"] == ["ADMIN"], route
    assert trace.normalize_path('/orders/${orderId}/status?state=x') == '/orders/{}/status'
    nested = '`/routes/${route.id}/path${origin ? `?fromLat=${origin.lat}` : ""}`'
    literal, end = trace.literal_value(nested, 0)
    assert end == len(nested) and trace.normalize_path(literal) == '/routes/{}/path', literal
    return "Descubrimiento sintético de pantalla anidada React, widget Flutter, endpoint, useQuery y guard ADMIN: correcto"


def check_inventory_and_uat():
    # A negative mention is not positive coverage. UAT079 explicitly says RF-70
    # does not establish purchases export; only its Relación line is binding.
    relation = trace.parse_uat_relation('No presumir RF-70 ni P05_A1.\nRelación: P09_A9; RF-72; RNF-19, RNF-20; H17.\n')
    assert relation == {'nodeIds':['P09_A9'],'requirements':['RF-72','RNF-19','RNF-20'],'findings':['H17']}
    data = trace.build_inventory()
    errors = trace.validate(data)
    assert not errors, errors
    manual = json.loads(trace.read(trace.HERE / "trace_manual.json"))
    nodes = {n["id"] for p in data["processes"] for n in p["nodes"]}
    reqs = {r["id"] for r in data["requirements"]}
    findings = set(re.findall(r'\bH\d{2}\b', trace.read(trace.ROOT / "docs/plan_correccion_integral.md")))
    for capability in manual["capabilities"]:
        assert set(capability["nodes"]) <= nodes, capability["id"]
    for process in manual["processes"].values():
        assert set(process["requirements"]) <= reqs
        assert set(process["findings"]) <= findings
    plan = trace.read(trace.ROOT / "docs/correccion_integral/Plan_Pruebas_Usuario.md")
    cases = list(re.finditer(r'^### (UAT\d{3})[^\n]*\n([\s\S]*?)(?=^### UAT\d{3}|\Z)', plan, re.M))
    assert len(cases) >= 60
    for case in cases:
        body = case.group(2)
        for label in ("Actor:", "Precondiciones:", "Datos:", "Pasos:", "Resultado esperado UI:", "Backend", "BD", "Criterio de aprobación:", "Relación:", "Estado: no ejecutado", "validación humana MICOTRANS: pendiente"):
            assert label in body, (case.group(1), label)
        assert set(re.findall(r'\bH\d{2}\b', body)) <= findings, case.group(1)
    # Al menos nueve casos distintos por cada proceso, no solo un mínimo global.
    counts = {p["id"]: sum(any(n.startswith(p["id"] + "_") for n in u["nodeIds"]) for u in data["uatTests"]) for p in data["processes"]}
    assert all(count >= 9 for count in counts.values()), counts
    by_file = {}
    checked = set()
    def check_evidence(value):
        if isinstance(value, dict):
            if "file" in value and "line" in value:
                file, line = value["file"], value["line"]
                key = file, line
                if key not in checked:
                    if file not in by_file:
                        path = trace.ROOT / file
                        assert path.is_file(), file
                        by_file[file] = trace.read(path).splitlines()
                    assert isinstance(line, int) and 1 <= line <= len(by_file[file]), key
                    checked.add(key)
            for child in value.values():
                check_evidence(child)
        elif isinstance(value, list):
            for child in value:
                check_evidence(child)
    check_evidence(data)
    return {"structuralValidation": "passed", "uatCases": len(cases), "casesRelatedByProcess": counts,
            "distinctFileLineReferencesChecked": len(checked), "snapshotConsistent": data["snapshot"]["consistent"],
            "productTestsExecuted": False, "userScenariosExecuted": False, "humanValidationMICOTRANS": "pending",
            "summary": data["summary"]}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, help="Informe JSON dentro del proyecto")
    args = parser.parse_args()
    discovery = check_synthetic_discovery()
    result = check_inventory_and_uat()
    result.update({"generatedAt": datetime.now(timezone.utc).isoformat(), "scope": "documentation_and_generator_only", "syntheticDiscovery": discovery,
                   "authoringSources": [{"file": str(p.relative_to(trace.ROOT).as_posix()), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in (Path(__file__).resolve(), trace.HERE/"trace_inventory.py", trace.HERE/"trace_manual.json", trace.ROOT/"docs/correccion_integral/Plan_Pruebas_Usuario.md")]})
    if args.report:
        target = (trace.ROOT / args.report).resolve()
        if not target.is_relative_to(trace.ROOT) or target.suffix.lower() != ".json":
            parser.error("El informe debe ser un JSON dentro del proyecto")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
