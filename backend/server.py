from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import asyncio
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, model_validator

# Mongo
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="10Rs Baithulmal API")
api = APIRouter(prefix="/api")

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("baithulmal")


# ---------------- utils ----------------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


# Roles: accountant_admin (full + approval), account_assistant (full, no approval),
# payment_collector (collection entry only). Legacy aliases are mapped to these values.
ROLE_ACCOUNTANT_ADMIN = "accountant_admin"
ROLE_ACCOUNT_ASSISTANT = "account_assistant"
ROLE_PAYMENT_COLLECTOR = "payment_collector"

LEGACY_ROLE_MAP = {
    ROLE_ACCOUNTANT_ADMIN: ROLE_ACCOUNTANT_ADMIN,
    "admin": ROLE_ACCOUNTANT_ADMIN,
    "co-admin": ROLE_ACCOUNTANT_ADMIN,
    ROLE_ACCOUNT_ASSISTANT: ROLE_ACCOUNT_ASSISTANT,
    "assistant_admin": ROLE_ACCOUNT_ASSISTANT,
    "accountant": ROLE_ACCOUNT_ASSISTANT,
    ROLE_PAYMENT_COLLECTOR: ROLE_PAYMENT_COLLECTOR,
    "collector": ROLE_PAYMENT_COLLECTOR,
    "user": ROLE_PAYMENT_COLLECTOR,
}

ROLE_ALIASES = {
    ROLE_ACCOUNTANT_ADMIN: [ROLE_ACCOUNTANT_ADMIN, "admin", "co-admin"],
    ROLE_ACCOUNT_ASSISTANT: [ROLE_ACCOUNT_ASSISTANT, "assistant_admin", "accountant"],
    ROLE_PAYMENT_COLLECTOR: [ROLE_PAYMENT_COLLECTOR, "collector", "user"],
}

ROLE_ACTIVE_LIMITS = {
    ROLE_ACCOUNTANT_ADMIN: 1,
    ROLE_ACCOUNT_ASSISTANT: 4,
    ROLE_PAYMENT_COLLECTOR: 4,
}

USER_ROLE_VALUES = Literal["accountant_admin", "account_assistant", "payment_collector"]


def canonical_role(role: Optional[str]) -> str:
    if not role:
        return ROLE_PAYMENT_COLLECTOR
    return LEGACY_ROLE_MAP.get(str(role).strip().lower(), ROLE_PAYMENT_COLLECTOR)


def _role(user: dict) -> str:
    return canonical_role((user or {}).get("role"))


def is_accountant_admin(user: dict) -> bool:
    return _role(user) == ROLE_ACCOUNTANT_ADMIN


def is_staff(user: dict) -> bool:
    return _role(user) in {ROLE_ACCOUNTANT_ADMIN, ROLE_ACCOUNT_ASSISTANT}


def is_collector(user: dict) -> bool:
    return _role(user) == ROLE_PAYMENT_COLLECTOR


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": canonical_role(user.get("role")),
        "permissions": user.get("permissions", []),
        "is_active": user.get("is_active", True),
    }


async def count_active_role(role: str, exclude_id: Optional[str] = None) -> int:
    canonical = canonical_role(role)
    query = {
        "role": {"$in": ROLE_ALIASES[canonical]},
        "is_active": {"$ne": False},
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return await db.users.count_documents(query)


async def assert_role_slot_available(role: str, exclude_id: Optional[str] = None):
    canonical = canonical_role(role)
    limit = ROLE_ACTIVE_LIMITS[canonical]
    current = await count_active_role(canonical, exclude_id=exclude_id)
    if current >= limit:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {limit} active {canonical} account(s) allowed",
        )


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    user["role"] = canonical_role(user.get("role"))
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_accountant_admin(user):
        raise HTTPException(status_code=403, detail="Accountant Admin only")
    return user


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    return user


async def require_member(user: dict = Depends(get_current_user)) -> dict:
    return user


async def require_accountant_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_accountant_admin(user):
        raise HTTPException(status_code=403, detail="Payment approval requires Accountant Admin")
    return user


# Backward-compatible alias used by older call sites
require_accountant_or_admin = require_staff


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_ymd() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def new_id() -> str:
    return str(uuid.uuid4())


