#!/usr/bin/env python3
"""Run manually AFTER the human completes the three delivery scenarios.

Read-only business GETs and a PostgreSQL READ ONLY transaction; POST is used
only to authenticate to local Keycloak.
Never accepts a route, dispatches, updates orders, drains an offline queue,
runs SQL writes, starts apps, or accesses UI. Credentials stay in memory.
Writes business_final.json and refreshes the sanitized runtime checkpoint.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs/guia_total_ide/ejecucion_20261026/business_final.json"
LIMA = timezone(timedelta(hours=-5))
EXPECTED = {
    48: ("IDE-20261026-POD", "DELIVERED"),
    49: ("IDE-20261026-FAILED", "FAILED"),
    50: ("IDE-20261026-PENDIENTE", "RETURNED"),
}
ALLOWED_GETS = {
    "/session/me", "/routes?date=2026-10-26", "/routes/22/review",
    "/orders?routeId=22", "/incidents", "/improvement-actions",
    *(f"/orders/{order_id}" for order_id in EXPECTED),
    *(f"/delivery-proofs/{order_id}" for order_id in EXPECTED),
    "/delivery-proofs/48/photo", "/delivery-proofs/48/signature",
    "/delivery-proofs/48/pdf",
}


class VerificationUnavailable(Exception):
    """Fixed diagnostic only: no response or credential payload."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def now():
    return datetime.now(LIMA).isoformat()


