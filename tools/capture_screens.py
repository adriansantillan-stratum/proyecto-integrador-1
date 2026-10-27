"""
Captura las pantallas del panel web de EcoRoute para material de
presentacion (prototipos, tesis, pitch comercial).

Requiere el stack local corriendo:
  docker compose up -d postgres keycloak osrm
  ./gradlew.bat bootRun --args="--spring.profiles.active=local"
  cd web-admin && npm run dev

Uso:  python tools/capture_screens.py
Salida: docs/screenshots/web-*.png
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
USER = "admin"
PASSWORD = "admin123"
OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "docs" / "screenshots"

# (ruta, nombre de archivo, espera extra en ms para mapas/graficos)
SCREENS = [
    ("/", "web-01-home", 1200),
    ("/dashboard", "web-02-dashboard", 2500),
    ("/orders", "web-03-pedidos", 2000),
    ("/routes", "web-04-rutas", 3000),
    ("/drivers", "web-05-conductores", 1500),
    ("/vehicles", "web-06-vehiculos", 1500),
    ("/reports", "web-07-reportes", 2500),
]


def login(page):
    page.goto(BASE_URL, wait_until="networkidle")
    page.click("button")  # "Iniciar Sesion" -> redirige a Keycloak
    page.wait_for_selector("#username", timeout=15000)
    page.fill("#username", USER)
    page.fill("#password", PASSWORD)
    page.click("#kc-login")
    page.wait_for_url(f"{BASE_URL}/**", timeout=20000)
    page.wait_for_timeout(2000)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900},
                                  device_scale_factor=2)
        page = ctx.new_page()

        print("Autenticando con Keycloak...")
        login(page)
        print("Login OK")

        for path, name, wait_ms in SCREENS:
            page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
            page.wait_for_timeout(wait_ms)
            target = OUT_DIR / f"{name}.png"
            page.screenshot(path=str(target))
            print(f"  {target.name}")

        browser.close()
    print(f"\nListo: {OUT_DIR}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
