#!/usr/bin/env python3
"""Read-only inventory by default; explicitly requested ZIPs never enter publicRepo.

Standard library only. Never stages, changes ignores, connects to services or
reads .env. Imported helpers are also usable by the document-curation task.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import html
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile

DELIVERY_DATE = "2026-10-27"
EVIDENCE_DATE = "2026-10-26"
MIB = 1024 * 1024
GITHUB_WARN = 50 * MIB
GITHUB_LIMIT = 100 * MIB
DEFAULT_ROOT = Path(__file__).resolve().parents[2]
AUDIT_REL = "tools/entrega_capitulo3/audit_json.json"
WRAPPERS = frozenset({
    "gradle/wrapper/gradle-wrapper.jar",
    "mobile-app/android/gradle/wrapper/gradle-wrapper.jar",
})
# Superseded local documents are retained for the private archive only.
# Publishing the current documentation never re-adds these historical copies.
PUBLIC_RETIRED_DOCUMENTS = frozenset({'docs/ecoroute-tour.html', 'docs/Carta_Autorizacion_MICOTRANS_Grupo3.docx', 'docs/screenshots/mobile-01-login.png', 'docs/Integrador I_Grupo3_Correccion_Integral.docx', 'docs/screenshots/web-07-reportes.png', 'docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx', 'docs/plan_correccion_integral.md', 'GEMINI.md', 'GUIA_COMPLETA.md', 'docs/screenshots/mobile-03-detalle-pedido.png', 'docs/screenshots/web-02-dashboard.png', 'docs/screenshots/web-01-home.png', 'G1_SISTEMA_WEB_DE_GESTIÓN_DE_COMUNICACIÓN_INTERNA_EMPRESARIAL_PARA_LA_EMPRESA_COVISIAN.pdf', 'docs/correccion_integral/CIERRE_TECNICO.md', 'docs/correccion_integral/EcoRoute_Arquitectura_y_Flujos_Verificados.pptx', 'docs/Guion_Exposicion_EcoRoute_Grupo3.docx', 'receipt.pdf', 'pdf', 'docs/screenshots/web-06-vehiculos.png', 'docs/screenshots/mobile-04-evidencia-entrega.png', 'docs/EcoRoute_Presentacion_Grupo3.pptx', 'mobile-app/build_logs.txt', 'docs/screenshots/mobile-05-perfil.png', 'docs/screenshots/web-04-rutas.png', 'docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx', 'docs/Capitulo2_Indice_Version_Vigente.md', 'docs/screenshots/mobile-02-rutas-mapa.png', 'docs/screenshots/web-03-pedidos.png', 'docs/analisis-brecha-vision-objetivo.xlsx', 'docs/screenshots/web-05-conductores.png', 'docs/screenshots/README.md'})
PUBLIC_RETIRED_PREFIXES = ("docs/screenshots/", "docs/presentacion_capitulo2/")
SOURCE_TREES = ("src/", "web-admin/", "mobile-app/", "infra/", "gradle/", "tools/")
DOC_TREES = (
    "docs/entrega_capitulo3/", "docs/guia_total_ide/",
    "docs/correccion_integral/diagramas/",
    "docs/base_datos/modelo_erd/", "docs/base_datos/modelo_erd_negocio/",
    "docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/",
    "docs/entregables_procesos_ecoroute/negocio_revisado/imagenes/",
)
DOC_FILES = frozenset({
    "docs/README.md",
    "docs/Integrador I_Grupo3.docx",
    "docs/Integrador I_Grupo3_Capitulo3_Final.docx",
    "docs/Integrador I_Grupo3_Correccion_Integral.docx",
    "docs/requerimientos-funcionales-ecoroute.xlsx",
    "docs/requerimientos-no-funcionales-ecoroute.xlsx",
    "docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx",
    "docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx",
    "docs/correccion_integral/EcoRoute_Arquitectura_y_Flujos_Verificados.pptx",
    "docs/correccion_integral/Plan_Pruebas_Usuario.md",
    "docs/correccion_integral/Acta_UAT_Plantilla.md",
    "docs/correccion_integral/CIERRE_TECNICO.md",
    "docs/entregables_procesos_ecoroute/negocio_revisado/EcoRoute_Procesos_Negocio_Revisados.docx",
    "docs/presentacion_capitulo2/final/EcoRoute_Capitulo_2_Diseno_BPMN_Formal_v4.pptx",
    "docs/Capitulo2_Indice_Version_Vigente.md", "docs/plan_correccion_integral.md",
    "docs/base_datos/EcoRoute_BD_Completa_V1-V16.sql",
})
# publicRepo includes source and scripts plus current documents/diagram sources.
# Runtime evidence, raw SQL data, private exports, archives/APKs are ineligible.
PUBLIC_DOC_TREES = (
    "docs/entrega_capitulo3/", "docs/guia_total_ide/",
    "docs/correccion_integral/diagramas/",
    "docs/base_datos/modelo_erd/", "docs/base_datos/modelo_erd_negocio/",
    "docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/",
    "docs/entregables_procesos_ecoroute/negocio_revisado/imagenes/",
)
PUBLIC_EXTENSIONS = frozenset({".md", ".docx", ".pdf", ".pptx", ".svg", ".mmd", ".bpmn", ".png", ".jpg", ".jpeg", ".json"})
ROOT_FILES = frozenset({
    "README.md", "GUIA_COMPLETA.md", "Dockerfile", "build.gradle", "settings.gradle",
    "gradle.properties", "gradlew", "gradlew.bat", ".dockerignore", ".gitattributes",
    ".gitignore", ".env.example", "docker-compose.yml", "docker-compose.yaml",
    "docker-compose.ide.yml", "schema.sql", "EcoRoute_Backend_IDE.code-workspace",
    "EcoRoute_Flutter_IDE.code-workspace", "EcoRoute_Web_IDE.code-workspace",
    "create_full_flow.ps1", "setup-keycloak.ps1", "run-local.bat",
    "simulate_deliveries.ps1", "simulate_gps.ps1",
    "get-token.ps1", "ecoroute-realm.json",
})
PRUNE_DIRS = frozenset({
    ".git", ".claude", ".codex", ".agents", ".aws", ".ssh", ".gnupg",
    ".runtime", "node_modules",
    ".dart_tool", ".gradle", ".idea", ".vscode", ".next", ".vite", ".cache",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".coverage", ".symlinks",
    ".plugin_symlinks", "xcuserdata", ".cxx", ".externalnativebuild", ".kotlin",
})
# Ordinary words such as out/cache/build are legitimate domain/package names.
# Only these EXACT module-relative output roots may be treated as generated.
GENERATED_OUTPUT_NAMES = frozenset({
    "build", "dist", "out", "target", "bin", "cache", "caches", "coverage",
    "htmlcov", "test-results", "playwright-report",
})
GENERATED_OUTPUT_PARENTS = (
    "", "web-admin", "mobile-app", "mobile-app/android", "mobile-app/android/app",
    "mobile-app/ios", "mobile-app/macos", "mobile-app/linux", "mobile-app/windows",
)
GENERATED_DIR_PATHS = frozenset(
    (parent + "/" if parent else "") + name
    for parent in GENERATED_OUTPUT_PARENTS for name in GENERATED_OUTPUT_NAMES
) | frozenset({
    "keycloak_data", "postgres_data", "redis_data", "localstack_data",
    "volumes", "volume", "pgdata", "backups", "dumps", "entregas",
    "infra/keycloak_data", "infra/postgres_data", "infra/redis_data",
    "infra/localstack_data", "infra/volumes", "infra/backups", "infra/dumps",
    "mobile-app/ios/pods", "mobile-app/macos/pods", "mobile-app/ios/deriveddata",
    "mobile-app/macos/deriveddata", "mobile-app/ios/flutter/ephemeral",
    "mobile-app/macos/flutter/ephemeral", "mobile-app/linux/flutter/ephemeral",
    "mobile-app/windows/flutter/ephemeral",
})
COMPLETENESS_TREES = (
    "src/", "src/test/", "web-admin/src/", "web-admin/tests/", "web-admin/test/",
    "mobile-app/lib/", "mobile-app/test/", "mobile-app/integration_test/",
    "mobile-app/android/app/src/", "mobile-app/ios/Runner/", "mobile-app/ios/RunnerTests/",
)
# Narrow, independent exceptions for the completeness check. These never depend
# on PRUNE_DIRS, GENERATED_DIR_PATHS, exclusion_reason or the allowlist.
COMPLETENESS_ARTIFACT_DIRS = frozenset({
    ".git", ".claude", ".codex", ".runtime", "node_modules", ".dart_tool",
    ".gradle", "__pycache__", ".pytest_cache", ".mypy_cache", ".cache",
})
COMPLETENESS_ARTIFACT_SUFFIXES = frozenset({".pyc", ".class", ".log"})
COMPLETENESS_PRIVATE_SUFFIXES = frozenset({".pem", ".key", ".der", ".p8", ".pkcs8", ".p12", ".pfx", ".jks", ".keystore"})
DENIED_SUFFIXES = frozenset({
    ".zip", ".7z", ".tar", ".gz", ".tgz", ".rar", ".apk", ".aab", ".ipa",
    ".log", ".pyc", ".class", ".jar", ".war", ".exe", ".dll", ".so",
    ".jks", ".keystore", ".p12", ".pfx", ".pem", ".key", ".der", ".p8", ".pkcs8", ".kdbx",
    ".db", ".db3", ".sqlite", ".sqlite3", ".dump", ".bak", ".iml", ".hprof",
    ".rdb", ".aof", ".wal", ".ibd", ".bson", ".xz", ".bz2", ".zst",
    ".mp4", ".webm", ".mov", ".har", ".trace", ".lockb",
})
GENERATED_PATHS = frozenset({AUDIT_REL, "MANIFEST.json", "MANIFEST.sha256", "README_RESTORE.md", "PACKAGE_METADATA.json"})
GUIDE_EVIDENCE_METADATA = frozenset({
    "docs/guia_total_ide/ejecucion_20261026/manifest.json",
    "docs/guia_total_ide/ejecucion_20261026/business_final.json",
    "docs/guia_total_ide/ejecucion_20261026/runtime_verification.json",
    "docs/guia_total_ide/ejecucion_20261026/mobile/source_copy_verification.json",
})
# Agent-reviewed defaults for the authorized local demo: exact path/field/value.
# These exceptions never bypass issued-token/private-key checks.
DEMO_ASSIGNMENTS = {
    (".env.example", "DB_PASSWORD"): {"password"},
    (".env.example", "KEYCLOAK_BOOTSTRAP_PASSWORD"): {"admin"},
    (".env.example", "AWS_SECRET_ACCESS_KEY"): {"test"},
    ("docker-compose.yml", "KEYCLOAK_ADMIN_PASSWORD"): {"admin"},
    ("get-token.ps1", "Password"): {"admin123", "conductor123"},
    ("tools/capture_screens.py", "PASSWORD"): {"admin123", "conductor123"},
}
TEXT_SUFFIXES = frozenset({
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".java", ".dart",
    ".kt", ".kts", ".swift", ".m", ".h", ".json", ".yml", ".yaml", ".xml",
    ".plist", ".md", ".txt", ".html", ".css", ".scss", ".sql", ".sh", ".ps1",
    ".bat", ".properties", ".gradle", ".bpmn", ".mmd", ".svg", ".pbxproj",
    ".xcworkspacedata", ".xcscheme", ".xcconfig", ".storyboard", ".xib", ".lock",
    ".example", ".code-workspace", ".toml", ".ini", ".cfg", ".conf", ".rb",
})


def clean_path(path: str) -> str:
    """Require canonical relative POSIX paths, including when imported by Git curation."""
    if not isinstance(path, str) or not path or any(c in path for c in "\\\x00\r\n:"):
        raise ValueError("noncanonical_path")
    p = PurePosixPath(path)
    if p.is_absolute() or p.as_posix() != path or any(x in {".", ".."} for x in p.parts):
        raise ValueError("noncanonical_path")
    if any(x.endswith((".", " ")) for x in p.parts):
        raise ValueError("unsafe_windows_path")
    if any(re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", x) for x in p.parts):
        raise ValueError("unsafe_windows_path")
    return path


def directory_exclusion_reason(path: str) -> str | None:
    """Shared traversal/file check; semantic source directory names are preserved."""
    parts = PurePosixPath(path).parts
    lower = [x.lower() for x in parts]
    if any(x in PRUNE_DIRS or x.startswith(("_qa", ".runtime", "_ppt")) for x in lower):
        return "runtime_cache_volume_or_qa"
    relative = "/".join(lower)
    if any(relative == p or relative.startswith(p + "/") for p in GENERATED_DIR_PATHS):
        return "generated_output_or_volume_root"
    return None


def exclusion_reason(path: str) -> str | None:
    if path.startswith('tools/audit_e2e/android_avd/'):
        return 'local_machine_avd_configuration'
    try:
        clean_path(path)
    except ValueError:
        return "unsafe_path"
    p = PurePosixPath(path)
    parts = [x.lower() for x in p.parts]
    name = parts[-1]
    directory_reason = directory_exclusion_reason(path)
    if directory_reason:
        return directory_reason
    if any(x in {".ds_store", "thumbs.db", "desktop.ini"} for x in parts):
        return "os_metadata"
    if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".pdf"} and (name.startswith("qa_") or "contact_sheet" in name):
        return "qa_contact_sheet"
    if any((x == ".env" or x.startswith(".env.")) and x != ".env.example" for x in parts):
        return "environment_secret"
    if any(re.search(r"(?i)(service[-_]?account|credentials|private[-_]?key|keycloak[-_]?data|postgres[-_]?data)", x) for x in parts):
        return "credential_or_database_path"
    if "realm" in name and p.suffix.lower() == ".json" and path != "ecoroute-realm.json":
        return "realm_export"
    if name in {"local.properties", "key.properties", ".netrc", ".npmrc", ".pypirc", "id_rsa", "id_ed25519"}:
        return "local_machine_or_credentials"
    if name in {"generated.xcconfig", "flutter_export_environment.sh", ".flutter-plugins", ".flutter-plugins-dependencies"}:
        return "generated_local_flutter_configuration"
    if ".osrm" in name or name.endswith((".osm", ".pbf")):
        return "osrm_dataset"
    if path in GENERATED_PATHS:
        return "generated_audit_or_manifest"
    if name != "_directory" and path.startswith("docs/guia_total_ide/ejecucion_20261026/") and path not in GUIDE_EVIDENCE_METADATA and p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".svg", ".webp"}:
        return "raw_device_or_runtime_evidence"
    if path in WRAPPERS:
        return None
    if p.suffix.lower() in DENIED_SUFFIXES or name.endswith("~") or name.startswith(("~$", ".#")):
        return "binary_archive_log_or_backup"
    if "dump" in name.lower() and p.suffix.lower() == ".sql":
        return "database_dump"
    if p.suffix.lower() == ".sql" and path not in {"schema.sql", "docs/base_datos/EcoRoute_BD_Completa_V1-V16.sql"} and not path.startswith("src/main/resources/db/migration/"):
        return "sql_data_provenance_unverified"
    if p.suffix.lower() in {".csv", ".tsv"} and path != "web-admin/tools/audit_e2e/readonly-ui/route_efficiency_fixture.csv":
        return "tabular_data_provenance_unverified"
    return None


def explicit_allowlist(path: str, *, publicRepo: bool = False, size: int = 0) -> bool:
    """Path/size eligibility only; pair with scan_content before copying or staging.

    publicRepo=True returns source/scripts and current document candidates; it
    forbids ZIP/APK/raw SQL data/runtime evidence even below GitHub's limit. Binary
    documents and images require human privacy review; this never publishes.
    """
    if exclusion_reason(path):
        return False
    if publicRepo:
        if path in PUBLIC_RETIRED_DOCUMENTS or path.startswith(PUBLIC_RETIRED_PREFIXES):
            return False
        if size >= GITHUB_LIMIT:
            return False
        if not path.startswith("docs/"):
            return path in ROOT_FILES or path.startswith(SOURCE_TREES)
        if path in DOC_FILES or path in GUIDE_EVIDENCE_METADATA:
            return True
        # The inventory separately restricts this tree to the 71 manifest-linked
        # synthetic demonstration captures reviewed with the rendered guide.
        if path.startswith('docs/guia_total_ide/ejecucion_20261026/') and PurePosixPath(path).suffix.lower() in {'.png','.jpg','.jpeg'}:
            return True
        if PurePosixPath(path).suffix.lower() not in PUBLIC_EXTENSIONS or path.endswith(".sql"):
            return False
        if any(x in PurePosixPath(path).parts for x in ("ejecucion_20261026", "evidencias", "capturas")):
            return False
        return path in DOC_FILES or path.startswith(PUBLIC_DOC_TREES)
    return path in ROOT_FILES or path in DOC_FILES or path.startswith(SOURCE_TREES + DOC_TREES)


def git(root: Path, *args: str, check: bool = True) -> bytes:
    env = dict(os.environ, GIT_OPTIONAL_LOCKS="0", GIT_TERMINAL_PROMPT="0")
    p = subprocess.run(["git", "-C", str(root), *args], stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL, env=env, check=False)
    if check and p.returncode:
        raise ValueError("git_read_failed")
    return p.stdout


def git_paths(root: Path, *args: str) -> set[str]:
    return {os.fsdecode(x) for x in git(root, "ls-files", "-z", *args).split(b"\0") if x}


def index_digest(root: Path) -> str:
    raw = git(root, "rev-parse", "--git-path", "index").decode().strip()
    p = Path(raw)
    if not p.is_absolute():
        p = root / p
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else "absent"


def linked(path: Path) -> bool:
    # Windows OneDrive files may carry REPARSE_POINT for cloud hydration: reject
    # symlinks/junctions, not ordinary hydrated cloud files.
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def source_bytes(root: Path, relative: str) -> bytes:
    clean_path(relative)
    p = root / relative
    if not p.resolve().is_relative_to(root.resolve()):
        raise ValueError("outside_workspace")
    if any(linked(x) for x in [p, *list(p.parents)[:len(PurePosixPath(relative).parts)-1]]):
        raise ValueError("symlink_or_junction")
    before = p.stat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError("not_regular_file")
    data = p.read_bytes()
    after = p.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or len(data) != after.st_size:
        raise ValueError("changed_during_read")
    return data


PATTERNS = (
    ("private_key", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----")),
    ("aws_access_key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("provider_token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
    ("authorization_value", re.compile(r"(?i)\b(?:bearer|basic)\s+[A-Za-z0-9+/_.=-]{16,}")),
    ("credential_url", re.compile(r"(?i)\b(?:https?|postgres(?:ql)?|redis|amqp)://[^\s/:@'\"]+:[^\s/@'\"]+@")),
    ("service_account", re.compile(r'"type"\s*:\s*"service_account"')),
)
ASSIGNMENT = re.compile(
    r'''(?ix)(?<![\w.-])(?:["']?)([\w.-]{0,80}(?:password|passwd|pwd|secret|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)[\w.-]{0,80})(?:["']?)[ \t]*[:=][ \t]*(?:["']([^"'\r\n]{1,200})["']|([^\s,;<>"'\r\n]{1,200}))'''
)


def placeholder(value: str) -> bool:
    v = value.strip()
    return (not v or v.lower() in {"null", "none", "true", "false", "undefined"}
            or v.startswith(("$", "<", "{", "process.", "os.", "System.", "env.", "config.", "settings.", "String(", "getenv(", "getProperty(", "requiredEnv(", "requireEnv("))
            or bool(re.fullmatch(r"(?i)(?:REPLACE[_-].*|CHANGE[_-]ME.*|YOUR[_-].*|EXAMPLE[_-].*|DUMMY[_-].*|\*+|x{3,})", v)))


def scan_text(text: str, *, unquoted_literals: bool = False, test_fixture: bool = False, path: str = "") -> list[tuple[str, int]]:
    """Return only rule + line. Never return matched text, even in errors."""
    findings = []
    for rule, pattern in PATTERNS:
        for m in pattern.finditer(text):
            findings.append({"rule": rule, "line": text.count("\n", 0, m.start()) + 1})
    for m in ASSIGNMENT.finditer(text):
        value = m.group(2) if m.group(2) is not None else m.group(3)
        if value in DEMO_ASSIGNMENTS.get((path, m.group(1)), set()):
            continue
        key = m.group(1).lower().replace("_", "").replace("-", "")
        # Match credential fields, not descriptions such as PasswordlessPolicy,
        # token lifetimes or counters about redactions.
        if not key.endswith(("password", "passwd", "pwd", "secret", "apikey", "token", "secretaccesskey", "secretkey", "privatekey")):
            continue
        if placeholder(value):
            continue
        # Code variables/type declarations/calls are not string literals. YAML,
        # properties and environment templates also permit unquoted literals.
        if m.group(2) is None and (not unquoted_literals or re.search(r"[()\[\]]", value)):
            continue
        if test_fixture and "token" in key and len(value) < 64 and re.fullmatch(r"[a-zA-Z0-9_${}-]+", value):
            continue  # Short mock OAuth responses, not JWT/provider credentials.
        if path.endswith((".mjs", ".js", ".ts", ".tsx", ".dart", ".py")) and "crypto.randomBytes(" in value:
            continue  # Generated value in a string replacement, not a literal.
        findings.append({"rule": "credential_assignment", "line": text.count("\n", 0, m.start()) + 1})
    return sorted({(f["rule"], f["line"]) for f in findings})


def scan_content(path: str, data: bytes) -> dict:
    suffix = PurePosixPath(path).suffix.lower()
    findings = []
    review = False
    if suffix in {".docx", ".pptx", ".xlsx"}:
        review = True  # Embedded raster images and human data need visual review.
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                total = 0
                for info in z.infolist():
                    if info.filename.lower().endswith((".xml", ".rels", ".txt")):
                        total += info.file_size
                        if info.file_size > 64*MIB or total > 256*MIB:
                            return {"findings": [{"rule": "office_scan_limit"}], "manual_review": True}
                        text = z.read(info).decode("utf-8", errors="replace")
                        # Remove markup while retaining boundaries between text runs.
                        text = re.sub(r"<[^>]+>", " ", text)
                        for rule, line in scan_text(html.unescape(text), path=path):
                            findings.append({"rule": rule, "member": info.filename, "line": line})
        except (zipfile.BadZipFile, RuntimeError, OSError):
            findings.append({"rule": "unreadable_office_document"})
    elif suffix in TEXT_SUFFIXES or b"\x00" not in data[:8192]:
        text = data.decode("utf-8-sig", errors="replace")
        if suffix in {".html", ".xml", ".svg"}:
            text = html.unescape(text)
        findings.extend({"rule": rule, "line": line} for rule, line in scan_text(
            text, unquoted_literals=suffix in {".yaml", ".yml", ".properties", ".example", ".conf"},
            test_fixture=bool(re.search(r"(?:^|/)(?:test|tests)/", path)), path=path))
        if suffix == ".sql" and re.search(r"(?i)PostgreSQL database dump|COPY\s+[^;]+FROM\s+stdin", text):
            findings.append({"rule": "database_dump_content"})
    else:
        review = True
    if path == "ecoroute-realm.json":
        try:
            realm = json.loads(data.decode("utf-8-sig"))
            def inspect(value, pointer=""):
                if isinstance(value, dict):
                    for key, item in value.items():
                        at = pointer + "/" + key
                        if item and key.lower() in {"privatekey", "secret", "clientsecret", "secretdata", "credentialdata", "hashedsaltedvalue", "salt"}:
                            findings.append({"rule": "realm_credential_material", "json_pointer": at})
                        if key == "value" and "/credentials/" in at and item != "conductor123":
                            findings.append({"rule": "realm_unapproved_demo_credential", "json_pointer": at})
                        if isinstance(item, (dict, list)):
                            inspect(item, at)
                elif isinstance(value, list):
                    for i, item in enumerate(value):
                        inspect(item, pointer + "/" + str(i))
            inspect(realm)
        except ValueError:
            findings.append({"rule": "realm_invalid_json"})
    if suffix in {".png", ".jpg", ".jpeg", ".pdf", ".gif", ".webp"}:
        review = True
    return {"findings": findings, "manual_review": review}


def realm_audit(root: Path) -> dict:
    path = "ecoroute-realm.json"
    result = {"path": path, "included": False, "keys": []}
    if not (root / path).is_file():
        return result
    try:
        obj = json.loads(source_bytes(root, path).decode("utf-8-sig"))
        def walk(value, pointer=""):
            if isinstance(value, dict):
                for key, item in value.items():
                    at = pointer + "/" + key.replace("~", "~0").replace("/", "~1")
                    if key.lower() in {"privatekey", "private_key", "secret", "clientsecret", "password", "salt", "hashedsaltedvalue", "value"} and item:
                        if key.lower() == "value" and "credentials" not in pointer.lower():
                            continue
                        if "private" in key.lower():
                            kind = "private_key_material_do_not_distribute"
                        elif key == "value" and "/credentials/" in at and item == "conductor123":
                            kind = "authorized_synthetic_demo_credential"
                        elif isinstance(item, str) and item.lower() in {"admin", "password", "secret", "test", "demo", "changeme"}:
                            kind = "demo_literal_still_excluded"
                        else:
                            kind = "credential_material_reality_unverified"
                        result["keys"].append({"json_pointer": at, "classification": kind})
                    if isinstance(item, (dict, list)):
                        walk(item, at)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    walk(item, pointer + "/" + str(i))
        walk(obj)
        result["included"] = not scan_content(path, source_bytes(root, path))["findings"]
    except (OSError, ValueError):
        result["error"] = "realm_metadata_unreadable"
    result["note"] = "Sanitized example permitted only without keys/hashes/client secrets and with the authorized synthetic user credential; no values reported."
    return result


def versions(root: Path) -> dict:
    result = {}
    for label, path, pattern in (
        ("backend", "build.gradle", r"(?m)^version\s*=\s*['\"]([^'\"]+)"),
        ("mobile", "mobile-app/pubspec.yaml", r"(?m)^version:\s*(\S+)"),
    ):
        if (root / path).is_file():
            m = re.search(pattern, source_bytes(root, path).decode("utf-8-sig"))
            result[label] = m.group(1) if m else "unspecified"
    if (root / "web-admin/package.json").is_file():
        result["web"] = json.loads(source_bytes(root, "web-admin/package.json").decode("utf-8-sig")).get("version", "unspecified")
    return result


def generated_files(root: Path) -> dict[str, bytes]:
    # Do not derive values from .env, exported realms, user profiles or services.
    names = {"DB_NAME", "DB_USER", "DB_PASSWORD", "KEYCLOAK_ADMIN_CLIENT_SECRET"}
    for path in sorted(root.glob("*compose*.y*ml")):
        names.update(re.findall(r"\$\{([A-Za-z_][A-Za-z0-9_]*)", source_bytes(root, path.name).decode("utf-8-sig")))
    env = "# Plantilla sin credenciales. Configurar localmente; nunca versionar .env.\n"
    for name in sorted(names):
        value = {"DB_NAME": "ecoroute", "DB_USER": "ecoroute"}.get(name, "REPLACE_ME_LOCALLY")
        env += name + "=" + value + "\n"
    seed = """-- Datos sintéticos exclusivos de demostración; sin personas ni credenciales.
