from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
import qrcode
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="TechFix Pro API")
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get('JWT_SECRET', 'techfix-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    TECHNICIAN = "technician"
    ATTENDANT = "attendant"

class OSStatus(str, Enum):
    RECEIVED = "received"
    ANALYSIS = "analysis"
    AWAITING_APPROVAL = "awaiting_approval"
    AWAITING_PART = "awaiting_part"
    IN_REPAIR = "in_repair"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class DeviceType(str, Enum):
    CELLPHONE = "cellphone"
    NOTEBOOK = "notebook"
    TV = "tv"
    TABLET = "tablet"
    DESKTOP = "desktop"
    OTHER = "other"

class PaymentMethod(str, Enum):
    CASH = "cash"
    PIX = "pix"
    CARD = "card"
    TRANSFER = "transfer"

class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"

# Models
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.TECHNICIAN

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    created_at: str
    is_active: bool = True
    organization_id: Optional[str] = None

class ClientCreate(BaseModel):
    name: str
    cpf_cnpj: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    name: str
    cpf_cnpj: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    created_at: str
    total_spent: float = 0
    orders_count: int = 0

class DeviceCreate(BaseModel):
    client_id: str
    type: DeviceType
    brand: str
    model: str
    serial_imei: Optional[str] = None
    condition_notes: Optional[str] = None
    photos: List[str] = []

class DeviceResponse(BaseModel):
    id: str
    client_id: str
    type: DeviceType
    brand: str
    model: str
    serial_imei: Optional[str] = None
    condition_notes: Optional[str] = None
    photos: List[str] = []
    created_at: str

class ServiceItemCreate(BaseModel):
    description: str
    quantity: int = 1
    unit_price: float
    is_part: bool = False
    part_id: Optional[str] = None

class ServiceOrderCreate(BaseModel):
    client_id: str
    device_id: str
    reported_issue: str
    technical_diagnosis: Optional[str] = None
    estimated_days: Optional[int] = None
    items: List[ServiceItemCreate] = []
    internal_notes: Optional[str] = None

class ServiceOrderUpdate(BaseModel):
    status: Optional[OSStatus] = None
    technical_diagnosis: Optional[str] = None
    estimated_days: Optional[int] = None
    items: Optional[List[ServiceItemCreate]] = None
    internal_notes: Optional[str] = None

class ServiceOrderResponse(BaseModel):
    id: str
    order_number: str
    client_id: str
    client_name: str
    device_id: str
    device_info: str
    reported_issue: str
    technical_diagnosis: Optional[str] = None
    status: OSStatus
    items: List[dict] = []
    total: float = 0
    labor_cost: float = 0
    parts_cost: float = 0
    estimated_days: Optional[int] = None
    internal_notes: Optional[str] = None
    created_at: str
    updated_at: str
    created_by: str
    history: List[dict] = []

class PartCreate(BaseModel):
    name: str
    code: Optional[str] = None
    supplier: Optional[str] = None
    cost_price: float
    sale_price: float
    quantity: int = 0
    min_quantity: int = 5

class PartResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    supplier: Optional[str] = None
    cost_price: float
    sale_price: float
    quantity: int
    min_quantity: int
    created_at: str

class TransactionCreate(BaseModel):
    type: TransactionType
    category: str
    description: str
    amount: float
    payment_method: PaymentMethod
    order_id: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    type: TransactionType
    category: str
    description: str
    amount: float
    payment_method: PaymentMethod
    order_id: Optional[str] = None
    created_at: str
    created_by: str

class DashboardStats(BaseModel):
    orders_by_status: dict
    today_revenue: float
    week_revenue: float
    month_revenue: float
    top_services: List[dict]
    alerts: List[dict]

# Auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="Permissão negada")
        return user
    return role_checker

def get_org_filter(user: dict) -> dict:
    """Returns the organization filter for queries based on user's organization"""
    org_id = user.get("organization_id")
    if org_id:
        return {"organization_id": org_id}
    return {"organization_id": None}

# Auth endpoints
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    """Public registration - creates a new admin with their own organization"""
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    # New registrations are always admins of their own organization
    org_id = str(uuid.uuid4())
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "name": user.name,
        "email": user.email,
        "password": hash_password(user.password),
        "role": UserRole.ADMIN.value,  # Always admin for new registrations
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "organization_id": org_id  # Each new admin gets their own organization
    }
    await db.users.insert_one(user_dict)
    del user_dict["password"]
    del user_dict["_id"]
    return UserResponse(**user_dict)

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "organization_id": user.get("organization_id")
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)

