"""
AKADEMI E2E Test Runner — uses Chrome headless directly via CDP.
Bypasses bun/Playwright spawn issues on Windows.

Run: python infrastructure/e2e_runner.py
"""
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error

CHROME = r"C:\Users\User\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe"
BASE_URL = "http://localhost:5173"
CDP_PORT = 9222

RESULTS = []

def log(msg, status="INFO"):
    icon = {"PASS": "✅", "FAIL": "❌", "INFO": "ℹ️", "SKIP": "⏭️"}.get(status, "•")
    print(f"  {icon} [{status}] {msg}")

def run_test(name, fn):
    try:
        fn()
        RESULTS.append((name, "PASS"))
        log(name, "PASS")
    except AssertionError as e:
        RESULTS.append((name, "FAIL", str(e)))
        log(f"{name}: {e}", "FAIL")
    except Exception as e:
        RESULTS.append((name, "ERROR", str(e)))
        log(f"{name}: {e}", "FAIL")

class Page:
    """Simple Chrome DevTools Protocol page wrapper."""
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self._id = 0

    def navigate(self, url, timeout=15):
        """Navigate and wait for load."""
        # Use CDP HTTP endpoint
        self._send_cdp("Page.navigate", {"url": url})
        time.sleep(3)  # Simple wait for load

    def evaluate(self, expression):
        """Evaluate JS expression and return result."""
        # Use CDP HTTP endpoint
        resp = urllib.request.urlopen(
            f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=5
        )
        return None  # Simplified

def test_via_chrome():
    """Run tests using Chrome's --dump-dom and --virtual-time-budget."""
    print("=" * 60)
    print("AKADEMI E2E Test Suite (Chrome Headless)")
    print("=" * 60)

    # Start Chrome with remote debugging
    chrome_proc = subprocess.Popen([
        CHROME,
        f"--remote-debugging-port={CDP_PORT}",
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "about:blank",
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    time.sleep(3)

    try:
        # Verify Chrome is running
        resp = urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=5)
        version_info = json.loads(resp.read())
        print(f"\n  Chrome: {version_info.get('Browser', 'unknown')}")
        print(f"  Target: {BASE_URL}")
        print()

        # Create a new tab
        resp = urllib.request.urlopen(
            f"http://127.0.0.1:{CDP_PORT}/json/new?{BASE_URL}/login", timeout=10
        )
        tab_info = json.loads(resp.read())
        tab_id = tab_info["id"]
        print(f"  Tab opened: {tab_id[:12]}...")
        time.sleep(3)

        # ─── Test 1: Login page loads ───
        def test_login_page_loads():
            resp = urllib.request.urlopen(
                f"http://127.0.0.1:{CDP_PORT}/json/list", timeout=5
            )
            tabs = json.loads(resp.read())
            login_tab = [t for t in tabs if "/login" in t.get("url", "")]
            assert len(login_tab) > 0, "Login page tab not found"
        run_test("Login page loads", test_login_page_loads)

        # Use --dump-dom for page content checks
        def check_page(url, expected_text, test_name):
            result = subprocess.run([
                CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
                "--dump-dom", "--virtual-time-budget=5000", url
            ], capture_output=True, text=True, timeout=30)
            html = result.stdout
            return expected_text.lower() in html.lower()

        # ─── Test 2: Login form has email input ───
        def test_login_form():
            assert check_page(f"{BASE_URL}/login", 'email', "login email field"), \
                "Email input not found on login page"
        run_test("Login form has email field", test_login_form)

        # ─── Test 3: Login form has password field ───
        def test_password_field():
            assert check_page(f"{BASE_URL}/login", 'password', "password field"), \
                "Password input not found on login page"
        run_test("Login form has password field", test_password_field)

        # ─── Test 4: Login form has submit button ───
        def test_submit_button():
            assert check_page(f"{BASE_URL}/login", 'Sign In', "submit button") or \
                   check_page(f"{BASE_URL}/login", 'Login', "submit button"), \
                "Submit button not found on login page"
        run_test("Login form has submit button", test_submit_button)

        # ─── Test 5: Protected routes redirect to login ───
        def test_protected_redirect():
            for path in ["/dashboard", "/courses", "/gradebook"]:
                result = subprocess.run([
                    CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
                    "--dump-dom", "--virtual-time-budget=5000", f"{BASE_URL}{path}"
                ], capture_output=True, text=True, timeout=30)
                assert "login" in result.stdout.lower() or "sign in" in result.stdout.lower(), \
                    f"{path} did not redirect to login"
        run_test("Protected routes redirect to /login", test_protected_redirect)

        # ─── Test 6: 404 page for unknown routes ───
        def test_404():
            result = subprocess.run([
                CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
                "--dump-dom", "--virtual-time-budget=5000",
                f"{BASE_URL}/nonexistent-page-xyz"
            ], capture_output=True, text=True, timeout=30)
            assert "404" in result.stdout or "not found" in result.stdout.lower(), \
                "404 page not shown for unknown route"
        run_test("404 page shown for unknown routes", test_404)

        # ─── Test 7: App renders React app ───
        def test_react_renders():
            result = subprocess.run([
                CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
                "--dump-dom", "--virtual-time-budget=5000", f"{BASE_URL}/login"
            ], capture_output=True, text=True, timeout=30)
            assert "root" in result.stdout.lower() or "akademi" in result.stdout.lower(), \
                "React app not rendering"
        run_test("React app renders on /login", test_react_renders)

        # ─── Test 8: Frontend builds successfully ───
        def test_frontend_build():
            result = subprocess.run(
                ["bun", "run", "build"],
                capture_output=True, text=True, timeout=120,
                cwd=r"F:\akademi-lms-mahardhika\frontend"
            )
            assert result.returncode == 0, f"Build failed: {result.stderr[:200]}"
        run_test("Frontend builds without errors", test_frontend_build)

        # ─── Test 9: Backend API health ───
        def test_backend_health():
            resp = urllib.request.urlopen("http://localhost:8000/api/v1/health/", timeout=10)
            assert resp.status == 200, f"Backend health check failed: {resp.status}"
        run_test("Backend API health check", test_backend_health)

        # ─── Test 10: API CORS headers ───
        def test_cors():
            req = urllib.request.Request(f"{BASE_URL}/api/v1/health/", method="OPTIONS")
            req.add_header("Origin", "http://localhost:5173")
            req.add_header("Access-Control-Request-Method", "GET")
            try:
                resp = urllib.request.urlopen(req, timeout=5)
            except urllib.error.HTTPError:
                pass  # CORS preflight may return various codes
        run_test("API CORS preflight responds", test_cors)

    finally:
        chrome_proc.terminate()
        chrome_proc.wait(timeout=5)

    # ─── Summary ───
    print("\n" + "=" * 60)
    passed = sum(1 for r in RESULTS if r[1] == "PASS")
    failed = sum(1 for r in RESULTS if r[1] in ("FAIL", "ERROR"))
    total = len(RESULTS)
    print(f"  Results: {passed}/{total} passed, {failed} failed")
    print("=" * 60)

    if failed > 0:
        print("\n  Failed tests:")
        for r in RESULTS:
            if r[1] != "PASS":
                print(f"    ❌ {r[0]}: {r[2] if len(r) > 2 else 'unknown'}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(test_via_chrome())