-- Aplicar después de las migraciones Flyway en una base LOCAL vacía.
-- No reemplaza seeds de negocio ni una importación de datos empresariales.
INSERT INTO hubs (name, code, address, city, latitude, longitude)
VALUES ('Centro ficticio capítulo 3', 'DEMO-C3', 'Dirección ficticia 000',
        'Ciudad de prueba', 0, 0)
ON CONFLICT (code) DO NOTHING;
"""
    template = root / ".env.example"
    if template.is_file():
        candidate = source_bytes(root, ".env.example")
        if not scan_content(".env.example", candidate)["findings"]:
            return {".env.example": candidate, "seeds/entrega_capitulo3_synthetic.sql": seed.encode()}
    return {".env.example": env.encode(), "seeds/entrega_capitulo3_synthetic.sql": seed.encode()}


def selected_guide_captures(root: Path) -> set[str]:
    """Only images actually linked by the canonical guide, not every screenshot."""
    guide = "docs/guia_total_ide/EcoRoute_Guia_Total_Recorrido_y_IDE.md"
    if not (root / guide).is_file():
        return set()
    text = source_bytes(root, guide).decode("utf-8-sig")
    links = re.findall(r'''!?\[[^\]]*\]\(([^)]+)\)|(?:src|href)=["']([^"']+)''', text)
    selected = set()
    for first, second in links:
        url = urlsplit(first or second)
        if url.scheme not in {"", "file"}:
            continue
        raw = unquote(url.path)
        if url.scheme == "file" and re.match(r"^/[A-Za-z]:/", raw):
            raw = raw[1:]
        p = Path(raw)
        if not p.is_absolute():
            p = (root / guide).parent / p
        p = p.resolve()
        if p.is_relative_to(root) and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".svg", ".webp"}:
            selected.add(p.relative_to(root).as_posix())
    return selected


def source_completeness(root: Path, selected: list[dict], rejected: list[dict]) -> dict:
    """Independent filesystem census: no inventory pruning/allowlist is reused.

    Count identity alone is insufficient: compare exact file sets as well.
    Unexpected omissions fail closed; exclusions remain explicit in the report.
    """
    packaged = {entry["path"] for entry in selected}
    security_rejections = {entry["path"] for entry in rejected
                           if entry["reason"] == "content_security_review"}
    trees = []
    for prefix in COMPLETENESS_TREES:
        folder = root / prefix
        if not folder.exists():
            trees.append({"tree": prefix, "exists": False, "ok": True,
                          "filesystem_files": 0, "expected_files": 0, "included_files": 0,
                          "excluded_files": [], "missing_files": [], "unexpected_files": [], "errors": []})
            continue
        filesystem = set()
        exclusions = []
        errors = []
        def walk_error(error):
            # Never serialize exception text or file contents.
            errors.append({"path": prefix, "reason": "filesystem_census_unreadable"})
        for base, dirs, files in os.walk(folder, followlinks=False, onerror=walk_error):
            basepath = Path(base)
            for name in list(dirs):
                p = basepath / name
                if linked(p):
                    dirs.remove(name)
                    errors.append({"path": p.relative_to(root).as_posix(), "reason": "source_directory_link"})
            for name in files:
                p = basepath / name
                rel = p.relative_to(root).as_posix()
                filesystem.add(rel)
                parts = PurePosixPath(rel).parts
                filename = name.lower()
                if any(part.lower() in COMPLETENESS_ARTIFACT_DIRS or part.lower().startswith(("_qa", ".runtime")) for part in parts[:-1]):
                    reason = "explicit_generated_artifact_directory"
                elif p.suffix.lower() in COMPLETENESS_ARTIFACT_SUFFIXES or filename in {".ds_store", "thumbs.db", "desktop.ini"}:
                    reason = "explicit_generated_artifact_file"
                elif (filename == ".env" or filename.startswith(".env.")) and filename != ".env.example":
                    reason = "private_environment_file"
                elif p.suffix.lower() in COMPLETENESS_PRIVATE_SUFFIXES:
                    reason = "private_key_file"
                elif rel in security_rejections:
                    reason = "content_security_review"
                else:
                    reason = None
                if reason:
                    exclusions.append({"path": rel, "reason": reason})
        excluded = {entry["path"] for entry in exclusions}
        expected = filesystem - excluded
        included = {path for path in packaged if path.startswith(prefix)}
        missing = sorted(expected - included)
        unexpected = sorted(included - expected)
        # Explicit assertions are evaluated even with python -O.
        counts_match = len(expected) == len(included)
        identity_match = expected == included
        trees.append({"tree": prefix, "exists": True,
                      "filesystem_files": len(filesystem), "expected_files": len(expected),
                      "included_files": len(included), "excluded_files": exclusions,
                      "missing_files": missing, "unexpected_files": unexpected, "errors": errors,
                      "counts_match": counts_match, "identity_match": identity_match,
                      "ok": counts_match and identity_match and not errors})
    return {"ok": all(tree["ok"] for tree in trees),
            "method": "independent_filesystem_census_and_exact_path_set_equality",
            "trees": trees}


def assert_source_completeness(root: Path, selected: list[dict], rejected: list[dict]) -> dict:
    coverage = source_completeness(root, selected, rejected)
    if not coverage["ok"]:
        raise ValueError("source_completeness_invariant_failed")
    return coverage


def inventory(root: Path, *, audit_path: Path | None = None, max_file_bytes: int = GITHUB_LIMIT) -> dict:
    tracked = git_paths(root, "--cached")
    untracked = git_paths(root, "--others", "--exclude-standard")
    modified = {os.fsdecode(p) for p in git(root, "diff", "--name-only", "-z", "HEAD").split(b"\0") if p}
    candidates = set()
    skipped = []
    for base, dirs, files in os.walk(root, followlinks=False):
        basepath = Path(base)
        for name in list(dirs):
            p = basepath / name
            rel = p.relative_to(root).as_posix()
            reason = directory_exclusion_reason(rel)
            # Avoid traversing entire histories and unrelated root trees.
            if reason or linked(p) or (basepath == root and name not in {"src", "web-admin", "mobile-app", "infra", "gradle", "tools", "docs"}):
                dirs.remove(name)
                skipped.append({"path": rel + "/", "reason": reason or "outside_allowlist_or_link"})
            elif basepath == root / "docs" and not any(x.startswith(rel + "/") for x in DOC_TREES):
                dirs.remove(name)
                skipped.append({"path": rel + "/", "reason": "historical_documents"})
        for name in files:
            p = basepath / name
            if audit_path and p.absolute() == audit_path.absolute():
                continue
            candidates.add(p.relative_to(root).as_posix())
    selected = []
    rejected = []
    public = []
    document_sizes = []
    guide_captures = selected_guide_captures(root)
    for rel in sorted(candidates):
        p = root / rel
        reason = exclusion_reason(rel)
        if rel.startswith("docs/guia_total_ide/ejecucion_20261026/") and PurePosixPath(rel).suffix.lower() in {".png", ".jpg", ".jpeg", ".svg", ".webp"} and rel not in guide_captures:
            reason = "capture_not_selected_by_current_guide"
        if reason or not explicit_allowlist(rel):
            rejected.append({"path": rel, "reason": reason or "outside_explicit_allowlist"})
            continue
        try:
            size = p.stat().st_size
            if rel.startswith("docs/"):
                document_sizes.append({"path": rel, "bytes": size,
                                       "github": "blocked" if size >= GITHUB_LIMIT else "warning" if size > GITHUB_WARN else "ok"})
            if size > max_file_bytes:
                rejected.append({"path": rel, "reason": "max_file_bytes", "bytes": size})
                continue
            data = source_bytes(root, rel)
            scan = scan_content(rel, data)
        except (OSError, ValueError):
            rejected.append({"path": rel, "reason": "unreadable_changed_or_link"})
            continue
        if scan["findings"]:
            if rel == ".env.example":
                rejected.append({"path": rel, "reason": "replaced_by_generated_safe_template", "findings": scan["findings"]})
                continue
            rejected.append({"path": rel, "reason": "content_security_review", "findings": scan["findings"]})
            continue
        entry = {"path": rel, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                 "git": "tracked" if rel in tracked else "untracked" if rel in untracked else "ignored",
                 "modified_from_head": rel in modified, "manual_privacy_review": scan["manual_review"]}
        selected.append(entry)
        if explicit_allowlist(rel, publicRepo=True, size=len(data)):
            public.append(entry)
    # Original populate scripts have no established provenance. Replace with
    # generated synthetic seed instead of guessing whether customer data is real.
    seed_sources = []
    for name in ("populate.sql", "full_populate.sql", "multi_driver_populate.sql"):
        if (root / name).is_file():
            seed_sources.append({"path": name, "included": False, "reason": "synthetic_provenance_unverified"})
    wrappers = [{"path": p, "present": (root/p).is_file(), "included": any(e["path"] == p for e in selected),
                 "tracked": p in tracked} for p in sorted(WRAPPERS)]
    required = ["build.gradle", "docker-compose.yml", ".env.example", "ecoroute-realm.json", "web-admin/package.json", "web-admin/package-lock.json",
                "mobile-app/pubspec.yaml", "mobile-app/pubspec.lock", *sorted(WRAPPERS),
                "docs/Integrador I_Grupo3.docx", "docs/Integrador I_Grupo3_Capitulo3_Final.docx"]
    present = {e["path"] for e in selected}
    missing = [p for p in required if p not in present]
    missing_captures = sorted(p for p in guide_captures if p not in present)
    missing.extend(missing_captures)
    for prefix in ("src/main/", "src/test/", "src/main/resources/db/migration/", "web-admin/src/", "web-admin/tests/",
                   "mobile-app/lib/", "mobile-app/test/", "mobile-app/android/", "mobile-app/ios/", "docs/entrega_capitulo3/"):
        if not any(p.startswith(prefix) for p in present):
            missing.append(prefix)
    blockers = [{"path": x["path"], "reason": x["reason"]} for x in rejected
                if x["reason"] in {"content_security_review", "unreadable_changed_or_link", "max_file_bytes"}]
    coverage = source_completeness(root, selected, rejected)
    for tree in coverage["trees"]:
        if not tree["ok"]:
            blockers.append({"path": tree["tree"], "reason": "source_completeness_invariant_failed"})
    return {
        "schema_version": 1, "mode": "audit_only", "delivery_date": DELIVERY_DATE,
        "evidence_date": EVIDENCE_DATE, "scanned_at_utc": datetime.now(timezone.utc).isoformat(),
        "versions": versions(root), "git_head": git(root, "rev-parse", "HEAD").decode().strip(),
        "git_counts": {"tracked": len(tracked), "untracked_nonignored": len(untracked), "modified_from_head": len(modified)},
        "source": "current_working_tree_including_uncommitted_and_ignored_allowlisted_wrappers",
        "selected": selected, "selected_bytes": sum(e["bytes"] for e in selected),
        "rejected": rejected, "pruned_directories": skipped, "missing_required": missing,
        "blockers": blockers, "ready_to_package": not blockers and not missing,
        "source_completeness": coverage,
        "publicRepo": {"candidates": public, "automatic_publish": False,
                       "requires_content_and_visual_privacy_review": True,
                       "github_warning_bytes": GITHUB_WARN, "github_block_bytes": GITHUB_LIMIT,
                       "archives_and_apk_allowed": False},
        "document_sizes": sorted(document_sizes, key=lambda e: -e["bytes"]),
        "wrapper_exceptions": wrappers, "realm": realm_audit(root), "unverified_seed_sources": seed_sources,
        "selected_guide_capture_count": len(guide_captures),
        "included_guide_capture_count": sum(p in present for p in guide_captures),
        "missing_linked_guide_captures": missing_captures,
        "generated": [{"path": p, "bytes": len(d), "sha256": hashlib.sha256(d).hexdigest()}
                      for p, d in generated_files(root).items()],
        "environment_example": "reviewed_local_demo_template_or_safe_generated_fallback" if (root/".env.example").exists() else "generated_in_archive_only",
        "demo_exceptions": [{"path": p, "field": k, "classification": "exact_local_defaults_reviewed_by_agent_for_authorized_demo"} for p,k in DEMO_ASSIGNMENTS],
        "limitations": ["Pattern scans cannot certify absence of all secrets or personal data.",
                        "Office XML is scanned; raster images/PDF and privacy require human review.",
                        "Audit is a snapshot. ZIP creation re-reads and hashes every selected file.",
                        "APK is excluded by default and never eligible for publicRepo."],
    }


def apk_audit(path: Path) -> dict:
    """Optional explicit source-copy APK: inspect only, never install or query 9006."""
    result = {"filename": path.name, "bytes": path.stat().st_size,
              "publicRepo": False, "private_only": True, "source_copy_9006_identity_verified": False}
    if path.suffix.lower() != ".apk" or linked(path):
        raise ValueError("apk_path_invalid")
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(MIB), b""):
            h.update(block)
    result["sha256"] = h.hexdigest()
    with zipfile.ZipFile(path) as z:
        result["native_abis"] = sorted({i.filename.split("/")[1] for i in z.infolist()
                                        if i.filename.startswith("lib/") and len(i.filename.split("/")) > 2})
        result["embedded_sensitive_paths"] = [i.filename for i in z.infolist()
            if exclusion_reason(i.filename) in {"environment_secret", "credential_or_database_path", "realm_export"}
            or PurePosixPath(i.filename).suffix.lower() in {".pem", ".key", ".jks", ".keystore", ".p12", ".pfx"}]
    result["note"] = "Size/hash only; port 9006 does not prove APK identity. Native/compiled secrets cannot be certified."
    result["universal_phone_apk"] = False if result["native_abis"] == ["x86_64"] else "not_verified"
    result["github_file_size"] = "blocked" if result["bytes"] >= GITHUB_LIMIT else "warning" if result["bytes"] > GITHUB_WARN else "ok"
    return result


RESTORE = """# EcoRoute: restauración e integridad

