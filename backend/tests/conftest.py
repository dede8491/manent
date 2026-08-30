import os, uuid, pytest, requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Fallback to frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(api):
    """Register a fresh user, return token+user."""
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    body = {"email": email, "password": "Test1234!", "pseudo": f"Tester{uuid.uuid4().hex[:4]}"}
    r = api.post(f"{BASE_URL}/api/auth/register", json=body)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    return {"token": d["session_token"], "user": d["user"], "email": email, "password": body["password"], "pseudo": body["pseudo"]}


@pytest.fixture(scope="session")
def auth_headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}
