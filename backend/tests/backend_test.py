"""End-to-end backend tests for 10Rs Baithulmal API.

Covers: auth, people (donors/beneficiaries/workers) lookup+create, loans (kadan +
vattiyilla), repay/extend/block/unblock, sadakah, payments (admin/collector),
approvals, expenses, accounts summary + user-outstanding, reports (daily/monthly/
yearly/custom/individual), admin user CRUD, collector RBAC.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://baithulmal-charity.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@baithulmal.com"
ADMIN_PASSWORD = "admin123"

TAG = uuid.uuid4().hex[:8]


def _is_test_user(u):
    email = (u.get("email") or "").lower()
    name = u.get("name") or ""
    return email.endswith("@test.com") or name.startswith("TEST_")


def _free_role_slot(admin_client, role, limit=4):
    users = admin_client.get(f"{API}/admin/users").json()
    active = [u for u in users if u.get("role") == role and u.get("is_active", True)]
    if len(active) < limit:
        return
    for u in active:
        if _is_test_user(u):
            admin_client.patch(f"{API}/admin/users/{u['id']}", json={"is_active": False})
            return
    raise AssertionError(f"No test {role} slot available (limit {limit})")

# --- fixtures --------------------------------------------------------------


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def collector_creds(admin_client):
    _free_role_slot(admin_client, "payment_collector")
    email = f"collector_{TAG}@test.com"
    password = "coll1234"
    r = admin_client.post(f"{API}/admin/users", json={
        "email": email, "password": password, "name": f"TEST_Collector_{TAG}", "role": "payment_collector"
    })
    assert r.status_code == 200, r.text
    creds = {"email": email, "password": password, "id": r.json()["id"]}
    yield creds
    admin_client.patch(f"{API}/admin/users/{creds['id']}", json={"is_active": False})
    admin_client.delete(f"{API}/admin/users/{creds['id']}")


@pytest.fixture(scope="session")
def collector_client(collector_creds):
    r = requests.post(f"{API}/auth/login", json={"email": collector_creds["email"], "password": collector_creds["password"]})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def created_people(admin_client):
    """Create a donor, beneficiary and worker used across the suite."""
    out = {}
    for kind, prefix in [("donors", "D"), ("beneficiaries", "B"), ("workers", "W")]:
        contact = f"9{prefix}{TAG}{int(time.time()) % 100000}"[:14]
        r = admin_client.post(f"{API}/people/{kind}", json={
            "name": f"TEST_{kind}_{TAG}",
            "father_name": "TEST_Father",
            "address": "Line 1, City",
            "contact": contact,
            "area": "Area A",
            **({"aadhar_number": str(100000000000 + (uuid.uuid4().int % 900000000000))} if kind == "beneficiaries" else {}),
        })
        assert r.status_code == 200, f"{kind}: {r.text}"
        out[kind] = r.json()
    return out


# --- auth ------------------------------------------------------------------


class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "accountant_admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_client):
        r = admin_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- people ----------------------------------------------------------------


class TestPeople:
    @pytest.mark.parametrize("kind", ["donors", "beneficiaries", "workers"])
    def test_lookup_and_create(self, admin_client, kind):
        contact = f"lu{kind[:2]}{TAG}{uuid.uuid4().hex[:6]}"
        # not exists
        r = admin_client.get(f"{API}/people/{kind}/lookup", params={"contact": contact})
        assert r.status_code == 200
        assert r.json()["exists"] is False
        # create
        r = admin_client.post(f"{API}/people/{kind}", json={
            "name": f"TEST_{kind}_lu_{TAG}", "father_name": "F", "address": "A", "contact": contact, "area": "X",
            **({"aadhar_number": str(100000000000 + (uuid.uuid4().int % 900000000000))} if kind == "beneficiaries" else {}),
        })
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["contact"] == contact
        assert "serial" in created
        # duplicate
        r2 = admin_client.post(f"{API}/people/{kind}", json={
            "name": "dup", "father_name": "F", "address": "A", "contact": contact
        })
        assert r2.status_code == 400
        # lookup exists=true
        r3 = admin_client.get(f"{API}/people/{kind}/lookup", params={"contact": contact})
        assert r3.status_code == 200
        assert r3.json()["exists"] is True
        assert r3.json()["record"]["id"] == created["id"]
        if kind == "beneficiaries":
            r4 = admin_client.get(f"{API}/people/{kind}/lookup", params={"aadhar_number": created["aadhar_number"]})
            assert r4.status_code == 200
            assert r4.json()["exists"] is True
            assert r4.json()["record"]["id"] == created["id"]
            duplicate_aadhaar = admin_client.post(f"{API}/people/{kind}", json={
                "name": f"TEST_duplicate_{TAG}",
                "father_name": "F",
                "address": "A",
                "contact": f"dup{uuid.uuid4().hex[:10]}",
                "aadhar_number": created["aadhar_number"],
            })
            assert duplicate_aadhaar.status_code == 400

    def test_list(self, admin_client, created_people):
        r = admin_client.get(f"{API}/people/donors")
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert created_people["donors"]["id"] in ids


# --- loans -----------------------------------------------------------------


class TestLoans:
    def _make_loan(self, client, beneficiary_id, kadan_type="kadan", amount=1000, months=2):
        member = client.post(f"{API}/ymsk-members", json={
            "name": f"TEST_Security_{TAG}_{uuid.uuid4().hex[:6]}",
            "father_name": "TEST_Father",
            "date_of_birth": "1990-01-01",
            "address": "TEST_Address",
            "contact": f"9{uuid.uuid4().int % 1000000000:09d}",
            "member_type": "member",
        })
        assert member.status_code == 200, member.text
        return client.post(f"{API}/loans", json={
            "beneficiary_id": beneficiary_id,
            "category": "Medical",
            "amount": amount,
            "repayment_months": months,
            "area": "Area A",
            "security": {"member_id": member.json()["id"]},
            "kadan_type": kadan_type,
            "notes": ""
        })

    def _approve(self, client, loan_id):
        return client.post(f"{API}/loans/{loan_id}/approve", json={"approve": True})

    def test_create_kadan(self, admin_client, created_people):
        r = self._make_loan(admin_client, created_people["beneficiaries"]["id"])
        assert r.status_code == 200, r.text
        loan = r.json()
        assert loan["status"] == "pending"
        assert loan["kadan_type"] == "kadan"
        assert loan["total_paid"] == 0.0
        approved = self._approve(admin_client, loan["id"])
        assert approved.status_code == 200
        assert approved.json()["status"] == "active"

    def test_create_vattiyilla(self, admin_client, created_people):
        r = self._make_loan(admin_client, created_people["beneficiaries"]["id"], kadan_type="vattiyilla", amount=500)
        assert r.status_code == 200
        assert r.json()["kadan_type"] == "vattiyilla"
        assert r.json()["status"] == "pending"
        assert r.json()["approval_stage"] == "first_head"

    def test_manual_security_is_rejected(self, admin_client, created_people):
        response = admin_client.post(f"{API}/loans", json={
            "beneficiary_id": created_people["beneficiaries"]["id"],
            "category": "Medical",
            "amount": 100,
            "repayment_months": 1,
            "area": "Area A",
            "security": {"name": "Manual", "father_name": "F", "address": "A", "contact": "999"},
            "kadan_type": "kadan",
        })
        assert response.status_code == 400
        assert "YMSK" in response.json()["detail"]

    def test_repay_closes_loan(self, admin_client, created_people):
        r = self._make_loan(admin_client, created_people["beneficiaries"]["id"], amount=300)
        lid = r.json()["id"]
        assert self._approve(admin_client, lid).json()["status"] == "active"
        # partial
        rp1 = admin_client.post(f"{API}/loans/{lid}/repay", json={"amount": 100})
        assert rp1.status_code == 200
        assert rp1.json()["total_paid"] == 100.0
        assert rp1.json()["status"] == "active"
        overpayment = admin_client.post(f"{API}/loans/{lid}/repay", json={"amount": 201})
        assert overpayment.status_code == 400
        assert "outstanding balance" in overpayment.json()["detail"].lower()
        assert admin_client.get(f"{API}/loans/{lid}").json()["total_paid"] == 100.0
        # closing
        rp2 = admin_client.post(f"{API}/loans/{lid}/repay", json={"amount": 200})
        assert rp2.status_code == 200
        assert rp2.json()["total_paid"] == 300.0
        assert rp2.json()["status"] == "closed"
        # get verifies persistence
        g = admin_client.get(f"{API}/loans/{lid}")
        assert g.json()["status"] == "closed"

    def test_extend_admin(self, admin_client, created_people):
        r = self._make_loan(admin_client, created_people["beneficiaries"]["id"], amount=100)
        lid = r.json()["id"]
        self._approve(admin_client, lid)
        old_due = r.json()["due_date"]
        ex = admin_client.post(f"{API}/loans/{lid}/extend", json={"additional_months": 3, "note": "n"})
        assert ex.status_code == 200
        data = ex.json()
        assert data["due_date"] > old_due
        assert data["status"] == "active"
        assert len(data.get("extension_history", [])) == 1

    def test_block_unblock(self, admin_client, created_people):
        r = self._make_loan(admin_client, created_people["beneficiaries"]["id"], amount=100)
        lid = r.json()["id"]
        self._approve(admin_client, lid)
        b = admin_client.post(f"{API}/loans/{lid}/block", json={"reason": "fraud", "block_months": 2})
        assert b.status_code == 200
        assert b.json()["status"] == "blocked"
        assert b.json()["block_info"]["reason"] == "fraud"
        # verify persistence
        assert admin_client.get(f"{API}/loans/{lid}").json()["status"] == "blocked"
        u = admin_client.post(f"{API}/loans/{lid}/unblock")
        assert u.status_code == 200
        assert u.json()["block_info"] is None
        assert u.json()["status"] in ("active", "time_limit_exceed")


# --- sadakah ---------------------------------------------------------------


class TestSadakah:
    def test_create(self, admin_client, created_people):
        r = admin_client.post(f"{API}/sadakah", json={
            "beneficiary_id": created_people["beneficiaries"]["id"], "amount": 250, "purpose_type": "medical", "note": "t"
        })
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 250.0
        assert r.json()["purpose_type"] == "medical"

    def test_others_requires_description(self, admin_client, created_people):
        r = admin_client.post(f"{API}/sadakah", json={
            "beneficiary_id": created_people["beneficiaries"]["id"], "amount": 250, "purpose_type": "others"
        })
        assert r.status_code == 400

    def test_list_contains(self, admin_client, created_people):
        r = admin_client.get(f"{API}/sadakah")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- payments --------------------------------------------------------------


class TestPayments:
    def test_admin_creates_approved(self, admin_client, created_people):
        r = admin_client.post(f"{API}/payments", json={
            "donor_id": created_people["donors"]["id"],
            "collection_date": "2026-01-15", "amount_per_month": 10.0
        })
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "approved"
        assert p["collection_date"] == "2026-01-15"
        assert p["total_amount"] == 10.0
        assert p["receipt_no"].startswith("10RS")

    def test_collector_pending_and_approve(self, admin_client, collector_client, created_people):
        # collector needs another donor (unique contact each)
        contact = f"pc{TAG}{uuid.uuid4().hex[:6]}"
        d = admin_client.post(f"{API}/people/donors", json={
            "name": "TEST_D2", "father_name": "F", "address": "A", "contact": contact
        }).json()
        r = collector_client.post(f"{API}/payments", json={
            "donor_id": d["id"], "collection_date": "2026-02-10", "amount_per_month": 10.0
        })
        assert r.status_code == 200
        assert r.json()["status"] == "pending"
        pid = r.json()["id"]
        # list pending as admin
        pending = admin_client.get(f"{API}/payments/pending").json()
        assert any(p["id"] == pid for p in pending)
        # approve
        ap = admin_client.post(f"{API}/payments/{pid}/approve", json={"approve": True})
        assert ap.status_code == 200
        assert ap.json()["status"] == "approved"

    def test_collector_collection_report_uses_collected_date(self, admin_client, collector_client, collector_creds, created_people):
        collected_date = "2099-04-17"
        period_date = "2026-04-01"
        payments = []
        for amount in (15, 25):
            response = collector_client.post(f"{API}/payments", json={
                "donor_id": created_people["donors"]["id"],
                "collection_date": period_date,
                "collected_date": collected_date,
                "amount": amount,
            })
            assert response.status_code == 200, response.text
            payments.append(response.json())

        report = admin_client.get(
            f"{API}/reports/collector-collections",
            params={"collection_date": collected_date, "collector_id": collector_creds["id"]},
        )
        assert report.status_code == 200, report.text
        data = report.json()
        assert data["collections"] >= 2
        assert data["total_amount"] >= 40
        assert all(row["collected_date"] == collected_date for row in data["records"])
        assert {payment["id"] for payment in payments}.issubset({row["id"] for row in data["records"]})
        all_collectors = admin_client.get(
            f"{API}/reports/collector-collections",
            params={"collection_date": collected_date},
        )
        assert all_collectors.status_code == 200, all_collectors.text
        all_data = all_collectors.json()
        assert {payment["id"] for payment in payments}.issubset({row["id"] for row in all_data["records"]})
        assert any(row["collector_id"] == collector_creds["id"] for row in all_data["collectors"])
        collector_totals = admin_client.get(f"{API}/payments/collectors")
        assert collector_totals.status_code == 200
        assert any(row["id"] == collector_creds["id"] and row["total"] >= 40 for row in collector_totals.json())

    def test_reports_keep_payment_and_vi_sources_separate(self, admin_client, created_people):
        payment = admin_client.post(f"{API}/payments", json={
            "donor_id": created_people["donors"]["id"],
            "collection_date": "2026-05-01",
            "collected_date": "2099-04-18",
            "amount": 17,
        })
        assert payment.status_code == 200, payment.text
        baithulmal = admin_client.get(f"{API}/reports/baithulmal", params={
            "date_from": "2099-04-18", "date_to": "2099-04-18",
        })
        assert baithulmal.status_code == 200, baithulmal.text
        assert payment.json()["id"] in {row["id"] for row in baithulmal.json()["records"]}
        assert all("kadan_type" not in row for row in baithulmal.json()["records"])

        member = admin_client.post(f"{API}/ymsk-members", json={
            "name": f"TEST_VI_Security_{TAG}",
            "father_name": "TEST_Father",
            "date_of_birth": "1990-01-01",
            "address": "TEST_Address",
            "contact": f"9{uuid.uuid4().int % 1000000000:09d}",
            "member_type": "member",
        })
        assert member.status_code == 200, member.text
        loan = admin_client.post(f"{API}/loans", json={
            "beneficiary_id": created_people["beneficiaries"]["id"],
            "category": "Medical",
            "amount": 100,
            "repayment_months": 1,
            "area": "Area A",
            "security": {"member_id": member.json()["id"]},
            "kadan_type": "vattiyilla",
        })
        assert loan.status_code == 200, loan.text
        application_date = loan.json()["created_at"][:10]
        vi = admin_client.get(f"{API}/reports/vi", params={
            "date_from": application_date, "date_to": application_date,
        })
        assert vi.status_code == 200, vi.text
        assert loan.json()["id"] in {row["id"] for row in vi.json()["loans"]}
        assert all(row["kadan_type"] == "vattiyilla" for row in vi.json()["loans"])

    def test_invalid_date(self, admin_client, created_people):
        r = admin_client.post(f"{API}/payments", json={
            "donor_id": created_people["donors"]["id"],
            "collection_date": "2026-13-40", "amount_per_month": 10.0
        })
        assert r.status_code == 400


# --- expenses --------------------------------------------------------------


class TestExpenses:
    def test_salary(self, admin_client, created_people):
        r = admin_client.post(f"{API}/expenses", json={
            "kind": "salary", "worker_id": created_people["workers"]["id"], "month": "2026-01", "amount": 500
        })
        assert r.status_code == 200
        assert r.json()["worker"]["id"] == created_people["workers"]["id"]

    def test_maintenance(self, admin_client):
        r = admin_client.post(f"{API}/expenses", json={
            "kind": "maintenance", "category": "Rent", "amount": 200
        })
        assert r.status_code == 200
        assert r.json()["category"] == "Rent"


# --- accounts --------------------------------------------------------------


class TestAccounts:
    def test_summary(self, admin_client):
        r = admin_client.get(f"{API}/accounts/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("balance", "total_collected", "total_pending", "total_expense", "total_sadakah",
                  "total_loan_outstanding", "donors_count", "beneficiaries_count", "workers_count",
                  "loans_active", "loans_blocked"):
            assert k in d, f"missing key {k}"

    def test_user_outstanding_admin_only(self, admin_client, collector_client):
        r = admin_client.get(f"{API}/accounts/user-outstanding")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = collector_client.get(f"{API}/accounts/user-outstanding")
        assert r2.status_code == 403


# --- reports ---------------------------------------------------------------


class TestReports:
    @pytest.mark.parametrize("rng", ["daily", "monthly", "yearly"])
    def test_range(self, admin_client, rng):
        r = admin_client.get(f"{API}/reports", params={"range": rng})
        assert r.status_code == 200, r.text
        for k in ("payments", "expenses", "sadakah", "loans", "totals"):
            assert k in r.json()

    def test_custom(self, admin_client):
        r = admin_client.get(f"{API}/reports", params={"range": "custom", "start": "2026-01-01", "end": "2026-12-31"})
        assert r.status_code == 200
        assert r.json()["range"] == "custom"

    def test_custom_missing(self, admin_client):
        r = admin_client.get(f"{API}/reports", params={"range": "custom"})
        assert r.status_code == 400

    def test_individual(self, admin_client, created_people):
        r = admin_client.get(f"{API}/reports", params={"range": "individual", "donor_id": created_people["donors"]["id"]})
        assert r.status_code == 200
        d = r.json()
        assert d["range"] == "individual"
        assert d["donor"]["id"] == created_people["donors"]["id"]
        assert "total" in d


# --- admin users -----------------------------------------------------------


class TestAdminUsers:
    def test_crud(self, admin_client):
        _free_role_slot(admin_client, "payment_collector")
        email = f"crud_{TAG}_{uuid.uuid4().hex[:4]}@test.com"
        c = admin_client.post(f"{API}/admin/users", json={
            "email": email, "password": "pass1234", "name": "TEST_CRUD", "role": "payment_collector"
        })
        assert c.status_code == 200
        uid = c.json()["id"]
        # list contains
        lst = admin_client.get(f"{API}/admin/users").json()
        assert any(u["id"] == uid for u in lst)
        # patch
        p = admin_client.patch(f"{API}/admin/users/{uid}", json={"name": "TEST_UPD", "password": "new1234"})
        assert p.status_code == 200
        assert p.json()["name"] == "TEST_UPD"
        # login with new password
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": "new1234"})
        assert login.status_code == 200
        # delete
        d = admin_client.delete(f"{API}/admin/users/{uid}")
        assert d.status_code == 200
        # verify gone
        lst2 = admin_client.get(f"{API}/admin/users").json()
        assert not any(u["id"] == uid for u in lst2)


# --- RBAC ------------------------------------------------------------------


class TestRBAC:
    def test_collector_forbidden_admin_endpoints(self, collector_client, created_people):
        # admin users list
        assert collector_client.get(f"{API}/admin/users").status_code == 403
        assert collector_client.get(f"{API}/reports/collector-collections", params={"collection_date": "2026-01-01"}).status_code == 403
        assert collector_client.get(f"{API}/people/donors").status_code == 403
        assert collector_client.get(f"{API}/loans").status_code == 403
        assert collector_client.get(f"{API}/reports").status_code == 403
        # loan extend
        r = collector_client.post(f"{API}/loans/{uuid.uuid4()}/extend", json={"additional_months": 1})
        assert r.status_code == 403
        # payments pending
        assert collector_client.get(f"{API}/payments/pending").status_code == 403
        # user-outstanding covered in accounts tests
        assert collector_client.get(f"{API}/sadakah").status_code == 403
        assert collector_client.get(f"{API}/expenses").status_code == 403
        assert collector_client.get(f"{API}/people/beneficiaries").status_code == 403
        assert collector_client.post(f"{API}/people/donors", json={
            "name": "X", "father_name": "F", "address": "A", "contact": f"9{TAG}00000"[:10]
        }).status_code == 403
        # cannot approve
        assert collector_client.post(f"{API}/payments/{uuid.uuid4()}/approve", json={"approve": True}).status_code in (403, 404)

    def test_collector_sees_only_own_payments(self, admin_client, collector_client, collector_creds, created_people):
        admin_pay = admin_client.post(f"{API}/payments", json={
            "donor_id": created_people["donors"]["id"],
            "collection_date": "2026-03-01", "amount_per_month": 10.0
        })
        assert admin_pay.status_code == 200
        own = collector_client.post(f"{API}/payments", json={
            "donor_id": created_people["donors"]["id"],
            "collection_date": "2026-03-02", "amount_per_month": 10.0
        })
        assert own.status_code == 200
        own_id = own.json()["id"]
        listed = collector_client.get(f"{API}/payments")
        assert listed.status_code == 200
        ids = [p["id"] for p in listed.json()]
        assert own_id in ids
        assert admin_pay.json()["id"] not in ids
        assert all(p.get("collected_by") == collector_creds["id"] for p in listed.json())
        # frontend-supplied collector_id must be ignored
        spoof = collector_client.get(f"{API}/payments", params={"collected_by": "someone-else", "user_id": "someone-else"})
        assert spoof.status_code == 200
        assert all(p.get("collected_by") == collector_creds["id"] for p in spoof.json())

    def test_assistant_cannot_approve_or_manage_users(self, admin_client, created_people):
        _free_role_slot(admin_client, "account_assistant")
        email = f"asst_{TAG}@test.com"
        password = "asst1234"
        created = admin_client.post(f"{API}/admin/users", json={
            "email": email, "password": password, "name": f"TEST_Asst_{TAG}", "role": "account_assistant"
        })
        assert created.status_code == 200, created.text
        uid = created.json()["id"]
        try:
            login = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
            assert login.status_code == 200
            assert login.json()["user"]["role"] == "account_assistant"
            s = requests.Session()
            s.headers.update({"Authorization": f"Bearer {login.json()['token']}", "Content-Type": "application/json"})
            pay = s.post(f"{API}/payments", json={
                "donor_id": created_people["donors"]["id"],
                "collection_date": "2026-04-01", "amount_per_month": 10.0
            })
            assert pay.status_code == 200
            assert pay.json()["status"] == "pending"
            assert s.post(f"{API}/payments/{pay.json()['id']}/approve", json={"approve": True}).status_code == 403
            assert s.get(f"{API}/admin/users").status_code == 403
            assert s.post(f"{API}/admin/users", json={
                "email": f"x_{TAG}@test.com", "password": "x1234567", "name": "X", "role": "payment_collector"
            }).status_code == 403
            ledger = s.get(f"{API}/payments")
            assert ledger.status_code == 200
            assert pay.json()["id"] in [p["id"] for p in ledger.json()]
        finally:
            admin_client.patch(f"{API}/admin/users/{uid}", json={"is_active": False})
            admin_client.delete(f"{API}/admin/users/{uid}")

    def test_inactive_user_cannot_login(self, admin_client):
        email = f"inactive_{TAG}@test.com"
        password = "inact1234"
        created = admin_client.post(f"{API}/admin/users", json={
            "email": email, "password": password, "name": "Inactive", "role": "payment_collector", "is_active": False
        })
        assert created.status_code == 200, created.text
        uid = created.json()["id"]
        try:
            off = admin_client.patch(f"{API}/admin/users/{uid}", json={"is_active": False})
            assert off.status_code == 200
            assert off.json()["is_active"] is False
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
            assert r.status_code == 401
        finally:
            admin_client.delete(f"{API}/admin/users/{uid}")

    def test_second_accountant_admin_rejected(self, admin_client):
        email = f"admin2_{TAG}@test.com"
        r = admin_client.post(f"{API}/admin/users", json={
            "email": email, "password": "admin2345", "name": "Second Admin", "role": "accountant_admin"
        })
        assert r.status_code == 400