Entrega: 27 de octubre de 2026. Evidencia técnica de referencia: 26 de octubre de 2026.
Las versiones exactas y el commit base están en PACKAGE_METADATA.json. Los archivos
son del workspace actual, incluidos cambios aún no confirmados; no de un checkout limpio.

1. Antes de extraer, verificar con Python y el empaquetador de confianza:
   python tools/entrega_capitulo3/package_project.py --verify RUTA_DEL_ZIP
   El verificador compara SHA256 y tamaños, rechaza rutas inseguras, duplicados y extras.
2. Extraer en un directorio NUEVO. Nunca sobrescribir un proyecto con trabajo pendiente.
3. Copiar .env.example a .env y completar valores propios localmente. No contiene secretos.
   Los respaldos privados de realms, credenciales reales, claves, volúmenes y datos
   reales se excluyen. Crear un entorno local nuevo con la semilla demo saneada.
   El realm ecoroute-realm.json es una semilla demo saneada; sus credenciales
   de demostración no son contraseñas reales de servicios. Importar solo en un
   entorno local nuevo. .env.example conserva defaults locales revisados.
4. Java 17 y Gradle wrapper; web: npm ci; móvil: flutter pub get, SDK según pubspec.yaml.
   Consultar README.md, docs/guia_total_ide y la guía de docs/entrega_capitulo3.
   Revisar y configurar compose antes de iniciarlo. Este paquete no ejecuta servicios.