def generate_person_serial(kind: str) -> str:
    now = datetime.now(timezone.utc)
    prefix = {"donors": "D", "beneficiaries": "B", "workers": "W"}[kind]
    year_month = now.strftime("%Y%m")
    count = awaitable_count = None
    # This helper is used from async functions, so lookup is done in calling code.
    return f"{prefix}{year_month}"


def build_receipt_number() -> str:
    now = datetime.now(timezone.utc)
    return f"10RS{now.strftime('%Y%m')}{int(now.timestamp() * 1000) % 100000:05d}"


# ---------------- Models ----------------
class LoginIn(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: USER_ROLE_VALUES = ROLE_PAYMENT_COLLECTOR
    permissions: List[str] = Field(default_factory=list)
    is_active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[USER_ROLE_VALUES] = None
    permissions: Optional[List[str]] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class PersonBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    father_name: str
    address: str
    contact: str
    area: Optional[str] = ""
    reference: Optional[str] = ""
    aadhar_number: Optional[str] = ""
    registration_date: Optional[str] = None


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    father_name: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None
    area: Optional[str] = None
    reference: Optional[str] = None
    aadhar_number: Optional[str] = None
    registration_date: Optional[str] = None


class SecurityDetail(BaseModel):
    name: str
    father_name: str
    address: str
    contact: str


class KadanIn(BaseModel):
    beneficiary_id: str
    category: Literal["Medical", "Education", "Economic"]
    amount: float
    repayment_months: int
    area: str
    security: SecurityDetail
    kadan_type: Literal["kadan", "vattiyilla"] = "kadan"
    notes: Optional[str] = ""


class RepaymentIn(BaseModel):
    amount: float
    note: Optional[str] = ""


class ExtendIn(BaseModel):
    additional_months: int
    note: Optional[str] = ""


class BlockIn(BaseModel):
    reason: str
    block_months: int


class SadakahIn(BaseModel):
    beneficiary_id: str
    amount: float
    note: Optional[str] = ""


class PaymentIn(BaseModel):
    donor_id: str
    date_from: Optional[str] = None  # YYYY-MM-DD
    date_to: Optional[str] = None
    collection_date: Optional[str] = None  # legacy single-day alias
    collected_date: Optional[str] = None
    from_month: Optional[str] = None
    to_month: Optional[str] = None
    amount_per_month: Optional[float] = None
    amount: Optional[float] = None
    payment_mode: Literal["cash", "online"] = "cash"
    note: Optional[str] = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if isinstance(data, dict):
            if data.get("date_from") is None and data.get("collection_date"):
                data["date_from"] = data["collection_date"]
            if data.get("date_to") is None and data.get("collection_date"):
                data["date_to"] = data["collection_date"]
            if data.get("amount_per_month") is None and data.get("amount") is not None:
                data["amount_per_month"] = data["amount"]
        return data


class ExpenseIn(BaseModel):
    kind: Literal["salary", "maintenance"]
    worker_id: Optional[str] = None
    month: Optional[str] = None
    category: Optional[str] = ""  # for maintenance
    amount: float
    note: Optional[str] = ""


class ApprovalActionIn(BaseModel):
    approve: bool
    note: Optional[str] = ""


# ---------------- Auth ----------------
@api.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    role = canonical_role(user.get("role"))
    if user.get("role") != role:
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": role}})
        user["role"] = role
    token = create_token(user["id"], user["email"], role)
    return {
        "token": token,
        "user": public_user(user),
    }


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------- Admin: Users ----------------
@api.get("/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [public_user(u) for u in users]


@api.post("/admin/users")
async def create_user(data: UserCreate, admin: dict = Depends(require_admin)):
    email = data.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    role = canonical_role(data.role)
    is_active = bool(data.is_active)
    if is_active:
        await assert_role_slot_available(role)
    doc = {
        "id": new_id(),
        "email": email,
        "name": data.name,
        "role": role,
        "permissions": data.permissions,
        "is_active": is_active,
        "password_hash": hash_password(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return public_user(doc)


@api.patch("/admin/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    if data.name is not None:
        updates["name"] = data.name
    if data.permissions is not None:
        updates["permissions"] = data.permissions
    if data.password:
        updates["password_hash"] = hash_password(data.password)

    existing_role = canonical_role(existing.get("role"))
    existing_active = existing.get("is_active", True)
    next_role = canonical_role(data.role) if data.role is not None else existing_role
    next_active = bool(data.is_active) if data.is_active is not None else existing_active

    if data.role is not None:
        updates["role"] = next_role
    if data.is_active is not None:
        updates["is_active"] = next_active

    leaving_admin = existing_active and existing_role == ROLE_ACCOUNTANT_ADMIN and (
        next_role != ROLE_ACCOUNTANT_ADMIN or not next_active
    )
    if leaving_admin:
        remaining = await count_active_role(ROLE_ACCOUNTANT_ADMIN, exclude_id=user_id)
        if remaining < 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last Accountant Admin")

    currently_occupies = existing_active and existing_role == next_role
    if next_active and not currently_occupies:
        await assert_role_slot_available(next_role)

    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return public_user(user)


@api.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    existing = await db.users.find_one({"id": user_id})
    if existing and existing.get("is_active", True) and canonical_role(existing.get("role")) == ROLE_ACCOUNTANT_ADMIN:
        remaining = await count_active_role(ROLE_ACCOUNTANT_ADMIN, exclude_id=user_id)
        if remaining < 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last Accountant Admin")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ---------------- Generic person modules (donors/beneficiaries/workers) ----------------
COLLECTIONS = {"donors": "donors", "beneficiaries": "beneficiaries", "workers": "workers"}


async def _next_serial(coll: str) -> str:
    prefix = {"donors": "D", "beneficiaries": "B", "workers": "W"}[coll]
    now = datetime.now(timezone.utc)
    year_month = now.strftime("%Y%m")
    match = {"$regex": f"^{prefix}{year_month}"}
    count = await db[coll].count_documents({"serial": match})
    return f"{prefix}{year_month}{(count + 1):04d}"


@api.get("/people/{kind}/lookup")
async def lookup_person(kind: str, contact: str, user: dict = Depends(get_current_user)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    key = contact.strip()
    if not key:
        return {"exists": False, "record": None}
    doc = await db[kind].find_one({"contact": key}, {"_id": 0})
    if doc:
        return {"exists": True, "record": doc}
    query = {"$or": [
        {"name": {"$regex": key, "$options": "i"}},
        {"father_name": {"$regex": key, "$options": "i"}},
        {"reference": {"$regex": key, "$options": "i"}},
    ]}
    doc = await db[kind].find_one(query, {"_id": 0})
    return {"exists": bool(doc), "record": doc}


@api.get("/people/{kind}/search")
async def search_people(kind: str, q: Optional[str] = None, place: Optional[str] = None, user: dict = Depends(require_member)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    query = {}
    if q:
        q = q.strip()
        if q:
            query["$or"] = [
                {"contact": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
                {"father_name": {"$regex": q, "$options": "i"}},
                {"reference": {"$regex": q, "$options": "i"}},
            ]
    if place:
        place = place.strip()
        if place:
            query["$and"] = query.get("$and", []) + [{"$or": [{"address": {"$regex": place, "$options": "i"}}, {"area": {"$regex": place, "$options": "i"}}]}]
    docs = await db[kind].find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return docs


@api.get("/people/{kind}")
async def list_people(kind: str, user: dict = Depends(require_member)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    docs = await db[kind].find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return docs


@api.post("/people/{kind}")
async def create_person(kind: str, data: PersonBase, user: dict = Depends(require_staff)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    contact = data.contact.strip()
    name = data.name.strip()
    father = data.father_name.strip()
    aadhaar = (data.aadhar_number or "").strip()
    reference = (data.reference or "").strip()
    registration_date = (data.registration_date or today_ymd())
    duplicate_query = {"$or": [{"contact": contact}]}
    if aadhaar:
        duplicate_query["$or"].append({"aadhar_number": aadhaar})
    if name and father:
        duplicate_query["$or"].append({"name": name, "father_name": father})
    existing = await db[kind].find_one({"$or": duplicate_query["$or"]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Duplicate {kind[:-1].title()} entry detected")
    doc = {
        "id": new_id(),
        "serial": await _next_serial(kind),
        "name": name,
        "father_name": father,
        "address": data.address.strip(),
        "contact": contact,
        "area": (data.area or "").strip(),
        "reference": reference,
        "aadhar_number": aadhaar,
        "registration_date": registration_date,
        "created_at": now_iso(),
    }
    await db[kind].insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/people/{kind}/{pid}")
async def get_person(kind: str, pid: str, user: dict = Depends(require_member)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    doc = await db[kind].find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@api.patch("/people/{kind}/{pid}")
async def update_person(kind: str, pid: str, data: PersonUpdate, user: dict = Depends(require_staff)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    updates = {k: v.strip() if isinstance(v, str) else v for k, v in data.model_dump(exclude_none=True).items()}
    if updates:
        await db[kind].update_one({"id": pid}, {"$set": updates})
    doc = await db[kind].find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@api.delete("/people/{kind}/{pid}")
async def delete_person(kind: str, pid: str, admin: dict = Depends(require_admin)):
    if kind not in COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown kind")
    await db[kind].delete_one({"id": pid})
    return {"ok": True}


# ---------------- Loans (Kadan + Vattiyilla Kadan) ----------------
def _compute_loan_status(loan: dict) -> dict:
    """Compute derived status: active | time_limit_exceed | blocked | closed."""
    if loan.get("status") == "blocked":
        return loan
    if loan.get("status") == "closed":
        return loan
    now = datetime.now(timezone.utc)
    due = datetime.fromisoformat(loan["due_date"])
    paid = loan.get("total_paid", 0)
    if paid >= loan["amount"]:
        loan["status"] = "closed"
    elif now > due:
        loan["status"] = "time_limit_exceed"
    else:
        loan["status"] = "active"
    return loan


@api.get("/loans")
async def list_loans(kadan_type: Optional[str] = None, user: dict = Depends(require_member)):
    q = {}
    if kadan_type:
        q["kadan_type"] = kadan_type
    docs = await db.loans.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    for d in docs:
        _compute_loan_status(d)
    return docs


@api.post("/loans")
async def create_loan(data: KadanIn, user: dict = Depends(require_staff)):
    beneficiary = await db.beneficiaries.find_one({"id": data.beneficiary_id}, {"_id": 0})
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    now = datetime.now(timezone.utc)
    due = now + timedelta(days=30 * data.repayment_months)
    doc = {
        "id": new_id(),
        "kadan_type": data.kadan_type,
        "category": data.category,
        "amount": float(data.amount),
        "repayment_months": int(data.repayment_months),
        "area": data.area.strip(),
        "beneficiary": beneficiary,
        "security": data.security.model_dump(),
        "notes": data.notes or "",
        "total_paid": 0.0,
        "repayments": [],
        "status": "active",
        "created_at": now.isoformat(),
        "due_date": due.isoformat(),
        "block_info": None,
        "extension_history": [],
        "created_by": user["id"],
    }
    await db.loans.insert_one(doc)
    doc.pop("_id", None)
    return _compute_loan_status(doc)


@api.get("/loans/{lid}")
async def get_loan(lid: str, user: dict = Depends(require_member)):
    doc = await db.loans.find_one({"id": lid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return _compute_loan_status(doc)


@api.post("/loans/{lid}/repay")
async def repay_loan(lid: str, data: RepaymentIn, user: dict = Depends(require_staff)):
    loan = await db.loans.find_one({"id": lid})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    entry = {
        "id": new_id(),
        "amount": float(data.amount),
        "note": data.note or "",
        "at": now_iso(),
        "by": user["id"],
    }
    total_paid = float(loan.get("total_paid", 0)) + float(data.amount)
    updates = {"total_paid": total_paid}
    if total_paid >= loan["amount"]:
        updates["status"] = "closed"
    await db.loans.update_one({"id": lid}, {"$set": updates, "$push": {"repayments": entry}})
    doc = await db.loans.find_one({"id": lid}, {"_id": 0})
    return _compute_loan_status(doc)


@api.post("/loans/{lid}/extend")
async def extend_loan(lid: str, data: ExtendIn, admin: dict = Depends(require_staff)):
    loan = await db.loans.find_one({"id": lid})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    due = datetime.fromisoformat(loan["due_date"]) + timedelta(days=30 * data.additional_months)
    ext = {
        "months": data.additional_months,
        "note": data.note or "",
        "at": now_iso(),
        "by": admin["id"],
    }
    await db.loans.update_one(
        {"id": lid},
        {"$set": {"due_date": due.isoformat(), "status": "active"}, "$push": {"extension_history": ext}},
    )
    doc = await db.loans.find_one({"id": lid}, {"_id": 0})
    return _compute_loan_status(doc)


@api.post("/loans/{lid}/block")
async def block_loan(lid: str, data: BlockIn, admin: dict = Depends(require_staff)):
    loan = await db.loans.find_one({"id": lid})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    block_info = {
        "reason": data.reason,
        "block_months": data.block_months,
        "blocked_at": now_iso(),
        "unblock_at": (datetime.now(timezone.utc) + timedelta(days=30 * data.block_months)).isoformat(),
        "by": admin["id"],
    }
    await db.loans.update_one({"id": lid}, {"$set": {"status": "blocked", "block_info": block_info}})
    doc = await db.loans.find_one({"id": lid}, {"_id": 0})
    return doc


@api.post("/loans/{lid}/unblock")
async def unblock_loan(lid: str, admin: dict = Depends(require_staff)):
    await db.loans.update_one({"id": lid}, {"$set": {"status": "active", "block_info": None}})
    doc = await db.loans.find_one({"id": lid}, {"_id": 0})
    return _compute_loan_status(doc)


# ---------------- Sadakah ----------------
@api.get("/sadakah")
async def list_sadakah(user: dict = Depends(require_member)):
    return await db.sadakah.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api.post("/sadakah")
async def create_sadakah(data: SadakahIn, user: dict = Depends(require_staff)):
    beneficiary = await db.beneficiaries.find_one({"id": data.beneficiary_id}, {"_id": 0})
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    doc = {
        "id": new_id(),
        "beneficiary": beneficiary,
        "amount": float(data.amount),
        "note": data.note or "",
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.sadakah.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Payments (donor collection by date) ----------------
def _parse_ymd(value: str, field: str = "collection_date") -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")
    return value


def _months_inclusive(date_from: str, date_to: str) -> int:
    a = datetime.strptime(date_from, "%Y-%m-%d")
    b = datetime.strptime(date_to, "%Y-%m-%d")
    months = (b.year - a.year) * 12 + (b.month - a.month) + 1
    if months < 1:
        raise HTTPException(status_code=400, detail="date_to must be on or after date_from")
    return months


def _resolve_payment_dates(data: PaymentIn) -> tuple:
    start = (data.date_from or data.collection_date or "").strip()
    end = (data.date_to or data.date_from or data.collection_date or "").strip()
    if not start or not end:
        raise HTTPException(status_code=400, detail="date_from and date_to are required")
    start = _parse_ymd(start, "date_from")
    end = _parse_ymd(end, "date_to")
    if end < start:
        raise HTTPException(status_code=400, detail="date_to must be on or after date_from")
    return start, end


def _payment_overlap_query(start: str, end_inclusive: str) -> dict:
    """Match payments whose period overlaps the inclusive [start, end] window."""
    return {
        "$or": [
            {"date_from": {"$lte": end_inclusive}, "date_to": {"$gte": start}},
            {
                "date_from": {"$exists": False},
                "collection_date": {"$gte": start, "$lte": end_inclusive},
            },
        ]
    }


@api.get("/payments")
async def list_payments(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    collector_id: Optional[str] = None,
    limit: int = 400,
    user: dict = Depends(get_current_user),
):
    query = {}
    if date_from or date_to:
        start = _parse_ymd(date_from, "date_from") if date_from else "0000-01-01"
        end = _parse_ymd(date_to, "date_to") if date_to else "9999-12-31"
        query.update(_payment_overlap_query(start, end))
    if is_collector(user):
        query["collected_by"] = user["id"]
    elif not is_staff(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    if collector_id and is_staff(user):
        query["collected_by"] = collector_id
    cap = max(1, min(int(limit or 400), 2000))
    return await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(cap)


@api.get("/payments/pending")
async def list_pending_payments(admin: dict = Depends(require_accountant_admin)):
    return await db.payments.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api.get("/payments/collectors")
async def list_payment_collectors(user: dict = Depends(require_member)):
    rows = await db.payments.aggregate([
        {"$group": {"_id": "$collected_by", "name": {"$first": "$collected_by_name"}, "total": {"$sum": "$total_amount"}}},
        {"$sort": {"name": 1}},
    ]).to_list(5000)
    return [{"id": row["_id"], "name": row.get("name", ""), "total": row.get("total", 0)} for row in rows if row.get("_id")]


@api.post("/payments")
async def create_payment(data: PaymentIn, user: dict = Depends(get_current_user)):
    donor = await db.donors.find_one({"id": data.donor_id}, {"_id": 0})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    date_from, date_to = _resolve_payment_dates(data)
    months = _months_inclusive(date_from, date_to)
    amount = float(data.amount if data.amount is not None else data.amount_per_month or 10.0)
    total = round(amount, 2)
    doc = {
        "id": new_id(),
        "receipt_no": build_receipt_number(),
        "donor": donor,
        "date_from": date_from,
        "date_to": date_to,
        "collection_date": date_from,
        "collected_date": data.collected_date or data.collection_date or today_ymd(),
        "from_month": data.from_month or date_from[:7],
        "to_month": data.to_month or date_to[:7],
        "months": months,
        "amount": amount,
        "amount_per_month": amount,
        "total_amount": total,
        "payment_mode": data.payment_mode,
        "note": data.note or "",
        "status": "pending",
        "collected_by": user["id"],
        "collected_by_name": user.get("name", ""),
        "added_by": user["id"],
        "added_by_name": user.get("name", ""),
        "payment_added_at": now_iso(),
        "created_at": now_iso(),
        "approved_at": None,
        "approved_by": None,
    }
    await db.payments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/payments/{pid}")
async def delete_payment(pid: str, user: dict = Depends(require_staff)):
    result = await db.payments.delete_one({"id": pid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"ok": True}


@api.post("/payments/{pid}/approve")
async def approve_payment(pid: str, data: ApprovalActionIn, user: dict = Depends(require_accountant_admin)):
    p = await db.payments.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {
        "status": "approved" if data.approve else "rejected",
        "approved_at": now_iso(),
        "approved_by": user["id"],
        "approval_note": data.note or "",
    }
    await db.payments.update_one({"id": pid}, {"$set": updates})
    doc = await db.payments.find_one({"id": pid}, {"_id": 0})
    return doc


# ---------------- Expenses ----------------
@api.get("/expenses")
async def list_expenses(user: dict = Depends(require_member)):
    return await db.expenses.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api.post("/expenses")
async def create_expense(data: ExpenseIn, user: dict = Depends(require_staff)):
    worker = None
    if data.worker_id:
        worker = await db.workers.find_one({"id": data.worker_id}, {"_id": 0})
        if not worker and data.kind == "salary":
            raise HTTPException(status_code=404, detail="Worker not found")
    doc = {
        "id": new_id(),
        "kind": data.kind,
        "worker": worker,
        "month": data.month,
        "category": data.category or "",
        "amount": float(data.amount),
        "note": data.note or "",
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Accounts / Dashboard ----------------
@api.get("/accounts/summary")
async def accounts_summary(fund: str = "baithulmal", user: dict = Depends(require_member)):
    """fund: 'baithulmal' (main) or 'vattiyilla' (interest-free)."""
    is_vatti = fund == "vattiyilla"
    loan_type_filter = "vattiyilla" if is_vatti else "kadan"

    # Loans of this fund
    loans_out = await db.loans.aggregate([
        {"$match": {"kadan_type": loan_type_filter, "status": {"$in": ["active", "time_limit_exceed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "paid": {"$sum": "$total_paid"}}},
    ]).to_list(1)
    total_loan = loans_out[0]["total"] if loans_out else 0
    total_loan_paid = loans_out[0]["paid"] if loans_out else 0

    # Total ever repaid to this fund
    all_repayments = await db.loans.aggregate([
        {"$match": {"kadan_type": loan_type_filter}},
        {"$group": {"_id": None, "total": {"$sum": "$total_paid"}}},
    ]).to_list(1)
    total_repaid = all_repayments[0]["total"] if all_repayments else 0

    loans_active = await db.loans.count_documents({"kadan_type": loan_type_filter, "status": {"$in": ["active", "time_limit_exceed"]}})
    loans_blocked = await db.loans.count_documents({"kadan_type": loan_type_filter, "status": "blocked"})
    loans_closed = await db.loans.count_documents({"kadan_type": loan_type_filter, "status": "closed"})
    beneficiaries_count = await db.beneficiaries.count_documents({})

    if is_vatti:
        # Vattiyilla fund only tracks its loans + repayments (no interest, no separate payment collection)
        # Balance = total_repaid - total_loan_outstanding (kitty available to lend again)
        balance = total_repaid - (total_loan - total_loan_paid)
        return {
            "fund": "vattiyilla",
            "balance": balance,
            "total_collected": total_repaid,          # repayments received
            "total_pending": 0,
            "total_expense": 0,
            "total_sadakah": 0,
            "total_loan_outstanding": total_loan - total_loan_paid,
            "total_loan_issued": total_loan,
            "beneficiaries_count": beneficiaries_count,
            "donors_count": 0,
            "workers_count": 0,
            "loans_active": loans_active,
            "loans_blocked": loans_blocked,
            "loans_closed": loans_closed,
        }

    # Baithulmal (main) fund
    approved_payments = await db.payments.aggregate([
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]).to_list(1)
    pending_payments = await db.payments.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]).to_list(1)
    expenses = await db.expenses.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    sadakah = await db.sadakah.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)

    total_collected = approved_payments[0]["total"] if approved_payments else 0
    total_pending = pending_payments[0]["total"] if pending_payments else 0
    total_expense = expenses[0]["total"] if expenses else 0
    total_sadakah = sadakah[0]["total"] if sadakah else 0

    balance = total_collected - total_expense - total_sadakah - (total_loan - total_loan_paid)

    donors_count = await db.donors.count_documents({})
    workers_count = await db.workers.count_documents({})

    distributed_total = total_expense + total_sadakah
    loan_outstanding = total_loan - total_loan_paid
    return {
        "fund": "baithulmal",
        "balance": balance,
        "total_collected": total_collected,
        "total_pending": total_pending,
        "total_expense": total_expense,
        "total_sadakah": total_sadakah,
        "distributed_total": distributed_total,
        "loan_outstanding": loan_outstanding,
        "total_loan_outstanding": loan_outstanding,
        "donors_count": donors_count,
        "beneficiaries_count": beneficiaries_count,
        "workers_count": workers_count,
        "loans_active": loans_active,
        "loans_blocked": loans_blocked,
    }


@api.get("/accounts/user-outstanding")
async def user_outstanding(admin: dict = Depends(require_member)):
    """List collectors and their pending (outstanding) payment totals."""
    pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {
            "_id": "$collected_by",
            "name": {"$first": "$collected_by_name"},
            "total": {"$sum": "$total_amount"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db.payments.aggregate(pipeline).to_list(1000)
    return [{"user_id": r["_id"], "name": r.get("name") or "", "outstanding": r["total"], "count": r["count"]} for r in rows]


# ---------------- Reports ----------------
@api.get("/reports")
async def report(range: str = "daily", start: Optional[str] = None, end: Optional[str] = None,
                 donor_id: Optional[str] = None, user: dict = Depends(require_member)):
    """range: daily|monthly|yearly|custom|individual"""
    now = datetime.now(timezone.utc)
    if range == "daily":
        s = now.replace(hour=0, minute=0, second=0, microsecond=0)
        e = s + timedelta(days=1)
    elif range == "monthly":
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # first of next month
        if s.month == 12:
            e = s.replace(year=s.year + 1, month=1)
        else:
            e = s.replace(month=s.month + 1)
    elif range == "yearly":
        s = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        e = s.replace(year=s.year + 1)
    elif range == "custom":
        if not start or not end:
            raise HTTPException(status_code=400, detail="start and end required")
        s = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
        e = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1)
    elif range == "individual":
        if not donor_id:
            raise HTTPException(status_code=400, detail="donor_id required")
        payments = await db.payments.find({"donor.id": donor_id, "status": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(5000)
        total = sum(p["total_amount"] for p in payments)
        donor = await db.donors.find_one({"id": donor_id}, {"_id": 0})
        return {"range": "individual", "donor": donor, "payments": payments, "total": total}
    else:
        raise HTTPException(status_code=400, detail="Invalid range")

    s_iso, e_iso = s.isoformat(), e.isoformat()
    s_ymd, e_ymd = s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
    payments = await db.payments.find(
        {"collection_date": {"$gte": s_ymd, "$lt": e_ymd}, "status": "approved"},
        {"_id": 0},
    ).to_list(5000)
    expenses = await db.expenses.find({"created_at": {"$gte": s_iso, "$lt": e_iso}}, {"_id": 0}).to_list(5000)
    sadakah = await db.sadakah.find({"created_at": {"$gte": s_iso, "$lt": e_iso}}, {"_id": 0}).to_list(5000)
    loans = await db.loans.find({"created_at": {"$gte": s_iso, "$lt": e_iso}}, {"_id": 0}).to_list(5000)

    total_income = sum(p["total_amount"] for p in payments)
    total_expense = sum(e["amount"] for e in expenses)
    total_sadakah = sum(x["amount"] for x in sadakah)

    return {
        "range": range,
        "start": s_iso,
        "end": e_iso,
        "payments": payments,
        "expenses": expenses,
        "sadakah": sadakah,
        "loans": loans,
        "totals": {
            "income": total_income,
            "expense": total_expense,
            "sadakah": total_sadakah,
            "net": total_income - total_expense - total_sadakah,
            "payments_count": len(payments),
            "expenses_count": len(expenses),
        },
    }


# ---------------- Startup ----------------
@app.on_event("startup")
async def on_start():
    try:
        await db.donors.create_index("contact", unique=True)
        await db.beneficiaries.create_index("contact", unique=True)
        await db.workers.create_index("contact", unique=True)
        await db.users.create_index("email", unique=True)
    except Exception as ex:
        logger.warning(f"Index setup: {ex}")

    await db.users.update_many({"is_active": {"$exists": False}}, {"$set": {"is_active": True}})
    await db.users.update_many(
        {"role": {"$in": ["admin", "co-admin"]}},
        {"$set": {"role": ROLE_ACCOUNTANT_ADMIN}},
    )
    await db.users.update_many(
        {"role": {"$in": ["accountant", "assistant_admin"]}},
        {"$set": {"role": ROLE_ACCOUNT_ASSISTANT}},
    )
    await db.users.update_many(
        {"role": {"$in": ["collector", "user"]}},
        {"$set": {"role": ROLE_PAYMENT_COLLECTOR}},
    )

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@baithulmal.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    active_admins = await count_active_role(ROLE_ACCOUNTANT_ADMIN)
    if not existing:
        if active_admins < ROLE_ACTIVE_LIMITS[ROLE_ACCOUNTANT_ADMIN]:
            await db.users.insert_one({
                "id": new_id(),
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "name": "Administrator",
                "role": ROLE_ACCOUNTANT_ADMIN,
                "permissions": ["*"],
                "is_active": True,
                "created_at": now_iso(),
            })
            logger.info(f"Seeded admin: {admin_email}")
    else:
        updates = {}
        if "is_active" not in existing:
            updates["is_active"] = True
        if active_admins < 1:
            updates["role"] = ROLE_ACCOUNTANT_ADMIN
            updates["is_active"] = True
        if admin_password and not verify_password(admin_password, existing.get("password_hash", "")):
            updates["password_hash"] = hash_password(admin_password)
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})
            logger.info("Updated seeded Accountant Admin from env")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

default_cors_origins = {
    'https://10rs-baithulmal-app.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
}
configured_cors_origins = {
    origin.strip().rstrip('/')
    for origin in os.environ.get('CORS_ORIGINS', '').split(',')
    if origin.strip()
}
cors_origins = sorted(default_cors_origins | configured_cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_origin_regex=r'https://.*\.vercel\.app',
    allow_methods=["*"],
    allow_headers=["*"],
)