class LocalReader:
    def __init__(self, report, timeout):
        self.report = report
        self.timeout = timeout
        self.token = None
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), NoRedirect()
        )

    def authenticate(self):
        # Read only the documented local auth defaults; never run legacy scripts.
        config = (ROOT / "get-token.ps1").read_text(encoding="utf-8-sig")

        def default(name):
            match = re.search(
                r"\[string\]\$" + name + r"\s*=\s*[\"']([^\"']+)", config, re.I
            )
            if not match:
                raise VerificationUnavailable("AUTH_CONFIGURATION_UNAVAILABLE")
            return match[1]

        client = re.search(r"client_id\s*=\s*[\"']([^\"']+)", config)
        if not client:
            raise VerificationUnavailable("AUTH_CLIENT_UNAVAILABLE")
        credentials = {
            "client_id": client[1], "grant_type": "password",
            "username": default("Username"),
            "password": os.environ.get("ECOROUTE_ADMIN_PASSWORD") or default("Password"),
        }
        request = urllib.request.Request(
            "http://127.0.0.1:8080/realms/ecoroute/protocol/openid-connect/token",
            data=urllib.parse.urlencode(credentials).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST",
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                self.report["authenticationHttpStatus"] = response.status
                self.token = json.load(response)["access_token"]
        except urllib.error.HTTPError as error:
            self.report["authenticationHttpStatus"] = error.code
            raise VerificationUnavailable("AUTH_HTTP_FAILURE") from None
        except Exception:
            raise VerificationUnavailable("AUTH_UNAVAILABLE") from None
        finally:
            credentials.clear()

    def get(self, path, headers_only=False, hash_asset=False):
        if path not in ALLOWED_GETS:
            raise VerificationUnavailable("GET_SCOPE_GUARD")
        observation = {"at": now(), "method": "GET", "path": path,
                       "status": None, "bodyRead": not headers_only}
        self.report["http"].append(observation)
        request = urllib.request.Request(
            "http://127.0.0.1:8081" + path,
            headers={"Authorization": "Bearer " + self.token}, method="GET",
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                observation["status"] = response.status
                if hash_asset:
                    digest = hashlib.sha256()
                    length = 0
                    prefix = b""
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        if not prefix:
                            prefix = chunk[:8]
                        length += len(chunk)
                        if length > 20 * 1024 * 1024:
                            raise VerificationUnavailable("ASSET_SIZE_LIMIT")
                        digest.update(chunk)
                    return response.status, {
                        "mediaType": response.headers.get_content_type(),
                        "byteCount": length, "sha256": digest.hexdigest(),
                        "recognizedImage": prefix.startswith((b"\xff\xd8", b"\x89PNG\r\n\x1a\n")),
                        "recognizedPdf": prefix.startswith(b"%PDF-"),
                    }
                if headers_only:
                    media_type = response.headers.get_content_type()
                    return response.status, {"mediaType": media_type}
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            observation.update(status=error.code, bodyRead=False)
            return error.code, None
        except Exception:
            observation["bodyRead"] = False
            raise VerificationUnavailable("LOCAL_GET_UNAVAILABLE") from None


def valid_gps(latitude, longitude):
    return (isinstance(latitude, (float, int)) and isinstance(longitude, (float, int))
            and math.isfinite(latitude) and math.isfinite(longitude)
            and abs(latitude) <= 90 and abs(longitude) <= 180
            and (latitude != 0 or longitude != 0))


def database_integrity():
    # Separate -c arguments preserve SELECT output while keeping one session.
    # No env inspection, shell interpolation, payloads, names, contact data,
    # reasons, object URIs or credentials are selected.
    query = """SELECT json_build_object(
      'transactionReadOnly',current_setting('transaction_read_only'),
      'proofCount48',(SELECT count(*) FROM delivery_proofs WHERE order_id=48),
      'proofHashes',(SELECT json_agg(json_build_object(
          'id',id,'orderId',order_id,'photoSha256',image_sha256,
          'signatureSha256',signature_sha256,'capturedAt',captured_at,
          'receivedAt',received_at)) FROM delivery_proofs WHERE order_id=48),
      'transitionCounts',(SELECT json_agg(row_to_json(x)) FROM (
          SELECT order_id,status,count(*) AS count FROM order_status_history
          WHERE order_id IN (48,49,50)
            AND status IN ('DELIVERED','FAILED','RETURNED','IN_TRANSIT')
          GROUP BY order_id,status ORDER BY order_id,status) x),
      'outbox48',(SELECT count(*) FROM delivery_outbox
          WHERE order_id=48 AND event_type='DELIVERY_CONFIRMED'),
      'notification48',(SELECT count(*) FROM notifications
          WHERE order_id=48 AND type='DELIVERY_CONFIRMED'),
      'incidents',(SELECT json_agg(json_build_object('id',id,'orderId',order_id,
          'routeId',route_id,'status',status,'outcome',outcome))
          FROM incidents WHERE route_id=22 AND order_id IN (49,50)),
      'driverAcceptanceEvents',(SELECT count(*) FROM business_audit_events
          WHERE entity_type='ROUTE' AND entity_id=22 AND action='DRIVER_ACCEPTED'),
      'closeFailed14Events',(SELECT count(*) FROM business_audit_events
          WHERE entity_type='INCIDENT' AND entity_id=14 AND action='CLOSE_FAILED'),
      'closeFailed15Events',(SELECT count(*) FROM business_audit_events
          WHERE entity_type='INCIDENT' AND entity_id=15 AND action='CLOSE_FAILED'),
      'planApprovalEvents',(SELECT count(*) FROM business_audit_events
          WHERE entity_type='ROUTE' AND entity_id=22 AND action='PLAN_APPROVED')
    );"""
    try:
        result = subprocess.run([
            "docker", "exec", "ecoroute-db", "psql", "-X", "-qAt",
            "-v", "ON_ERROR_STOP=1", "-U", "user", "-d", "ecoroute",
            "-c", "BEGIN READ ONLY;", "-c", query, "-c", "COMMIT;",
        ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20)
        if result.returncode:
            return {"status": "UNAVAILABLE", "reason": "READ_ONLY_SQL_FAILED"}
        values = json.loads(result.stdout)
        values["status"] = "PASS" if values.get("transactionReadOnly") == "on" else "FAIL"
        return values
    except Exception:
        return {"status": "UNAVAILABLE", "reason": "READ_ONLY_SQL_UNAVAILABLE"}


def runtime_checkpoint():
    try:
        verifier = ROOT / "tools/guia_total_ide/verify_local_runtime.ps1"
        result = subprocess.run([
            "pwsh", "-NoProfile", "-NonInteractive", "-File", str(verifier),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        if result.returncode:
            return {"status": "UNAVAILABLE", "reason": "RUNTIME_CHECK_FAILED"}
        runtime = json.loads((ROOT / "docs/guia_total_ide/ejecucion_20261026/runtime_verification.json").read_text(encoding="utf-8"))
        ide_result = subprocess.run([
            "pwsh", "-NoProfile", "-NonInteractive", "-Command",
            "$ErrorActionPreference='Stop'; $items=@(Get-Process -Name Code -ErrorAction SilentlyContinue | ForEach-Object { @{pid=$_.Id;name=$_.ProcessName} }); ConvertTo-Json -InputObject $items -Compress",
        ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15)
        ide = json.loads(ide_result.stdout) if ide_result.returncode == 0 else []
        source = runtime.get("sourceProcesses", {})
        adb = runtime.get("adb", {})
        docker = runtime.get("docker", {})
        values = {
            "at": runtime.get("at"), "http": runtime.get("http", []),
            "backendJavaPortOwners": source.get("backend8081Owners", []),
            "webNodePortOwners": source.get("web3000Owners", []),
            "dartHostCandidates": source.get("flutterDartCandidates", []),
            "mobileDevice": adb.get("device"), "mobilePackage": adb.get("package"),
            "mobilePackagePids": adb.get("packagePids", []),
            "ideProcesses": ide, "docker": docker,
            "javaOwns8081": source.get("javaOwns8081") is True,
            "nodeOwns3000": source.get("nodeOwns3000") is True,
            "mobilePackageRunning": adb.get("packageInstalled") is True and bool(adb.get("packagePids")),
            "dartHostPresent": bool(source.get("flutterDartCandidates")),
            "ideProcessPresent": bool(ide),
            "noApplicationContainersActive": docker.get("onlyDependenciesRunning") is True,
            "debug5005Owners": source.get("javaDebug5005Owners", []),
            "debug9006ForwardPresent": adb.get("forward9006Present"),
            "ideAttachmentAttested": False,
            "scope": "Native app process/port and VS Code process checkpoint; no command lines, VM URI, debugger attach state or IDE UI inspected. Debug port availability is informational.",
        }
        values["status"] = "PASS" if all(values[key] for key in (
            "javaOwns8081", "nodeOwns3000", "mobilePackageRunning", "dartHostPresent",
            "ideProcessPresent", "noApplicationContainersActive")) and docker.get("status") == "PASS" else "FAIL"
        return values
    except Exception:
        return {"status": "UNAVAILABLE", "reason": "RUNTIME_CHECK_UNAVAILABLE"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=int, choices=range(1, 16), default=8)
    parser.add_argument("--human-breakpoint-confirmed", action="store_true",
                        help="Record the human-confirmed Java line 41 breakpoint with id49/stack; does not claim screenshot inspection.")
    args = parser.parse_args(argv)
    report = {
        "at": now(), "mode": "READ_ONLY_GET_AND_SQL", "routeId": 22,
        "expectedOrders": [{"id": oid, "tracking": tracking, "status": status}
                           for oid, (tracking, status) in EXPECTED.items()],
        "expectedRouteStatus": "COMPLETED", "http": [], "checks": [],
        "businessMutationPerformed": False, "sqlExecuted": False, "sqlWrites": False,
        "queueSynchronizationInvoked": False,
        "scope": "Sequential server snapshot after human actions; does not inspect the local mobile queue or prove UI/IDE interaction.",
    }
    report["ideBreakpointProof"] = {
        "status": "PASS" if args.human_breakpoint_confirmed else "NOT_ATTESTED",
        "provenance": "EXPLICIT_HUMAN_REPORT" if args.human_breakpoint_confirmed else None,
        "details": "Java breakpoint line 41 with variable id=49 and stack captured in the real IDE, as reported by the human.",
        "captureInspectedByVerifier": False,
        "note": "Breakpoint was being removed and execution resumed by the human before the final retry; current attachment is not inferred from the earlier capture.",
    }
    health_summary = ROOT / "docs/guia_total_ide/ejecucion_20261026/sourcecode_healthtests_summary.json"
    if health_summary.is_file():
        summary = json.loads(health_summary.read_text(encoding="utf-8"))
        report["sourceCodeHealthTests"] = {
            key: summary.get(key) for key in (
                "status", "worker", "passed", "total", "provenance",
                "independentlyReexecutedByThisVerifier", "individualTestLogsInspected", "npmFullTest")
        }
    reader = LocalReader(report, args.timeout)

    def check(name, passed):
        report["checks"].append({"name": name, "status": "PASS" if passed else "FAIL"})

    try:
        reader.authenticate()
        status, identity = reader.get("/session/me")
        roles = [(item.get("authority", "") if isinstance(item, dict) else item)
                 for item in (identity or {}).get("roles", [])]
        if status != 200 or not any(role in ("ADMIN", "ROLE_ADMIN") for role in roles):
            raise VerificationUnavailable("EFFECTIVE_ADMIN_REQUIRED")
        report["orders"] = []
        for order_id, (tracking, expected_status) in EXPECTED.items():
            status, order = reader.get(f"/orders/{order_id}")
            order = order or {}
            observed = {key: order.get(key) for key in ("id", "trackingNumber", "routeId", "status")}
            observed["httpStatus"] = status
            report["orders"].append(observed)
            check(f"ORDER_{order_id}_{expected_status}", status == 200
                  and order.get("id") == order_id and order.get("trackingNumber") == tracking
                  and order.get("routeId") == 22 and order.get("status") == expected_status)

        status, route_orders = reader.get("/orders?routeId=22")
        check("ROUTE_EXACT_THREE_ORDERS", status == 200
              and len(route_orders or []) == 3
              and {order.get("id") for order in (route_orders or [])} == set(EXPECTED))
        status, routes = reader.get("/routes?date=2026-10-26")
        route = next((item for item in (routes or []) if item.get("id") == 22), {})
        report["route"] = {key: route.get(key) for key in
                           ("id", "status", "driverId", "vehicleId", "actualStartTime", "actualEndTime", "totalDistanceKm")}
        check("ROUTE_22_COMPLETED", status == 200 and route.get("status") == "COMPLETED")
        check("ROUTE_START_END_RECORDED", bool(route.get("actualStartTime")) and bool(route.get("actualEndTime")))
        check("ROUTE_PLANNED_DISTANCE_NONZERO", (route.get("totalDistanceKm") or 0) > 0)
        status, review = reader.get("/routes/22/review")
        review = review or {}
        report["review"] = {key: review.get(key) for key in ("approved", "accepted", "approvedAt", "acceptedAt")}
        check("REVIEW_APPROVED_AND_ACCEPTED", status == 200
              and review.get("approved") is True and review.get("accepted") is True)

        report["proofs"] = []
        for order_id in EXPECTED:
            status, proof = reader.get(f"/delivery-proofs/{order_id}")
            observed = {"orderId": order_id, "httpStatus": status, "present": status == 200}
            if order_id == 48:
                proof = proof or {}
                observed.update(
                    receiverNamePresent=bool(proof.get("receiverName")),
                    receiverDniPresent=bool(proof.get("receiverDni")),
                    verifiedAtPresent=bool(proof.get("verifiedAt")),
                    photoMetadataPresent=bool(proof.get("imageUrl")),
                    signatureMetadataPresent=bool(proof.get("signatureDataUrl")),
                    gpsValid=valid_gps(proof.get("latitude"), proof.get("longitude")),
                )
                check("POD_48_REMOTE_METADATA_COMPLETE", status == 200
                      and proof.get("orderId") == 48
                      and all(observed[key] for key in (
                          "receiverNamePresent", "receiverDniPresent", "verifiedAtPresent",
                          "photoMetadataPresent", "signatureMetadataPresent", "gpsValid")))
            else:
                check(f"NO_POD_FOR_{order_id}", status == 404)
            report["proofs"].append(observed)

        report["pod48Assets"] = []
        for kind in ("photo", "signature", "pdf"):
            status, asset = reader.get(f"/delivery-proofs/48/{kind}", hash_asset=True)
            asset = asset or {}
            media_type = asset.get("mediaType")
            report["pod48Assets"].append({"kind": kind, "httpStatus": status, **asset})
            check("POD_48_" + kind.upper() + "_AVAILABLE", status == 200 and
                  asset.get("byteCount", 0) > 0 and
                  (media_type == "application/pdf" and asset.get("recognizedPdf") if kind == "pdf"
                   else media_type in ("image/jpeg", "image/png") and asset.get("recognizedImage")))

        status, incidents = reader.get("/incidents")
        matching = [item for item in (incidents or [])
                    if item.get("routeId") == 22 and item.get("orderId") in (49, 50)]
        report["incidents"] = [{key: item.get(key) for key in
                                ("id", "routeId", "orderId", "incidentType", "status", "outcome")}
                               for item in matching]
        for order_id in (49, 50):
            check(f"UNIQUE_INCIDENT_FOR_{order_id}", status == 200
                  and len([item for item in matching if item.get("orderId") == order_id]) == 1)
        check("INCIDENT_14_CLOSE_FAILED", any(
            item.get("id") == 14 and item.get("orderId") == 49
            and item.get("status") == "RESOLVED" and item.get("outcome") == "CLOSE_FAILED"
            for item in matching))
        check("RETURNED_50_INCIDENT_15_CLOSED_FAILED", any(
            item.get("id") == 15 and item.get("orderId") == 50
            and item.get("incidentType") == "DELIVERY_FAILED"
            and item.get("status") == "RESOLVED" and item.get("outcome") == "CLOSE_FAILED"
            for item in matching))
        status, actions = reader.get("/improvement-actions")
        action = next((item for item in (actions or []) if item.get("id") == 8), {})
        report["action8"] = {key: action.get(key) for key in
                             ("id", "status", "metricCode", "dueDate", "resultValue", "targetValue")}
        result_value, target_value = action.get("resultValue"), action.get("targetValue")
        report["action8"].update(
            targetAchievementRequired=False, causalImprovementClaimedByVerifier=False,
            observedBelowTarget=(result_value < target_value
                                 if isinstance(result_value, (int, float))
                                 and isinstance(target_value, (int, float)) else None),
            explicitCausalLimitationNote=bool(re.search(
                r"caus|sin.{0,40}mejor|no.{0,40}mejor", str(action.get("note", "")), re.I)),
        )
        check("ACTION_8_VERIFIED_RESULT_33_33_TARGET_90", status == 200
              and action.get("id") == 8 and action.get("status") == "VERIFIED"
              and isinstance(result_value, (int, float)) and math.isclose(result_value, 33.33, abs_tol=0.01)
              and target_value == 90)
        check("ACTION_8_CAUSAL_LIMITATION_RECORDED", report["action8"]["explicitCausalLimitationNote"])

        integrity = database_integrity()
        report["databaseIntegrity"] = integrity
        report["sqlExecuted"] = integrity.get("transactionReadOnly") == "on"
        check("SQL_TRANSACTION_READ_ONLY", integrity.get("status") == "PASS")
        check("UNIQUE_PROOF_48", integrity.get("proofCount48") == 1)
        check("UNIQUE_DELIVERY_OUTBOX_48", integrity.get("outbox48") == 1)
        check("UNIQUE_DELIVERY_NOTIFICATION_48", integrity.get("notification48") == 1)
        hashes = (integrity.get("proofHashes") or [{}])[0]
        assets = {asset["kind"]: asset for asset in report["pod48Assets"]}
        for kind, column in (("photo", "photoSha256"), ("signature", "signatureSha256")):
            stored = hashes.get(column)
            check("POD_48_" + kind.upper() + "_SHA256_MATCH",
                  bool(stored) and bool(re.fullmatch(r"[0-9a-fA-F]{64}", stored))
                  and assets[kind].get("sha256") == stored.lower())
        check("POD_48_CAPTURE_AND_RECEIVE_TIMESTAMPS", bool(hashes.get("capturedAt")) and bool(hashes.get("receivedAt")))
        transitions = {(item["order_id"], item["status"]): item["count"]
                       for item in integrity.get("transitionCounts", []) or []}
        expected_transitions = {(oid, "IN_TRANSIT") for oid in EXPECTED} | {
            (oid, state) for oid, (tracking, state) in EXPECTED.items()}
        check("UNIQUE_EXPECTED_TRANSITIONS_ONLY", set(transitions) == expected_transitions
              and all(count == 1 for count in transitions.values()))
        check("UNIQUE_DRIVER_ACCEPTANCE", integrity.get("driverAcceptanceEvents") == 1)
        check("UNIQUE_CLOSE_FAILED_14_EVENT", integrity.get("closeFailed14Events") == 1)
        check("UNIQUE_CLOSE_FAILED_15_EVENT", integrity.get("closeFailed15Events") == 1)
        if args.human_breakpoint_confirmed:
            check("BREAKPOINT_JAVA_LINE_41_ID49_STACK_HUMAN_CONFIRMED", True)
        # Two plan approvals are intentional: the third waypoint renewed review.
        report["planApprovalHistoryNote"] = "Original review and authorized third-stop revision are separate approvals; their count is not treated as duplicate delivery."
        checkpoint = runtime_checkpoint()
        report["runtimeCheckpoint"] = checkpoint
        check("NATIVE_THREE_APPS_IDE_PROCESS_NO_APP_CONTAINERS", checkpoint.get("status") == "PASS")
        report["status"] = "PASS" if all(item["status"] == "PASS" for item in report["checks"]) else "FAIL"
    except VerificationUnavailable as error:
        report.update(status="UNAVAILABLE", reason=str(error))
    except Exception as error:
        # Exception messages can contain URLs/headers; retain the type only.
        report.update(status="UNAVAILABLE", errorType=type(error).__name__)
    finally:
        reader.token = None
        report["completedAt"] = now()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "orders": [{"id": item.get("id"), "status": item.get("status")}
                   for item in report.get("orders", [])],
        "routeStatus": report.get("route", {}).get("status"),
        "failedChecks": [item["name"] for item in report["checks"] if item["status"] == "FAIL"],
        "report": "docs/guia_total_ide/ejecucion_20261026/business_final.json",
    }, ensure_ascii=False))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
