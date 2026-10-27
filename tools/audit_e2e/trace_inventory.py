"""Inventario estático regenerable; solo biblioteca estándar y fuentes locales.

No ejecuta código del producto, llamadas HTTP, BD ni pruebas UAT.
Los vínculos por importación y asociación editorial son candidatos explícitos.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BPMN_DIR = Path("docs/entregables_procesos_ecoroute/negocio_revisado/bpmn")
REQUIREMENTS = Path("docs/auditoria_end_to_end_20261019/evidencias/requisitos_y_bpmn.json")
OUTPUT = Path("docs/correccion_integral/inventario_trazabilidad.json")
NS = {"b": "http://www.omg.org/spec/BPMN/20100524/MODEL"}
IGNORED = {"node_modules", "build", "dist", ".git", ".dart_tool", ".gradle", "__pycache__", "coverage"}
EXTENSIONS = {".java", ".dart", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".sql", ".yml", ".yaml"}


def rel(path):
    return path.relative_to(ROOT).as_posix()


def line_at(text, offset):
    return text.count("\n", 0, offset) + 1


def evidence(file, line, **extra):
    return {"file": str(file), "line": line, **extra}


def read(path):
    return path.read_text(encoding="utf-8-sig")


def xml_local(tag):
    return tag.rsplit("}", 1)[-1]


def parse_bpmn():
    processes = []
    for path in sorted((ROOT / BPMN_DIR).glob("*")):
        if path.suffix.lower() not in {".bpmn", ".bpmnxml", ".xml"}:
            continue
        text = read(path)
        xml = ET.fromstring(text)
        source = rel(path)
        ids = {e.get("id"): e for e in xml.iter() if e.get("id")}
        def ev(element):
            match = re.search(r'\bid=["\']' + re.escape(element.get("id", "")) + r'["\']', text)
            return evidence(source, line_at(text, match.start()) if match else 1)
        for process in xml.findall("b:process", NS):
            actors = {}
            lanes = []
            for lane in process.findall(".//b:lane", NS):
                refs = [e.text for e in lane.findall("b:flowNodeRef", NS)]
                lanes.append({"id": lane.get("id"), "actor": lane.get("name"), "nodeIds": refs, "sourceEvidence": ev(lane)})
                actors.update({node: lane.get("name") for node in refs})
            flows = []
            for f in process.findall(".//b:sequenceFlow", NS):
                condition = f.find("b:conditionExpression", NS)
                flows.append({"id": f.get("id"), "source": f.get("sourceRef"), "target": f.get("targetRef"),
                              "condition": "".join(condition.itertext()).strip() if condition is not None else None,
                              "label": f.get("name"), "documentation": [e.text for e in f.findall("b:documentation", NS)],
                              "sourceEvidence": ev(f)})
            nodes = []
            # Incluye también artefactos con ID; no descarta annotations/data associations.
            for n in process.iter():
                typ = xml_local(n.tag)
                if n is process or not n.get("id") or typ in {"lane", "laneSet", "sequenceFlow"}:
                    continue
                nid = n.get("id")
                incoming = [f for f in flows if f["target"] == nid]
                outgoing = [f for f in flows if f["source"] == nid]
                handoff = re.findall(r'(?:→|->)\s*(P\d{2})', n.get("name", ""))
                nodes.append({"id": nid, "name": n.get("name"), "type": typ,
                              "actor": actors.get(nid), "tool": "EcoRoute", "actorInference": None,
                              "conditions": [{"flowId": f["id"], "label": f["label"], "expression": f["condition"], "documentation": f["documentation"]} for f in outgoing],
                              "entradas": [{"flowId": f["id"], "from": f["source"]} for f in incoming],
                              "salidas": [{"flowId": f["id"], "to": f["target"]} for f in outgoing],
                              "dataInputs": [e.attrib for e in n.iter() if xml_local(e.tag) in {"dataInput", "dataInputAssociation", "property"}],
                              "dataOutputs": [e.attrib for e in n.iter() if xml_local(e.tag) in {"dataOutput", "dataOutputAssociation"}],
                              "fin": typ == "endEvent", "handoff": [{"targetProcess": p, "basis": "explicit_end_label"} for p in handoff],
                              "activityBoundary": "external_communication" if typ in {"sendTask", "receiveTask"} else "human_decision" if typ in {"userTask", "manualTask"} else "bpmn_control_or_artifact",
                              "documentation": [e.text for e in n.findall("b:documentation", NS)],
                              "sourceEvidence": ev(n), "codeEvidence": [], "verification": "pending"})
            collaborations = []
            for e in xml.iter():
                if xml_local(e.tag) in {"participant", "messageFlow", "message", "association"} and e.get("id"):
                    collaborations.append({"type": xml_local(e.tag), **e.attrib, "sourceEvidence": ev(e)})
            processes.append({"id": re.search(r'P\d{2}', process.get("id")).group(), "bpmnProcessId": process.get("id"),
                              "name": process.get("name"), "source": source, "lanes": lanes,
                              "documentation": [e.text for e in process.findall("b:documentation", NS)],
                              "nodes": nodes, "sequenceFlows": flows, "collaboration": collaborations,
                              "verification": "pending"})
    return processes


def masked(text):
    """Conserva offsets/newlines; elimina comentarios y literales para contar llaves."""
    return re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`',
                  lambda m: re.sub(r'[^\n]', ' ', m.group()), text)


def block_end(clean, start):
    depth = 0
    for i in range(start, len(clean)):
        if clean[i] == "{":
            depth += 1
        elif clean[i] == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    return len(clean)


JAVA_METHOD = re.compile(r'\b(?:public|private|protected)\s+(?:(?:static|final|synchronized|default)\s+)*(?:[\w.$<>?,\[\]]+\s+)+(?P<name>\w+)\s*\([^;{}]*\)\s*(?:throws\s+[\w., ]+)?(?P<end>[{;])')
JAVA_INTERFACE_METHOD = re.compile(r'^\s*(?:[\w.$<>?,\[\]]+\s+)+(?P<name>\w+)\s*\([^;{}]*\)\s*(?P<end>;)', re.M)
DART_METHOD = re.compile(r'^\s*(?:static\s+)?(?:Future<[\w<>?, ]+>|Stream<[\w<>?, ]+>|void|Widget|bool|String|int|double|List<[\w<>?, ]+>)\s+(?P<name>\w+)\s*\(', re.M)
JS_METHOD = re.compile(r'\b(?:const|let|function)\s+(?P<name>\w+)\s*(?:=\s*(?:async\s*)?(?:\([^;]*?\)|\w+)\s*(?::[^=;]+)?\s*=>|\([^;]*?\)\s*(?::[^{}]+)?\{)')


def scan_sources():
    paths = set()
    for folder in ("src", "web-admin/src", "web-admin/test", "web-admin/tests", "web-admin/e2e", "mobile-app/lib", "mobile-app/test", "mobile-app/integration_test"):
        for p in (ROOT / folder).rglob("*"):
            if p.is_file() and p.suffix in EXTENSIONS and not (set(p.relative_to(ROOT).parts) & IGNORED):
                paths.add(p)
    sources = {}
    for path in sorted(paths):
        raw = path.read_bytes()
        text = raw.decode("utf-8-sig")
        sources[rel(path)] = {"text": text, "clean": masked(text), "sha256": hashlib.sha256(raw).hexdigest(), "mtime": path.stat().st_mtime_ns}
    return sources


def scan_methods(sources):
    methods = []
    for file, data in sources.items():
        text, clean = data["text"], data["clean"]
        java = file.endswith(".java")
        regexes = [JAVA_METHOD] if java else [DART_METHOD] if file.endswith(".dart") else [JS_METHOD]
        if java and re.search(r'\binterface\s+\w+', clean):
            regexes.append(JAVA_INTERFACE_METHOD)
        seen = set()
        for regex in regexes:
            for match in regex.finditer(clean):
                name = match.group("name")
                line = line_at(text, match.start("name"))
                if (name, line) in seen:
                    continue
                seen.add((name, line))
                start = clean.find("{", match.end() - 1)
                declaration = java and match.group("end") == ";"
                end = match.end() if declaration or start < 0 else block_end(clean, start)
                methods.append({"id": f"{file}#{name}:{line}", "file": file, "name": name, "line": line,
                                "endLine": line_at(text, end), "declarationOnly": declaration,
                                "codeEvidence": [evidence(file, line)], "verification": "pending",
                                "_start": match.start(), "_end": end, "_body": text[match.start():end]})
    return methods


def import_graph(sources):
    graph = defaultdict(list)
    for file, data in sources.items():
        # Solo imports explícitos; nunca sigue node_modules ni evalúa módulos.
        for m in re.finditer(r'(?:from\s*|import\s*)["\']([^"\']+)["\']|import\s+([\w.]+)\s*;', data["text"]):
            spec = m.group(1) or m.group(2)
            candidates = []
            if spec.startswith("."):
                base = (ROOT / file).parent / spec
                try:
                    target = base.resolve().relative_to(ROOT).as_posix()
                    candidates = [target] + [target + s for s in (".ts", ".tsx", ".js", ".jsx", ".dart")] + [target + "/index.ts", target + "/index.tsx"]
                except ValueError:
                    pass
            elif spec.startswith("com.ecoroute."):
                candidates = ["src/main/java/" + spec.replace(".", "/") + ".java"]
            elif spec.startswith("package:") and spec.endswith(".dart"):
                candidates = ["mobile-app/lib/" + spec.split("/", 1)[1]] if "/" in spec else []
            for target in candidates:
                if target in sources and target != file:
                    graph[file].append({"target": target, "basis": "explicit_import", "codeEvidence": [evidence(file, line_at(data["text"], m.start()))]})
        if file.endswith(".java"):
            # Java permite referenciar entidades del mismo paquete sin import.
            for target in sources:
                if target == file or not target.endswith(".java") or Path(target).parent != Path(file).parent:
                    continue
                match = re.search(r'\b' + re.escape(Path(target).stem) + r'\b', data["clean"])
                if match:
                    graph[file].append({"target": target, "basis": "same_package_type_reference_candidate", "codeEvidence": [evidence(file, line_at(data["text"], match.start()))]})
    return graph


def scan_endpoints(sources, methods):
    endpoints = []
    for file, data in sources.items():
        if not file.endswith("Controller.java"):
            continue
        text = data["text"]
        base = re.search(r'@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["\']([^"\']+)', text)
        prefix = base.group(1) if base else ""
        for match in re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping\b(?:\s*\(([^\n]*?)\))?', text):
            args = match.group(2) or ""
            suffix = re.search(r'"([^"]*)"', args)
            path = prefix + (suffix.group(1) if suffix else "")
            meth = next((m for m in methods if m["file"] == file and m["_start"] > match.end()), None)
            # Annotation must immediately precede method, not another handler.
            if meth is None:
                continue
            between = text[match.end():meth["_start"]]
            if re.search(r'@(?:Get|Post|Put|Patch|Delete)Mapping', between):
                continue
            endpoints.append({"id": f"{match.group(1).upper()} {path}", "verb": match.group(1).upper(), "path": path,
                              "methodId": meth["id"], "codeEvidence": [evidence(file, line_at(text, match.start())), evidence(file, meth["line"], symbol=meth["name"])],
                              "authorization": "pending; consultar SecurityConfig y OperationalAccess", "verification": "pending"})
    # URL de HandlerMapping de WebSocket: no inventar un @GetMapping para el canal.
    for file, data in sources.items():
        if not file.endswith(".java"):
            continue
        for match in re.finditer(r'Map\.of\(\s*"(/ws/[^\"]+)"\s*,\s*(\w+)\s*\)', data["text"]):
            binding = re.search(r'\b(\w+WebSocketHandler)\s+' + re.escape(match.group(2)) + r'\b', data["text"])
            handler = next((m for m in methods if binding and Path(m["file"]).stem == binding.group(1) and m["name"] == "handle"), None)
            if handler:
                endpoints.append({"id": "WS " + match.group(1), "verb": "WS", "path": match.group(1), "methodId": handler["id"],
                                  "codeEvidence": [evidence(file, line_at(data["text"], match.start()))] + handler["codeEvidence"],
                                  "authorization": "pending; handler autentica primer frame y valida suscripción; probar expiración y propiedad", "verification": "pending"})
    return endpoints


def normalize_path(path):
    # Normaliza interpolaciones completas antes de separar query; una ternaria
    # que agrega ?fromLat no es una nueva parte del path del endpoint.
    pieces = []
    i = 0
    while i < len(path):
        if path.startswith("${", i):
            start = i + 2
            depth = 1
            end = start
            while end < len(path) and depth:
                if path[end] == "{":
                    depth += 1
                elif path[end] == "}":
                    depth -= 1
                end += 1
            expr = path[start:end-1]
            pieces.append("" if "?" in expr and "?" in expr.split("?", 1)[-1] else "{}")
            i = end
        else:
            pieces.append(path[i])
            i += 1
    path = "".join(pieces).split("?", 1)[0]
    path = re.sub(r'\{[^}]+\}|\$\w+', '{}', path)
    return path.rstrip("/") or "/"


def literal_value(text, start):
    """Lee literal completo, incluidas plantillas anidadas dentro de ${...}."""
    delimiter = text[start]
    i = start + 1
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == delimiter:
            return text[start+1:i], i + 1
        if delimiter == "`" and text.startswith("${", i):
            i += 2
            depth = 1
            while i < len(text) and depth:
                if text[i] in "\"'`":
                    _, i = literal_value(text, i)
                    continue
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                i += 1
            continue
        i += 1
    return text[start+1:], len(text)


def scan_client_calls(sources, methods, endpoints):
    calls = []
    for file, data in sources.items():
        if not file.startswith(("web-admin/", "mobile-app/")):
            continue
        text = data["text"]
        regex = r'\b(?:api|client|dio|_dio|_client)\.(get|post|put|patch|delete)(?:<[^;\n]*?>)?\s*\(\s*([\x27"`])([^\n]*?)\2'
        for match in re.finditer(regex, text):
            path, _ = literal_value(text, match.start(2))
            if not path.startswith("/"):
                continue
            owners = [m for m in methods if m["file"] == file and m["_start"] <= match.start() < m["_end"]]
            owner = min(owners, key=lambda m: m["_end"]-m["_start"]) if owners else None
            expressions = [path]
            union_evidence = []
            if owner:
                for variable in re.findall(r'\$\{(\w+)\}', path):
                    union = re.search(r'\b' + re.escape(variable) + r'\s*:\s*((?:["\'][^"\']+["\']\s*\|\s*)+["\'][^"\']+["\'])', owner["_body"])
                    if union:
                        values = re.findall(r'["\']([^"\']+)["\']', union.group(1))
                        expressions = [p.replace("${" + variable + "}", value) for p in expressions for value in values]
                        union_evidence.append(evidence(file, owner["line"] + line_at(owner["_body"], union.start()) - 1, basis="finite_literal_union_type_candidate"))
            candidates = sorted({e["id"] for e in endpoints if e["verb"] == match.group(1).upper() and any(normalize_path(e["path"]) == normalize_path(p) for p in expressions)})
            calls.append({"file": file, "methodId": owner["id"] if owner else None, "verb": match.group(1).upper(),
                          "pathExpression": path, "expandedPathCandidates": expressions, "endpointIds": candidates, "basis": "verb_and_normalized_path; finite_literal_union_when_declared; params/contrato no comprobados",
                          "codeEvidence": [evidence(file, line_at(text, match.start()))] + union_evidence, "verification": "pending"})
        # Hook inspeccionado: useQuery realiza api.get(url). Vincula URL del llamador
        # solo si el archivo importa explícitamente ese hook local.
        hook_import = re.search(r'from\s*["\']([^"\']*/hooks/useQuery)["\']', text)
        if hook_import:
            for match in re.finditer(r'\buseQuery(?:<[^\n;]*?>)?\s*\(\s*(?:[^;\n]*?\?\s*)?([\x27"`])(/[^\n]*?)\1', text):
                path, _ = literal_value(text, match.start(1))
                if not path.startswith("/"):
                    continue
                hook_file = "web-admin/src/hooks/useQuery.ts"
                if hook_file not in sources:
                    continue
                http = re.search(r'\bapi\.get(?:<[^>]*>)?\s*\(\s*url\b', sources[hook_file]["text"])
                if not http:
                    continue
                calls.append({"file": file, "methodId": None, "verb": "GET", "pathExpression": path,
                              "endpointIds": [e["id"] for e in endpoints if e["verb"] == "GET" and normalize_path(e["path"]) == normalize_path(path)],
                              "basis": "literal_useQuery_argument_and_inspected_hook_get; params_pending",
                              "codeEvidence": [evidence(file, line_at(text, match.start())), evidence(hook_file, line_at(sources[hook_file]["text"], http.start()))], "verification": "pending"})
        for match in re.finditer(r'new\s+WebSocket\s*\(\s*([\x27"`])', text):
            literal, _ = literal_value(text, match.start(1))
            suffix = re.search(r'(/ws/[\w/-]+)', literal)
            if suffix:
                path = suffix.group(1)
                calls.append({"file": file, "methodId": None, "verb": "WS", "pathExpression": literal,
                              "endpointIds": [e["id"] for e in endpoints if e["verb"] == "WS" and e["path"] == path],
                              "basis": "literal_websocket_path_suffix; handshake/frame_auth_pending", "codeEvidence": [evidence(file, line_at(text, match.start()))], "verification": "pending"})
    return calls


def backend_graph(sources, methods):
    classes = defaultdict(list)
    implementations = defaultdict(list)
    fields = defaultdict(dict)
    for file, data in sources.items():
        if not file.endswith(".java") or "/test/" in file:
            continue
        for m in re.finditer(r'\b(?:class|interface|record)\s+(\w+)', data["clean"]):
            classes[m.group(1)].append(file)
        for m in re.finditer(r'\bimplements\s+([\w,\s]+?)(?:\{|\bextends\b)', data["clean"]):
            for interface in re.findall(r'\b\w+\b', m.group(1)):
                implementations[interface].append(file)
        for m in re.finditer(r'\b(?:private|protected|public)\s+(?:final\s+|static\s+)*(\w+)(?:<[^;=]+>)?\s+(\w+)\s*[;=]', data["clean"]):
            fields[file][m.group(2)] = m.group(1)
    index = defaultdict(list)
    for m in methods:
        index[m["file"], m["name"]].append(m)
    edges = defaultdict(list)
    for m in methods:
        if not m["file"].endswith(".java") or m["declarationOnly"]:
            continue
        body = masked(m["_body"])
        for call in re.finditer(r'\b(\w+)\s*(?:\.\s*(\w+)\s*\(|::\s*(\w+))', body):
            receiver, name = call.group(1), call.group(2) or call.group(3)
            typ = fields[m["file"]].get(receiver, receiver)
            targets = classes.get(typ, []) + implementations.get(typ, [])
            for file in sorted(set(targets)):
                for dest in index.get((file, name), []):
                    edges[m["id"]].append({"targetMethodId": dest["id"], "basis": "receiver_type_and_method_name; overload/DI_runtime_pending",
                                            "codeEvidence": [evidence(m["file"], m["line"] + line_at(m["_body"], call.start()) - 1)]})
        for call in re.finditer(r'(?<![\w.])([a-zA-Z_]\w*)\s*\(', body):
            for dest in index.get((m["file"], call.group(1)), []):
                if dest["id"] != m["id"]:
                    edges[m["id"]].append({"targetMethodId": dest["id"], "basis": "same_file_method_name; overload_pending", "codeEvidence": dest["codeEvidence"]})
    return edges


def reachable(start, graph, target_key="target", limit=400):
    found = {start: []}
    queue = deque([start])
    while queue and len(found) < limit:
        item = queue.popleft()
        for edge in graph.get(item, []):
            dest = edge[target_key]
            if dest not in found:
                found[dest] = found[item] + [{"from": item, **edge}]
                queue.append(dest)
    return found


def scan_tables(sources):
    tables = defaultdict(list)
    changes = defaultdict(list)
    for file, data in sources.items():
        if not file.endswith(".sql"):
            continue
        for match in re.finditer(r'\bCREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)', data["text"], re.I):
            tables[match.group(2).lower()].append({"type": match.group(1).lower(), "codeEvidence": [evidence(file, line_at(data["text"], match.start()))]})
        for match in re.finditer(r'\bALTER\s+TABLE\s+([\w.]+)', data["text"], re.I):
            changes[match.group(1).lower()].append({"kind": "alter_table", "codeEvidence": [evidence(file, line_at(data["text"], match.start()))]})
    return [{"name": name, "declarations": values, "schemaChanges": changes.get(name, []), "verification": "pending", "databaseExistence": "not_checked"} for name, values in sorted(tables.items())]


def read_technical_evidence():
    path = ROOT / "docs/correccion_integral/evidencias/regresion_api.json"
    if not path.exists():
        return []
    text = read(path)
    data = json.loads(text)
    tests = []
    for test in data.get("tests", []):
        tid = test.get("id")
        location = re.search(r'"id"\s*:\s*"' + re.escape(str(tid)) + '"', text)
        tests.append({"id": "API:" + str(tid), "sourceTestId": tid, "name": test.get("name"),
                      "processIds": re.findall(r'P\d{2}', str(test.get("process", ""))),
                      "reportedResult": test.get("result"), "verification": "pending",
                      "sourceEvidence": evidence(rel(path), line_at(text, location.start()) if location else 1)})
    counted = dict(Counter(t["reportedResult"] for t in tests))
    return [{"id": "regresion_api", "file": rel(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
             "executedAtReported": data.get("executedAt"), "timezoneReported": data.get("timezone"), "environmentReported": data.get("environment"),
             "reportedSummary": data.get("summary"), "countedResults": counted, "tests": tests,
             "executionByThisGenerator": False, "evidenceKind": "provided_api_regression_report", "verification": "pending",
             "scopeLimit": "Resultados API declarados por informe local; no ejecutado aquí. No prueba recorrido UI, offline/reinicio ni aceptación humana. Fuente no fija revisión/hash de todo el código probado.",
             "humanValidationMICOTRANS": "pending"}]


STATE_PATTERNS = {
    "formularios": r'<form\b|TextFormField\b|Form\s*\(|validator\s*:|TextField\s*\(',
    "modal": r'\b\w*Modal\w*\b|showDialog\s*\(|showModalBottomSheet\s*\(|role=["\']dialog|<(?:Modal|Dialog)\b',
    "camera": r'ImageSource\.camera|pickImage\s*\(|CameraController|capture=["\']',
    "POD": r'\b(?:proofPhoto|createDeliveryProof|signatureBase64|signatureDataUrl|receiverDni|SignaturePad)\b',
    "errores": r'\b(?:alert|showSnackBar)\s*\(|\b\w*(?:Error|Failure)\b|\bcatch\s*\(|role=["\']alert|<SourceState\b|\bsync\.error\b',
    "offline": r'\boffline\b|\b(?:LocalCache|cachePendingProof|getPendingProofs|connectivity|Connectivity)\b',
    "reconexion": r'\b(?:retry|reconnect|syncPending|syncOutbox|flushPending)\w*\b|onclose|onConnectivityChanged',
    "vacios": r'\.isEmpty\b|\.length\s*===?\s*0|[Nn]o hay|[Ss]in (?:pedidos|rutas|datos|resultados)',
    "loading": r'CircularProgressIndicator|LinearProgressIndicator|\b(?:loading|isLoading|Loader2|\w*Loading)\b|<SourceState\b',
    "filtros": r'\b\w*(?:Filter|filter|searchTerm|Search)\w*\b',
    "export": r'\b\w*(?:Export|export|Download|download)\w*\b|text/csv',
    "GPS": r'\b(?:Geolocator|GpsBloc|gpsHistory|connectGpsWebSocket|latitude)\b',
    "reinicio_persistencia": r'FlutterSecureStorage|localStorage|SharedPreferences|\b_storage\.(?:write|read)',
}


def scan_screens(sources, methods, imports, clients):
    screens = []
    # Detecta cada unidad TSX/JSX, incluidas pantallas futuras fuera de pages.
    for file, data in sources.items():
        web = file.startswith("web-admin/src/") and file.endswith((".tsx", ".jsx"))
        mobile = file.startswith("mobile-app/lib/") and ("/pages/" in file or re.search(r'\bextends\s+(?:StatefulWidget|StatelessWidget)', data["clean"]))
        if not (web or mobile):
            continue
        text = data["text"]
        deps = reachable(file, imports)
        states = {}
        for name, pattern in STATE_PATTERNS.items():
            direct = [evidence(file, line_at(text, m.start())) for m in re.finditer(pattern, text, re.I if name == "offline" else 0)]
            supporting = []
            for dep in deps:
                if dep == file:
                    continue
                hits = list(re.finditer(pattern, sources[dep]["text"], re.I if name == "offline" else 0))
                supporting.extend(evidence(dep, line_at(sources[dep]["text"], m.start()), relation="import_dependency_candidate") for m in hits)
            states[name] = {"mapping": "mapped" if direct else "planned", "verification": "pending", "codeEvidence": direct,
                            "dependencyEvidence": supporting, "interpretation": "Coincidencia textual; no acredita que la UI permita completar el escenario."}
        controls = []
        for pattern, kind in [(r'\bconst\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useState', "react_state"),
                              (r'\bclass\s+(\w+)\s+extends\s+(\w*State)\b', "bloc_state"),
                              (r'\b(\w+)\s*=\s*TextEditingController\s*\(', "form_controller")]:
            for match in re.finditer(pattern, text):
                controls.append({"name": match.group(1), "kind": kind, "codeEvidence": [evidence(file, line_at(text, match.start()))]})
        bloc_files = [p for p in deps if p.endswith("_state.dart")]
        for dep in bloc_files:
            for match in re.finditer(r'\bclass\s+(\w+)\s+extends\s+(\w+)', sources[dep]["text"]):
                controls.append({"name": match.group(1), "kind": "bloc_state_dependency", "codeEvidence": [evidence(dep, line_at(sources[dep]["text"], match.start()))]})
        fields = [{"kind": "web_input", "markup": m.group()[:400], "codeEvidence": [evidence(file, line_at(text, m.start()))]} for m in re.finditer(r'<(?:input|select|textarea)\b[^>]*>', text)]
        fields += [{"kind": "flutter_field", "codeEvidence": [evidence(file, line_at(text, m.start()))]} for m in re.finditer(r'\b(?:TextFormField|TextField|DropdownButtonFormField)\s*\(', text)]
        calls = [{**c, "screenRelation": "direct_call" if c["file"] == file else "import_dependency_candidate", "importPath": deps[c["file"]]} for c in clients if c["file"] in deps]
        component_symbols = [{"name": m.group(1), "codeEvidence": [evidence(file, line_at(text, m.start()))]} for m in re.finditer(r'\b(?:function|class|const)\s+([A-Z]\w+)', data["clean"])]
        screens.append({"id": file, "name": Path(file).stem, "componentSymbols": component_symbols, "framework": "React" if web else "Flutter", "kind": "page" if "/pages/" in file else "component_or_shell",
                        "routes": [], "actors": [], "actorMapping": "pending", "states": states, "stateVariables": controls,
                        "formFields": fields, "methodIds": [m["id"] for m in methods if m["file"] == file], "apiCalls": calls,
                        "codeEvidence": [evidence(file, 1)], "verification": "pending"})
    return screens


def jsx_route_tags(text):
    """Consume > externo, no el /> de element={<ProtectedRoute ... />}."""
    for match in re.finditer(r'</?Route\b', text):
        braces = 0
        quote = None
        i = match.end()
        while i < len(text):
            char = text[i]
            if quote:
                if char == "\\":
                    i += 2
                    continue
                if char == quote:
                    quote = None
            elif char in "\"'`":
                quote = char
            elif char == "{":
                braces += 1
            elif char == "}":
                braces -= 1
            elif char == ">" and braces == 0:
                yield match.start(), text[match.start():i+1]
                break
            i += 1


def route_inventory(sources, screens):
    routes = []
    by_name = {s["name"]: s for s in screens}
    for file, data in sources.items():
        text = data["text"]
        if file.endswith((".tsx", ".jsx")):
            aliases = {m.group(1): Path(m.group(2)).stem for m in re.finditer(r'import\s+(\w+)\s+from\s+["\']([^"\']+)["\']', text)}
            role_stack = []
            for offset, tag in jsx_route_tags(text):
                if tag.startswith("</"):
                    if role_stack:
                        role_stack.pop()
                    continue
                explicit_roles = re.findall(r"['\"](ADMIN|DISPATCHER|DRIVER)['\"]", tag)
                inherited = explicit_roles or (role_stack[-1] if role_stack else [])
                path = re.search(r'\bpath=["\']([^"\']+)', tag)
                component = re.search(r'element=\{\s*<(\w+)', tag)
                if path and component:
                    name = aliases.get(component.group(1), component.group(1))
                    routes.append({"framework": "React", "path": path.group(1), "component": component.group(1), "screenId": by_name.get(name, {}).get("id"), "rolesInRoute": inherited, "actorInference": "route_guard_only; backend_pending", "codeEvidence": [evidence(file, line_at(text, offset))]})
                if not tag.endswith("/>"):
                    role_stack.append(inherited)
        if file.endswith(".dart"):
            for m in re.finditer(r'GoRoute\s*\(', text):
                # Acota por el siguiente GoRoute; los builders pueden contener llaves.
                end = text.find("GoRoute(", m.end())
                block = text[m.start():end if end >= 0 else len(text)]
                path = re.search(r'path:\s*["\']([^"\']+)', block)
                widget = re.search(r'(?:=>|return)\s*(?:const\s+)?(\w+Page)\s*\(', block)
                target = next((s for s in screens if widget and re.search(r'\bclass\s+' + widget.group(1) + r'\b', sources[s["id"]]["text"])), None)
                if path:
                    routes.append({"framework": "Flutter", "path": path.group(1), "component": widget.group(1) if widget else None, "screenId": target["id"] if target else None, "rolesInRoute": [], "actorInference": "Conductor esperado; guard GoRouter no demuestra propiedad", "codeEvidence": [evidence(file, line_at(text, m.start()))]})
    role_names = {"ADMIN": "Administrador", "DISPATCHER": "Dispatcher", "DRIVER": "Conductor"}
    for s in screens:
        s["routes"] = [r for r in routes if r["screenId"] == s["id"]]
        roles = set(role for r in s["routes"] for role in r["rolesInRoute"])
        s["actors"] = [role_names[r] for r in sorted(roles)]
        if s["framework"] == "Flutter":
            s["actors"] = ["Conductor"]
        elif not s["actors"] and s["routes"]:
            s["actors"] = ["Usuario autenticado (rol pendiente de verificar)"]
        s["actorMapping"] = "manual_expected" if s["framework"] == "Flutter" else "route_guard_static"
    return routes


def scan_tests(sources):
    tests = []
    for file, data in sources.items():
        if not ("/test/" in file or "/tests/" in file or "/integration_test/" in file or re.search(r'\.(test|spec)\.[jt]sx?$', file)):
            continue
        text = data["text"]
        patterns = [r'@(?:Test|ParameterizedTest)(?:\s*\([^)]*\))?\s*(?:@\w+(?:\([^)]*\))?\s*)*(?:(?:public|protected)\s+)?void\s+(\w+)\s*\(',
                    r'\b(?:testWidgets|test|it)\s*\(\s*["\']([^"\']+)["\']']
        for pat in patterns:
            for m in re.finditer(pat, text):
                tests.append({"id": f"{file}::{m.group(1)}", "name": m.group(1), "file": file,
                              "codeEvidence": [evidence(file, line_at(text, m.start()))], "execution": "not_run_by_this_generator", "verification": "pending"})
    return tests


def build_inventory():
    manual = json.loads(read(HERE / "trace_manual.json"))
    req_text = read(ROOT / REQUIREMENTS)
    requirements = json.loads(req_text)["requirements"]
    processes = parse_bpmn()
    sources = scan_sources()
    methods = scan_methods(sources)
    imports = import_graph(sources)
    endpoints = scan_endpoints(sources, methods)
    clients = scan_client_calls(sources, methods, endpoints)
    graph = backend_graph(sources, methods)
    tables = scan_tables(sources)
    screens = scan_screens(sources, methods, imports, clients)
    routes = route_inventory(sources, screens)
    tests = scan_tests(sources)
    technical_evidence = read_technical_evidence()
    by_method = {m["id"]: m for m in methods}
    known_tables = {t["name"] for t in tables}
    gaps = []
    for e in endpoints:
        reached = reachable(e["methodId"], graph, "targetMethodId")
        e["useCases"] = [{"methodId": mid, "codeEvidence": by_method[mid]["codeEvidence"], "callPath": path} for mid, path in reached.items() if "/application/usecases/" in by_method[mid]["file"] or "/domain/ports/in/" in by_method[mid]["file"]]
        e["applicationServices"] = [{"methodId": mid, "codeEvidence": by_method[mid]["codeEvidence"], "callPath": path} for mid, path in reached.items() if "/application/services/" in by_method[mid]["file"]]
        e["calledMethods"] = list(reached)
        e["tables"] = []
        # SQL en método alcanzable = evidencia directa; @Table por importación = candidato.
        for mid, path in reached.items():
            method = by_method[mid]
            for match in re.finditer(r'\b(?:FROM|JOIN|INTO|UPDATE)\s+([\w.]+)', method["_body"], re.I):
                name = match.group(1).lower()
                if name in known_tables:
                    e["tables"].append({"name": name, "basis": "sql_text_in_reachable_method", "methodId": mid, "callPath": path, "codeEvidence": [evidence(method["file"], method["line"] + line_at(method["_body"], match.start()) - 1)]})
            for dep, dep_path in reachable(method["file"], imports).items():
                for match in re.finditer(r'@Table\s*\(\s*(?:value\s*=\s*)?"([^"]+)"', sources[dep]["text"]):
                    name = match.group(1)
                    if not any(t["name"] == name and t["basis"] == "entity_import_candidate" for t in e["tables"]):
                        e["tables"].append({"name": name, "basis": "entity_import_candidate", "viaMethodId": mid, "importPath": dep_path, "codeEvidence": [evidence(dep, line_at(sources[dep]["text"], match.start()))]})
        e["testIDs"] = []
        for test in tests:
            # Asociación por clase explícita, no por parecido de nombres de prueba.
            tt = sources[test["file"]]["text"]
            classes = {Path(by_method[mid]["file"]).stem for mid in reached}
            if any(re.search(r'\b' + re.escape(cls) + r'\b', tt) for cls in classes):
                e["testIDs"].append({"id": test["id"], "basis": "test_file_mentions_reachable_class; assertion_scope_pending"})
        if not e["useCases"] and not e["applicationServices"] and e["verb"] != "WS":
            gaps.append({"kind": "endpoint_without_usecase_link", "endpointId": e["id"], "reason": "Handler puede usar repositorio/servicio directamente o no ser resuelto por analizador léxico.", "verification": "pending"})
    endpoint_index = {e["id"]: e for e in endpoints}
    traces = []
    for process in processes:
        config = manual["processes"].get(process["id"], {"requirements": [], "findings": [], "manualReason": "Proceso nuevo pendiente de inspección editorial."})
        for node in process["nodes"]:
            capabilities = [c for c in manual["capabilities"] if node["id"] in c["nodes"]]
            links = []
            for capability in capabilities:
                selected = [e for e in endpoints if e["id"] in capability.get("endpoints", []) or any(e["path"] == prefix or e["path"].startswith(prefix + "/") for prefix in capability.get("endpointPrefixes", []))]
                selected_screens = [s for s in screens if s["name"] in capability["screens"]]
                for e in selected:
                    ui = [{"screenId": s["id"], "calls": [c for c in s["apiCalls"] if e["id"] in c["endpointIds"]]} for s in selected_screens]
                    connected = [s for s in ui if s["calls"]]
                    links.append({"capability": capability["id"], "mapping": "mapped", "basis": "manual_task_association_plus_static_code", "reason": capability["reason"],
                                  "partialBusinessSupport": capability["partial"], "screens": connected, "unconnectedScreenCandidates": [s["screenId"] for s in ui if not s["calls"]],
                                  "endpointId": e["id"], "methodId": e["methodId"], "useCases": e["useCases"], "applicationServices": e["applicationServices"], "tables": e["tables"], "testIDs": e["testIDs"],
                                  "codeEvidence": e["codeEvidence"], "verification": "pending"})
                    if not connected:
                        gaps.append({"kind": "endpoint_without_screen_call", "nodeId": node["id"], "endpointId": e["id"], "screenCandidates": capability["screens"], "verification": "pending"})
                for selector in capability.get("endpoints", []):
                    if selector not in endpoint_index:
                        gaps.append({"kind": "manual_selector_not_found", "nodeId": node["id"], "selector": selector, "mapping": "planned", "verification": "pending"})
            node_type = node["type"]
            mapping = "external" if node_type in {"sendTask", "receiveTask"} else "mapped" if links else "planned" if capabilities else "manual" if node_type in {"userTask", "manualTask", "task"} else "planned"
            node["mapping"] = mapping
            node["mappingReason"] = "; ".join(c["reason"] for c in capabilities) if capabilities else config["manualReason"] if mapping in {"manual", "external"} else "Nodo de control/artefacto del BPMN: sus ramas son especificación; no hay evidencia de ejecución asociada."
            node["codeEvidence"] = [ev for link in links for ev in link["codeEvidence"]]
            traces.append({"id": node["id"], "processId": process["id"], "nodeId": node["id"], "actor": node["actor"], "mapping": mapping,
                           "requirements": config["requirements"], "requirementsBasis": "manual_process_scope; no certifica cobertura individual de cada RF/RNF",
                           "findings": config["findings"], "links": links, "verification": "pending", "humanValidationMICOTRANS": "pending"})
            if capabilities and not links:
                gaps.append({"kind": "capability_without_resolved_endpoint", "nodeId": node["id"], "capabilities": [c["id"] for c in capabilities], "mapping": "planned", "verification": "pending"})
            if mapping in {"manual", "external"}:
                gaps.append({"kind": "external_communication_not_verified" if links else "business_activity_without_code_link", "nodeId": node["id"], "mapping": mapping, "reason": node["mappingReason"], "verification": "pending"})
    for r in requirements:
        r["traceNodeIds"] = [t["nodeId"] for t in traces if r["id"] in t["requirements"]]
        r["mapping"] = "manual" if r["traceNodeIds"] else "planned"
        r["verification"] = "pending"
        hit = re.search(r'"id"\s*:\s*"' + re.escape(r["id"]) + '"', req_text)
        r["sourceEvidence"] = evidence(REQUIREMENTS.as_posix(), line_at(req_text, hit.start()) if hit else 1)
        if not r["traceNodeIds"]:
            gaps.append({"kind": "requirement_without_process_assignment", "requirementId": r["id"], "verification": "pending"})
    uat_path = ROOT / "docs/correccion_integral/Plan_Pruebas_Usuario.md"
    uat = []
    if uat_path.exists():
        for match in re.finditer(r'^### (UAT\d{3})[^\n]*\n([\s\S]*?)(?=^### UAT\d{3}|\Z)', read(uat_path), re.M):
            body = match.group(2)
            uat.append({"id": match.group(1), **parse_uat_relation(body), "associationBasis": "explicit_relation_line_not_incidental_body_mentions", "execution": "no ejecutado", "verification": "pending", "humanValidationMICOTRANS": "pending"})
    for trace in traces:
        trace["testIDs"] = [u["id"] for u in uat if trace["nodeId"] in u["nodeIds"]]
        trace["uatRequirementIds"] = sorted({r for u in uat if trace["nodeId"] in u["nodeIds"] for r in u["requirements"]})
        trace["technicalTestIDs"] = [test["id"] for suite in technical_evidence for test in suite["tests"] if trace["processId"] in test["processIds"]]
        trace["technicalTestAssociationBasis"] = "reported_process_scope; no acredita aserción por nodo ni UAT"
    for screen in screens:
        screen["businessActorsByTrace"] = sorted({t["actor"] for t in traces if t["actor"] and any(any(s["screenId"] == screen["id"] for s in link["screens"]) for link in t["links"])})
        screen["businessActorBasis"] = "manual_bpmn_association; no acredita permiso técnico"
    for r in requirements:
        r["uatTestIDs"] = [u["id"] for u in uat if r["id"] in u["requirements"]]
    for call in clients:
        if not call["endpointIds"]:
            gaps.append({"kind": "client_call_without_controller_match", "file": call["file"], "verb": call["verb"], "pathExpression": call["pathExpression"], "codeEvidence": call["codeEvidence"], "verification": "pending"})
    contracts = []
    for contract_path in (HERE / "analytics_api_contract.json",):
        if contract_path.exists():
            contracts.append({"file": rel(contract_path), "content": json.loads(read(contract_path)), "verification": "pending", "basis": "implementation_contract_not_execution_evidence"})
    changed = [file for file, data in sources.items() if not (ROOT/file).exists() or (ROOT/file).stat().st_mtime_ns != data["mtime"]]
    snapshots = [{"file": file, "sha256": d["sha256"], "lines": len(d["text"].splitlines())} for file, d in sources.items()]
    input_paths = [ROOT/REQUIREMENTS, HERE/"trace_manual.json", Path(__file__).resolve()]
    input_paths.extend(sorted((ROOT/BPMN_DIR).glob("*.bpmn")))
    input_paths.extend(p for p in (uat_path, HERE/"analytics_api_contract.json") if p.exists())
    input_paths.extend(ROOT/suite["file"] for suite in technical_evidence)
    input_snapshots = [{"file": rel(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in input_paths]
    return {
        "schemaVersion": "1.0", "generatedAt": datetime.now(timezone.utc).isoformat(), "verification": "pending",
        "generator": "tools/audit_e2e/trace_inventory.py", "manualRules": "tools/audit_e2e/trace_manual.json",
        "policy": {"mapped": "Vínculo estático localizado, no implementación aceptada.", "manual": "Asociación editorial o actividad humana, sin ejecución acreditada.", "external": "Intercambio comercial o proveedor externo al flujo técnico.", "planned": "Sin evidencia resoluble; también nodos de control sin prueba asociada.", "actors": "Personas de negocio; EcoRoute es herramienta. Jefatura no se convierte automáticamente en ADMIN.", "productionAccess": "none", "testsRun": False, "humanValidationMICOTRANS": "pending"},
        "analysisLimits": ["Analizador léxico conservador, no AST/compilador ni prueba dinámica.", "Importación y coincidencia de clase en test son candidatos, no llamada o aserción demostrada.", "Resolución de método por tipo/nombre; sobrecargas, proxies y selección de bean pendientes.", "Tablas declaradas en SQL no equivalen a esquema instalado; entradas/salidas BPMN son flujos, datos de negocio solo si declarados.", "Patrones UI incluyen comentarios/literales para su inspección: un match no demuestra visibilidad, validación o persistencia.", "Nuevas fuentes se escanean automáticamente; nuevos vínculos de negocio requieren inspección de reglas manuales."],
        "snapshot": {"files": snapshots, "documentationInputs": input_snapshots, "changedDuringScan": changed, "consistent": not changed},
        "summary": {"processes": len(processes), "bpmnNodes": sum(len(p["nodes"]) for p in processes), "requirements": len(requirements), "RF": sum(r["id"].startswith("RF-") for r in requirements), "RNF": sum(r["id"].startswith("RNF-") for r in requirements), "screensAndComponents": len(screens), "routes": len(routes), "methods": len(methods), "endpoints": len(endpoints), "clientCalls": len(clients), "tablesAndViewsDeclared": len(tables), "automatedTestsLocated": len(tests), "uatCases": len(uat), "nodeMappings": dict(Counter(t["mapping"] for t in traces)), "gaps": dict(Counter(g["kind"] for g in gaps))},
        "processes": processes, "screens": screens, "routes": routes, "methods": [{k: v for k, v in m.items() if not k.startswith("_")} for m in methods], "endpoints": endpoints, "clientCalls": clients, "methodCallEdges": dict(graph), "imports": dict(imports), "tables": tables, "requirements": requirements, "automatedTests": tests, "uatTests": uat, "technicalExecutionEvidence": technical_evidence, "externalContracts": contracts, "traces": traces, "gaps": gaps,
    }


def validate(data):
    problems = []
    if len(data["processes"]) != 9:
        problems.append("Se esperaban nueve procesos revisados")
    if data["summary"]["RF"] != 81 or data["summary"]["RNF"] != 54:
        problems.append("La fuente de requisitos no contiene los 81 RF y 54 RNF esperados")
    mids = {m["id"] for m in data["methods"]}
    if len(mids) != len(data["methods"]):
        problems.append("IDs de método duplicados; inspeccionar funciones/sobrecargas en misma línea")
    endpoint_ids = [e["id"] for e in data["endpoints"]]
    if len(endpoint_ids) != len(set(endpoint_ids)):
        problems.append("Endpoint HTTP duplicado; inspeccionar anotaciones")
    for endpoint in data["endpoints"]:
        if endpoint["methodId"] not in mids:
            problems.append("Endpoint sin método real: " + endpoint["id"])
    for m in data["methods"]:
        if not m["codeEvidence"] or m["line"] < 1:
            problems.append("Método sin evidencia: " + m["id"])
    for trace in data["traces"]:
        if trace["verification"] != "pending":
            problems.append("Se declaró verificación no permitida")
    nodes = {n["id"] for p in data["processes"] for n in p["nodes"]}
    reqs = {r["id"] for r in data["requirements"]}
    for uat in data["uatTests"]:
        for node in uat["nodeIds"]:
            if node not in nodes:
                problems.append(f'{uat["id"]}: nodo BPMN inexistente {node}')
        for requirement in uat["requirements"]:
            if requirement not in reqs:
                problems.append(f'{uat["id"]}: requisito inexistente {requirement}')
        if not uat["findings"] or not uat["nodeIds"] or not uat["requirements"]:
            problems.append(f'{uat["id"]}: falta relación BPMN/RF/Hxx')
    uids = [u["id"] for u in data["uatTests"]]
    if len(uids) != len(set(uids)):
        problems.append("IDs UAT duplicados")
    if uids and len(uids) < 60:
        problems.append("El plan requiere al menos 60 casos UAT")
    if data["snapshot"]["changedDuringScan"]:
        problems.append("Fuentes cambiaron durante lectura; repetir generación")
    return problems


def parse_uat_relation(body):
    relation = re.search(r'^Relación:\s*([^\n]+)', body, re.M)
    if not relation:
        raise ValueError('Caso UAT sin línea Relación explícita')
    text = relation.group(1)
    return {'nodeIds': sorted(set(re.findall(r'P\d{2}_[A-Z]\w*', text))),
            'requirements': sorted(set(re.findall(r'R(?:N)?F-\d{2}', text))),
            'findings': sorted(set(re.findall(r'H\d{2}', text)))}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT, help="JSON de salida dentro del workspace")
    parser.add_argument("--check", action="store_true", help="Construye y valida en memoria sin escribir")
    args = parser.parse_args()
    target = (ROOT / args.output).resolve()
    if not target.is_relative_to(ROOT) or target.suffix.lower() != ".json":
        parser.error("La salida debe ser un JSON dentro del proyecto")
    data = build_inventory()
    problems = validate(data)
    if problems:
        for problem in problems:
            print("ERROR: " + problem)
        return 1
    if not args.check:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": rel(target) if not args.check else "check_only", "summary": data["summary"], "verification": "pending"}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