5. Base LOCAL nueva: aplicar Flyway desde src/main/resources/db/migration en orden.
   schema.sql es referencia alternativa consolidada: NO ejecutarlo además de Flyway.
   seeds/entrega_capitulo3_synthetic.sql contiene solo un centro ficticio opcional.
   No restaura información empresarial. OSRM y dependencias deben descargarse aparte.
6. Un APK opcional en private/ no corresponde necesariamente al código actual ni al
   dispositivo de la prueba; comprobar su hash y procedencia. La variante x86_64 de
   la prueba con emulador/9006 NO es un APK universal para celular. Nunca subir a Git.

MANIFEST.json y MANIFEST.sha256 enumeran TODOS los otros archivos (incluido este README),
sin autorreferenciarse. SHA256 acredita integridad respecto del manifiesto, no autenticidad:
conservar por un canal de confianza el hash SHA256 externo del ZIP.
Los archivos de evidencia conservan su fecha original; la fecha de entrega no refecha pruebas.
"""


def verify_archive(path: Path) -> dict:
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        names = [i.filename for i in infos]
        if len(names) != len(set(n.lower() for n in names)):
            raise ValueError("duplicate_archive_paths")
        for info in infos:
            clean_path(info.filename)
            if info.is_dir() or stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
                raise ValueError("unsupported_archive_entry")
        if z.getinfo("MANIFEST.json").file_size > 32*MIB or z.getinfo("MANIFEST.sha256").file_size > 32*MIB:
            raise ValueError("manifest_too_large")
        manifest = json.loads(z.read("MANIFEST.json"))
        entries = manifest["files"]
        expected = {e["path"] for e in entries}
        if len(expected) != len(entries) or set(names) != expected | {"MANIFEST.json", "MANIFEST.sha256"}:
            raise ValueError("manifest_archive_set_mismatch")
        lines = []
        for entry in entries:
            name = clean_path(entry["path"])
            info = z.getinfo(name)
            if info.file_size != entry["bytes"] or info.file_size > 1024*MIB:
                raise ValueError("manifest_size_mismatch")
            h = hashlib.sha256()
            with z.open(info) as f:
                for block in iter(lambda: f.read(MIB), b""):
                    h.update(block)
            if h.hexdigest() != entry["sha256"]:
                raise ValueError("integrity_hash_mismatch")
            lines.append(f"{entry['sha256']}  {name}\n")
        if z.read("MANIFEST.sha256") != "".join(lines).encode():
            raise ValueError("sha256_manifest_mismatch")
    return {"verified": True, "files": len(entries)}


def safe_zip_output(root: Path, output: Path) -> None:
    if output.suffix.lower() != ".zip" or output.exists():
        raise ValueError("zip_must_be_new_zip_path")
    if not output.parent.is_dir() or linked(output.parent):
        raise ValueError("zip_parent_must_exist_without_links")
    if output.resolve().is_relative_to(root.resolve()):
        rel = output.resolve().relative_to(root.resolve()).as_posix()
        if not rel.startswith("entregas/") or not git(root, "check-ignore", "--no-index", "--", rel, check=False):
            raise ValueError("zip_requires_external_path_or_git_ignored_entregas")


def create_archive(root: Path, output: Path, report: dict, *, private_apk: Path | None = None) -> dict:
    safe_zip_output(root, output)
    if not report["ready_to_package"]:
        raise ValueError("packaging_blocked_see_audit_json")
    assert_source_completeness(root, report["selected"], report["rejected"])
    blobs = generated_files(root)
    blobs["README_RESTORE.md"] = RESTORE.encode()
    metadata = {k: report[k] for k in ("delivery_date", "evidence_date", "versions", "git_head", "source", "scanned_at_utc")}
    if private_apk:
        a = apk_audit(private_apk)
        if a["embedded_sensitive_paths"]:
            raise ValueError("apk_contains_sensitive_paths")
        metadata["private_apk"] = a
    blobs["PACKAGE_METADATA.json"] = (json.dumps(metadata, ensure_ascii=False, indent=2)+"\n").encode()
    entries = []
    fd, tmp = tempfile.mkstemp(prefix=".ecoroute-package-", suffix=".tmp", dir=output.parent)
    os.close(fd)
    temporary = Path(tmp)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as z:
            def add(name, data):
                clean_path(name)
                info = zipfile.ZipInfo(name)
                info.compress_type = zipfile.ZIP_DEFLATED
                mode = 0o100755 if name.endswith(".sh") or PurePosixPath(name).name == "gradlew" else 0o100644
                info.external_attr = mode << 16
                source = root / name
                if source.is_file() and name not in blobs:
                    when = datetime.fromtimestamp(source.stat().st_mtime)
                    if 1980 <= when.year <= 2107:
                        info.date_time = when.timetuple()[:6]
                else:
                    info.date_time = (2026, 10, 27, 0, 0, 0)
                z.writestr(info, data)
                entries.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
            for entry in report["selected"]:
                rel = entry["path"]
                if rel in blobs:
                    continue
                data = source_bytes(root, rel)
                if hashlib.sha256(data).hexdigest() != entry["sha256"]:
                    raise ValueError("workspace_changed_rerun_audit")
                add(rel, data)
            for name, data in sorted(blobs.items()):
                add(name, data)
            if private_apk:
                data = private_apk.read_bytes()
                if hashlib.sha256(data).hexdigest() != metadata["private_apk"]["sha256"]:
                    raise ValueError("apk_changed_during_packaging")
                add("private/source-copy.apk", data)
            entries.sort(key=lambda e: e["path"])
            z.writestr("MANIFEST.json", json.dumps({"algorithm": "SHA256", "files": entries}, ensure_ascii=False, indent=2)+"\n")
            z.writestr("MANIFEST.sha256", "".join(f"{e['sha256']}  {e['path']}\n" for e in entries))
        verified = verify_archive(temporary)
        # A concurrent new/deleted source must not escape a stale inventory.
        assert_source_completeness(root, report["selected"], report["rejected"])
        # Windows rename refuses to overwrite. Exclusive create is portable and
        # prevents a race replacing an existing delivery on other platforms.
        created = False
        try:
            with output.open("xb") as dst, temporary.open("rb") as src:
                created = True
                for block in iter(lambda: src.read(MIB), b""):
                    dst.write(block)
        except OSError:
            if created:
                output.unlink(missing_ok=True)
            raise
        with output.open("rb") as f:
            digest = hashlib.file_digest(f, "sha256").hexdigest()
        return {**verified, "zip_bytes": output.stat().st_size, "zip_sha256": digest,
                "publicRepo": False, "zip_must_not_be_committed": True}
    finally:
        temporary.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--audit-json", type=Path, help="Write value-free inventory JSON (default: no writes).")
    parser.add_argument("--public-repo", action="store_true", help="List eligible source/script/current-document paths; never stage/publish.")
    parser.add_argument("--zip", type=Path, help="Explicitly create private ZIP outside Git or in ignored entregas/.")
    parser.add_argument("--verify", type=Path, help="Verify existing ZIP without extracting or running services.")
    parser.add_argument("--inspect-apk", type=Path, help="Inspect exact source-copy APK path/hash/size, without installing.")
    parser.add_argument("--private-apk", type=Path, help="Explicit opt-in with --zip only; compiled secrets require private review.")
    parser.add_argument("--max-file-mib", type=int, default=100, help="Private ZIP file-size guard, 1..1024 (default 100).")
    args = parser.parse_args(argv)
    if args.verify:
        if any((args.zip, args.public_repo, args.private_apk, args.inspect_apk, args.audit_json)):
            parser.error("--verify is standalone")
        print(json.dumps(verify_archive(args.verify), ensure_ascii=True))
        return 0
    if args.public_repo and (args.zip or args.private_apk):
        parser.error("publicRepo never permits ZIP/APK")
    if args.private_apk and not args.zip:
        parser.error("--private-apk requires --zip")
    if not 1 <= args.max_file_mib <= 1024:
        parser.error("--max-file-mib must be 1..1024")
    root = args.root.resolve()
    if args.zip:
        safe_zip_output(root, args.zip.absolute())
    before = index_digest(root)
    report = inventory(root, audit_path=args.audit_json, max_file_bytes=args.max_file_mib*MIB)
    if args.inspect_apk:
        report["apk_inspection"] = apk_audit(args.inspect_apk)
    report["git_index_unchanged"] = before == index_digest(root)
    if not report["git_index_unchanged"]:
        report["concurrent_index_change_detected"] = True
    if args.audit_json:
        target = args.audit_json.absolute()
        # The JSON is intentionally outside the source manifest and not recursive.
        if target.suffix.lower() != ".json" or not target.parent.is_dir():
            raise ValueError("audit_requires_existing_parent_and_json_suffix")
        if target.is_relative_to(root) and target.relative_to(root).as_posix() != AUDIT_REL:
            raise ValueError("in_repo_audit_path_must_be_tools_entrega_capitulo3_audit_json_json")
        if target.exists() and linked(target):
            raise ValueError("audit_output_link")
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    if args.zip:
        # Save the audit before checking readiness, so missing documents/security
        # blockers stay reviewable even when ZIP creation is refused.
        report["archive"] = create_archive(root, args.zip.absolute(), report, private_apk=args.private_apk)
        report["mode"] = "private_zip_created"
        report["git_index_unchanged"] = before == index_digest(root)
        if args.audit_json:
            target.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    if args.public_repo:
        for e in report["publicRepo"]["candidates"]:
            print(e["path"])
    else:
        summary = {"mode": report["mode"], "files": len(report["selected"]), "bytes": report["selected_bytes"],
                   "security_or_size_blockers": len(report["blockers"]), "missing_required": len(report["missing_required"]),
                   "ready_to_package": report["ready_to_package"], "git_index_unchanged": report["git_index_unchanged"]}
        if "archive" in report:
            summary["archive"] = report["archive"]
        print(json.dumps(summary, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, zipfile.BadZipFile):
        # Exception messages can contain source contents, usernames or tokens.
        print("Packaging stopped; check paths, integrity and audit_json. No secret values printed.", file=sys.stderr)
        sys.exit(2)