# Users endpoints - Admin creates users for their organization
@api_router.get("/users", response_model=List[UserResponse])
async def list_users(user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    users = await db.users.find(org_filter, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(new_user: UserCreate, user: dict = Depends(require_role([UserRole.ADMIN]))):
    """Admin creates a user that belongs to their organization"""
    existing = await db.users.find_one({"email": new_user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "name": new_user.name,
        "email": new_user.email,
        "password": hash_password(new_user.password),
        "role": new_user.role.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "organization_id": user.get("organization_id")  # Inherit admin's organization
    }
    await db.users.insert_one(user_dict)
    del user_dict["password"]
    del user_dict["_id"]
    return UserResponse(**user_dict)

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: dict, user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    if "password" in data:
        data["password"] = hash_password(data["password"])
    # Ensure user can only update users in their organization
    result = await db.users.update_one({"id": user_id, **org_filter}, {"$set": data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"message": "Usuário atualizado"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    # Prevent admin from deleting themselves
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta")
    result = await db.users.delete_one({"id": user_id, **org_filter})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"message": "Usuário removido"}

# Clients endpoints - filtered by organization
@api_router.post("/clients", response_model=ClientResponse)
async def create_client(client: ClientCreate, user: dict = Depends(get_current_user)):
    client_dict = {
        "id": str(uuid.uuid4()),
        **client.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "total_spent": 0,
        "orders_count": 0,
        "organization_id": user.get("organization_id")
    }
    await db.clients.insert_one(client_dict)
    del client_dict["_id"]
    del client_dict["organization_id"]
    return ClientResponse(**client_dict)

@api_router.get("/clients", response_model=List[ClientResponse])
async def list_clients(search: Optional[str] = None, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    query = {**org_filter}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"cpf_cnpj": {"$regex": search, "$options": "i"}}
        ]
    clients = await db.clients.find(query, {"_id": 0, "organization_id": 0}).to_list(1000)
    return [ClientResponse(**c) for c in clients]

@api_router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    client = await db.clients.find_one({"id": client_id, **org_filter}, {"_id": 0, "organization_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return ClientResponse(**client)

@api_router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, data: ClientCreate, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    result = await db.clients.update_one({"id": client_id, **org_filter}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0, "organization_id": 0})
    return ClientResponse(**client)

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    result = await db.clients.delete_one({"id": client_id, **org_filter})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"message": "Cliente removido"}

@api_router.get("/clients/{client_id}/history")
async def get_client_history(client_id: str, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    orders = await db.service_orders.find({"client_id": client_id, **org_filter}, {"_id": 0, "organization_id": 0}).sort("created_at", -1).to_list(100)
    devices = await db.devices.find({"client_id": client_id, **org_filter}, {"_id": 0, "organization_id": 0}).to_list(100)
    return {"orders": orders, "devices": devices}

# Devices endpoints - filtered by organization
@api_router.post("/devices", response_model=DeviceResponse)
async def create_device(device: DeviceCreate, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    client = await db.clients.find_one({"id": device.client_id, **org_filter})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    device_dict = {
        "id": str(uuid.uuid4()),
        **device.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": user.get("organization_id")
    }
    await db.devices.insert_one(device_dict)
    del device_dict["_id"]
    del device_dict["organization_id"]
    return DeviceResponse(**device_dict)

@api_router.get("/devices", response_model=List[DeviceResponse])
async def list_devices(client_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    query = {**org_filter}
    if client_id:
        query["client_id"] = client_id
    devices = await db.devices.find(query, {"_id": 0, "organization_id": 0}).to_list(1000)
    return [DeviceResponse(**d) for d in devices]

@api_router.get("/devices/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: str, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    device = await db.devices.find_one({"id": device_id, **org_filter}, {"_id": 0, "organization_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Aparelho não encontrado")
    return DeviceResponse(**device)

@api_router.put("/devices/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: str, data: DeviceCreate, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    result = await db.devices.update_one({"id": device_id, **org_filter}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Aparelho não encontrado")
    device = await db.devices.find_one({"id": device_id}, {"_id": 0, "organization_id": 0})
    return DeviceResponse(**device)

@api_router.delete("/devices/{device_id}")
async def delete_device(device_id: str, user: dict = Depends(require_role([UserRole.ADMIN, UserRole.TECHNICIAN]))):
    org_filter = get_org_filter(user)
    result = await db.devices.delete_one({"id": device_id, **org_filter})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Aparelho não encontrado")
    return {"message": "Aparelho removido"}

# Service Orders endpoints - filtered by organization
async def generate_order_number(org_id: str):
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.service_orders.count_documents({"order_number": {"$regex": f"^OS{today}"}, "organization_id": org_id})
    return f"OS{today}{str(count + 1).zfill(4)}"

@api_router.post("/orders", response_model=ServiceOrderResponse)
async def create_order(order: ServiceOrderCreate, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    org_id = user.get("organization_id")
    
    client = await db.clients.find_one({"id": order.client_id, **org_filter}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    device = await db.devices.find_one({"id": order.device_id, **org_filter}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Aparelho não encontrado")
    
    items = []
    labor_cost = 0
    parts_cost = 0
    
    for item in order.items:
        item_dict = item.model_dump()
        item_dict["total"] = item.quantity * item.unit_price
        if item.is_part:
            parts_cost += item_dict["total"]
            if item.part_id:
                await db.parts.update_one(
                    {"id": item.part_id, **org_filter},
                    {"$inc": {"quantity": -item.quantity}}
                )
        else:
            labor_cost += item_dict["total"]
        items.append(item_dict)
    
    order_number = await generate_order_number(org_id)
    now = datetime.now(timezone.utc).isoformat()
    
    order_dict = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "client_id": order.client_id,
        "client_name": client["name"],
        "device_id": order.device_id,
        "device_info": f"{device['brand']} {device['model']}",
        "reported_issue": order.reported_issue,
        "technical_diagnosis": order.technical_diagnosis,
        "status": OSStatus.RECEIVED.value,
        "items": items,
        "total": labor_cost + parts_cost,
        "labor_cost": labor_cost,
        "parts_cost": parts_cost,
        "estimated_days": order.estimated_days,
        "internal_notes": order.internal_notes,
        "created_at": now,
        "updated_at": now,
        "created_by": user["name"],
        "history": [{"status": OSStatus.RECEIVED.value, "timestamp": now, "user": user["name"]}],
        "organization_id": org_id
    }
    
    await db.service_orders.insert_one(order_dict)
    await db.clients.update_one({"id": order.client_id, **org_filter}, {"$inc": {"orders_count": 1}})
    
    del order_dict["_id"]
    del order_dict["organization_id"]
    return ServiceOrderResponse(**order_dict)

@api_router.get("/orders", response_model=List[ServiceOrderResponse])
async def list_orders(
    status: Optional[OSStatus] = None,
    client_id: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    org_filter = get_org_filter(user)
    query = {**org_filter}
    if status:
        query["status"] = status.value
    if client_id:
        query["client_id"] = client_id
    if search:
        query["$or"] = [
            {"order_number": {"$regex": search, "$options": "i"}},
            {"client_name": {"$regex": search, "$options": "i"}}
        ]
    
    orders = await db.service_orders.find(query, {"_id": 0, "organization_id": 0}).sort("created_at", -1).to_list(1000)
    return [ServiceOrderResponse(**o) for o in orders]

@api_router.get("/orders/{order_id}", response_model=ServiceOrderResponse)
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    order = await db.service_orders.find_one({"id": order_id, **org_filter}, {"_id": 0, "organization_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    return ServiceOrderResponse(**order)

@api_router.put("/orders/{order_id}", response_model=ServiceOrderResponse)
async def update_order(order_id: str, data: ServiceOrderUpdate, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    order = await db.service_orders.find_one({"id": order_id, **org_filter})
    if not order:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.status:
        update_data["status"] = data.status.value
        history_entry = {
            "status": data.status.value,
            "timestamp": update_data["updated_at"],
            "user": user["name"]
        }
        await db.service_orders.update_one(
            {"id": order_id, **org_filter},
            {"$push": {"history": history_entry}}
        )
        
        if data.status == OSStatus.COMPLETED:
            await db.clients.update_one(
                {"id": order["client_id"], **org_filter},
                {"$inc": {"total_spent": order["total"]}}
            )
    
    if data.technical_diagnosis is not None:
        update_data["technical_diagnosis"] = data.technical_diagnosis
    if data.estimated_days is not None:
        update_data["estimated_days"] = data.estimated_days
    if data.internal_notes is not None:
        update_data["internal_notes"] = data.internal_notes
    
    if data.items is not None:
        items = []
        labor_cost = 0
        parts_cost = 0
        for item in data.items:
            item_dict = item.model_dump()
            item_dict["total"] = item.quantity * item.unit_price
            if item.is_part:
                parts_cost += item_dict["total"]
            else:
                labor_cost += item_dict["total"]
            items.append(item_dict)
        update_data["items"] = items
        update_data["labor_cost"] = labor_cost
        update_data["parts_cost"] = parts_cost
        update_data["total"] = labor_cost + parts_cost
    
    await db.service_orders.update_one({"id": order_id, **org_filter}, {"$set": update_data})
    updated_order = await db.service_orders.find_one({"id": order_id}, {"_id": 0, "organization_id": 0})
    return ServiceOrderResponse(**updated_order)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    result = await db.service_orders.delete_one({"id": order_id, **org_filter})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    return {"message": "OS removida"}

@api_router.get("/orders/{order_id}/pdf")
async def generate_order_pdf(order_id: str, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    order = await db.service_orders.find_one({"id": order_id, **org_filter}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    
    client = await db.clients.find_one({"id": order["client_id"], **org_filter}, {"_id": 0})
    device = await db.devices.find_one({"id": order["device_id"], **org_filter}, {"_id": 0})
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=12, spaceAfter=10)
    normal_style = styles['Normal']
    
    elements = []
    
    elements.append(Paragraph("TECHFIX PRO", title_style))
    elements.append(Paragraph(f"Ordem de Serviço: {order['order_number']}", header_style))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("DADOS DO CLIENTE", header_style))
    client_data = [
        ["Nome:", client.get("name", "") if client else ""],
        ["Telefone:", client.get("phone", "") if client else ""],
        ["CPF/CNPJ:", client.get("cpf_cnpj", "") or "-" if client else "-"],
    ]
    t = Table(client_data, colWidths=[4*cm, 12*cm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 15))
    
    elements.append(Paragraph("DADOS DO APARELHO", header_style))
    device_data = [
        ["Tipo:", device.get("type", "") if device else ""],
        ["Marca/Modelo:", f"{device.get('brand', '')} {device.get('model', '')}" if device else ""],
        ["IMEI/Serial:", device.get("serial_imei", "") or "-" if device else "-"],
    ]
    t = Table(device_data, colWidths=[4*cm, 12*cm])
    t.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
    elements.append(t)
    elements.append(Spacer(1, 15))
    
    elements.append(Paragraph("SERVIÇO", header_style))
    elements.append(Paragraph(f"<b>Defeito Relatado:</b> {order.get('reported_issue', '')}", normal_style))
    elements.append(Paragraph(f"<b>Diagnóstico:</b> {order.get('technical_diagnosis', '-') or '-'}", normal_style))
    elements.append(Spacer(1, 15))
    
    if order.get("items"):
        elements.append(Paragraph("ORÇAMENTO", header_style))
        items_data = [["Descrição", "Qtd", "Valor Unit.", "Total"]]
        for item in order["items"]:
            items_data.append([
                item["description"],
                str(item["quantity"]),
                f"R$ {item['unit_price']:.2f}",
                f"R$ {item['total']:.2f}"
            ])
        items_data.append(["", "", "TOTAL:", f"R$ {order['total']:.2f}"])
        
        t = Table(items_data, colWidths=[8*cm, 2*cm, 3*cm, 3*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -2), 0.5, colors.grey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        elements.append(t)
    
    elements.append(Spacer(1, 30))
    
    elements.append(Paragraph(f"Data: {order['created_at'][:10]}", normal_style))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("_________________________________", normal_style))
    elements.append(Paragraph("Assinatura do Cliente", normal_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=OS_{order['order_number']}.pdf"}
    )

# Parts/Stock endpoints - filtered by organization
@api_router.post("/parts", response_model=PartResponse)
async def create_part(part: PartCreate, user: dict = Depends(require_role([UserRole.ADMIN, UserRole.TECHNICIAN]))):
    part_dict = {
        "id": str(uuid.uuid4()),
        **part.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": user.get("organization_id")
    }
    await db.parts.insert_one(part_dict)
    del part_dict["_id"]
    del part_dict["organization_id"]
    return PartResponse(**part_dict)

@api_router.get("/parts", response_model=List[PartResponse])
async def list_parts(low_stock: bool = False, search: Optional[str] = None, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    query = {**org_filter}
    if low_stock:
        query["$expr"] = {"$lte": ["$quantity", "$min_quantity"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}}
        ]
    parts = await db.parts.find(query, {"_id": 0, "organization_id": 0}).to_list(1000)
    return [PartResponse(**p) for p in parts]

@api_router.get("/parts/{part_id}", response_model=PartResponse)
async def get_part(part_id: str, user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    part = await db.parts.find_one({"id": part_id, **org_filter}, {"_id": 0, "organization_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Peça não encontrada")
    return PartResponse(**part)

@api_router.put("/parts/{part_id}", response_model=PartResponse)
async def update_part(part_id: str, data: PartCreate, user: dict = Depends(require_role([UserRole.ADMIN, UserRole.TECHNICIAN]))):
    org_filter = get_org_filter(user)
    result = await db.parts.update_one({"id": part_id, **org_filter}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Peça não encontrada")
    part = await db.parts.find_one({"id": part_id}, {"_id": 0, "organization_id": 0})
    return PartResponse(**part)

@api_router.post("/parts/{part_id}/stock")
async def adjust_stock(part_id: str, quantity: int, user: dict = Depends(require_role([UserRole.ADMIN, UserRole.TECHNICIAN]))):
    org_filter = get_org_filter(user)
    result = await db.parts.update_one({"id": part_id, **org_filter}, {"$inc": {"quantity": quantity}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Peça não encontrada")
    return {"message": "Estoque atualizado"}

@api_router.delete("/parts/{part_id}")
async def delete_part(part_id: str, user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    result = await db.parts.delete_one({"id": part_id, **org_filter})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Peça não encontrada")
    return {"message": "Peça removida"}

# Transactions endpoints - filtered by organization
@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate, user: dict = Depends(get_current_user)):
    trans_dict = {
        "id": str(uuid.uuid4()),
        **transaction.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["name"],
        "organization_id": user.get("organization_id")
    }
    await db.transactions.insert_one(trans_dict)
    del trans_dict["_id"]
    del trans_dict["organization_id"]
    return TransactionResponse(**trans_dict)

@api_router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(
    type: Optional[TransactionType] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    org_filter = get_org_filter(user)
    query = {**org_filter}
    if type:
        query["type"] = type.value
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    transactions = await db.transactions.find(query, {"_id": 0, "organization_id": 0}).sort("created_at", -1).to_list(1000)
    return [TransactionResponse(**t) for t in transactions]

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user: dict = Depends(require_role([UserRole.ADMIN]))):
    org_filter = get_org_filter(user)
    result = await db.transactions.delete_one({"id": transaction_id, **org_filter})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return {"message": "Transação removida"}

# Dashboard endpoint - filtered by organization
@api_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    orders_by_status = {}
    for status in OSStatus:
        count = await db.service_orders.count_documents({"status": status.value, **org_filter})
        orders_by_status[status.value] = count
    
    today_trans = await db.transactions.find({
        "type": "income",
        "created_at": {"$gte": today_start},
        **org_filter
    }, {"_id": 0}).to_list(1000)
    today_revenue = sum(t["amount"] for t in today_trans)
    
    week_trans = await db.transactions.find({
        "type": "income",
        "created_at": {"$gte": week_start},
        **org_filter
    }, {"_id": 0}).to_list(1000)
    week_revenue = sum(t["amount"] for t in week_trans)
    
    month_trans = await db.transactions.find({
        "type": "income",
        "created_at": {"$gte": month_start},
        **org_filter
    }, {"_id": 0}).to_list(1000)
    month_revenue = sum(t["amount"] for t in month_trans)
    
    pipeline = [
        {"$match": org_filter},
        {"$unwind": "$items"},
        {"$match": {"items.is_part": False}},
        {"$group": {"_id": "$items.description", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_services_cursor = db.service_orders.aggregate(pipeline)
    top_services = [{"name": doc["_id"], "count": doc["count"]} async for doc in top_services_cursor]
    
    alerts = []
    
    overdue_count = await db.service_orders.count_documents({
        "status": {"$nin": [OSStatus.COMPLETED.value, OSStatus.CANCELLED.value]},
        "created_at": {"$lt": (now - timedelta(days=7)).isoformat()},
        **org_filter
    })
    if overdue_count > 0:
        alerts.append({"type": "warning", "message": f"{overdue_count} OS(s) com mais de 7 dias"})
    
    low_stock_parts = await db.parts.find(
        {"$expr": {"$lte": ["$quantity", "$min_quantity"]}, **org_filter},
        {"_id": 0, "name": 1}
    ).to_list(100)
    if low_stock_parts:
        alerts.append({"type": "error", "message": f"{len(low_stock_parts)} peça(s) com estoque baixo"})
    
    awaiting_count = await db.service_orders.count_documents({"status": OSStatus.AWAITING_APPROVAL.value, **org_filter})
    if awaiting_count > 0:
        alerts.append({"type": "info", "message": f"{awaiting_count} OS(s) aguardando aprovação"})
    
    return DashboardStats(
        orders_by_status=orders_by_status,
        today_revenue=today_revenue,
        week_revenue=week_revenue,
        month_revenue=month_revenue,
        top_services=top_services,
        alerts=alerts
    )

# Reports endpoint - filtered by organization
@api_router.get("/reports/financial")
async def get_financial_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(require_role([UserRole.ADMIN]))
):
    org_filter = get_org_filter(user)
    query = {**org_filter}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    transactions = await db.transactions.find(query, {"_id": 0}).to_list(10000)
    
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expense = sum(t["amount"] for t in transactions if t["type"] == "expense")
    profit = total_income - total_expense
    
    income_by_category = {}
    expense_by_category = {}
    for t in transactions:
        if t["type"] == "income":
            income_by_category[t["category"]] = income_by_category.get(t["category"], 0) + t["amount"]
        else:
            expense_by_category[t["category"]] = expense_by_category.get(t["category"], 0) + t["amount"]
    
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "profit": profit,
        "income_by_category": income_by_category,
        "expense_by_category": expense_by_category
    }

@api_router.get("/reports/services")
async def get_services_report(user: dict = Depends(get_current_user)):
    org_filter = get_org_filter(user)
    
    pipeline = [
        {"$match": org_filter},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_value": {"$sum": "$total"}
        }}
    ]
    status_stats = {}
    async for doc in db.service_orders.aggregate(pipeline):
        status_stats[doc["_id"]] = {"count": doc["count"], "total_value": doc["total_value"]}
    
    device_pipeline = [
        {"$match": org_filter},
        {"$group": {"_id": "$device_info", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_devices = [{"device": doc["_id"], "count": doc["count"]} async for doc in db.service_orders.aggregate(device_pipeline)]
    
    orders = await db.service_orders.find(
        {"status": OSStatus.COMPLETED.value, **org_filter},
        {"_id": 0, "created_at": 1, "updated_at": 1}
    ).to_list(1000)
    
    total_days = 0
    for order in orders:
        try:
            created = datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))
            updated = datetime.fromisoformat(order["updated_at"].replace("Z", "+00:00"))
            total_days += (updated - created).days
        except:
            pass
    
    avg_repair_time = total_days / len(orders) if orders else 0
    
    return {
        "status_stats": status_stats,
        "top_devices": top_devices,
        "avg_repair_time_days": round(avg_repair_time, 1),
        "total_orders": await db.service_orders.count_documents(org_filter)
    }

# Public order tracking - no org filter needed, uses order_number
@api_router.get("/track/{order_number}")
async def track_order(order_number: str):
    order = await db.service_orders.find_one({"order_number": order_number}, {"_id": 0, "internal_notes": 0, "organization_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    return {
        "order_number": order["order_number"],
        "status": order["status"],
        "device_info": order["device_info"],
        "reported_issue": order["reported_issue"],
        "created_at": order["created_at"],
        "history": order.get("history", [])
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
