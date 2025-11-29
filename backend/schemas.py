from pydantic import BaseModel, validator, EmailStr
from typing import List, Optional, Dict, Union, Any
from uuid import UUID
from datetime import datetime
from models import RecipeType, IngredientType, StepType, RecipeCategory, ImportJobStatus
import enum

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str
    email: Optional[str] = None

class UserCreate(UserBase):
    password: str
    email: EmailStr # Make email mandatory for registration

class UserChangePassword(BaseModel):
    old_password: str
    new_password: str

class DeleteAccountRequest(BaseModel):
    password: str

class UserSessionBase(BaseModel):
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    last_used_at: datetime
    is_active: bool

class UserSession(UserSessionBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    target_time: datetime
    start_time: datetime
    recipe_id: Optional[UUID] = None
    title: Optional[str] = None
    event_type: Optional[str] = "baking"
    recurrence_rule: Optional[str] = None
    real_temperature: Optional[float] = None

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: UUID
    user_id: str
    recipe: Optional['Recipe'] = None

    class Config:
        from_attributes = True

class RoleBase(BaseModel):
    name: str
    permissions: List[str] = []

class RoleCreate(RoleBase):
    pass

class RoleUpdate(RoleBase):
    pass

class Role(RoleBase):
    id: str
    user_count: int = 0
    class Config:
        from_attributes = True

class User(UserBase):
    id: str
    role: str
    is_active: bool
    is_verified: bool = False
    verification_pending: Optional[bool] = False
    role_id: Optional[str] = None
    role_rel: Optional[Role] = None
    session_duration_minutes: int = 60
    api_key: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdateSettings(BaseModel):
    session_duration_minutes: int
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class VerifyEmailRequest(BaseModel):
    token: str

class EmailChangeConfirm(BaseModel):
    code: str
    email: EmailStr

class UserAdminCreate(BaseModel):
    username: str
    email: EmailStr # Make email mandatory for admin creation
    password: str
    role: str = "user" # "admin" or "user" (enum value)
    is_active: bool = True
    is_verified: bool = False

class UserAdminUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None

class EmailTestRequest(BaseModel):
    smtp_server: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    sender_email: str
    test_recipient: str

class IngredientBase(BaseModel):
    name: Dict[str, str] # {"en": "Flour", "de": "Mehl"}
    amount: float
    unit: str
    temperature: Optional[float] = None
    type: IngredientType

class IngredientCreate(IngredientBase):
    pass

class Ingredient(IngredientBase):
    id: int
    chapter_id: UUID

    class Config:
        from_attributes = True

class StepBase(BaseModel):
    order_index: int
    description: str
    duration_min: int
    type: StepType
    temperature: Optional[int] = None

class StepCreate(StepBase):
    pass

class Step(StepBase):
    id: int
    chapter_id: UUID

    class Config:
        from_attributes = True

class RecipeBase(BaseModel):
    title: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    created_type: RecipeType = RecipeType.manual
    type: RecipeCategory = RecipeCategory.baking
    is_public: bool = False
    yield_amount: int
    weight_per_piece: Optional[int] = None
    reference_temperature: Optional[float] = 20.0

class ChapterBase(BaseModel):
    name: str
    order_index: int

class ChapterCreate(ChapterBase):
    ingredients: List[IngredientCreate]
    steps: List[StepCreate]

class Chapter(ChapterBase):
    id: UUID
    recipe_id: UUID
    ingredients: List[Ingredient]
    steps: List[Step]

    class Config:
        from_attributes = True

class RecipeCreate(RecipeBase):
    chapters: List[ChapterCreate]

class RatingCreate(BaseModel):
    score: int

class Recipe(RecipeBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    chapters: List[Chapter]
    ingredient_overview: Optional[List[Ingredient]] = None # Computed field
    
    # New fields
    author: Optional[str] = None # Username
    average_rating: Optional[float] = 0.0
    rating_count: Optional[int] = 0
    weight_per_piece: Optional[int] = None
    is_favorited: Optional[bool] = False # Context-dependent

    class Config:
        from_attributes = True

class RecipeImportRequest(BaseModel):
    url: str
    raw_text: Optional[str] = None
    language: Optional[str] = "en"

class ImportJobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class ImportJobBase(BaseModel):
    status: ImportJobStatus
    recipe_id: Optional[UUID] = None
    error_message: Optional[str] = None

class ImportJob(ImportJobBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True



class UnitBase(BaseModel):
    name: Any
    description: Optional[Any] = None
    symbol: Optional[str] = None

    @validator('name', pre=True)
    def parse_name(cls, v):
        if isinstance(v, str):
            # Try to parse if it looks like a JSON string
            if v.strip().startswith("{"):
                try:
                    import json
                    return json.loads(v)
                except:
                    pass
            # Fallback for simple strings
            return {
                "en": {"singular": v, "plural": v},
                "de": {"singular": v, "plural": v}
            }
        return v

class UnitCreate(UnitBase):
    pass

class Unit(UnitBase):
    id: int

    class Config:
        from_attributes = True

class IngredientItemBase(BaseModel):
    name: Any
    default_unit_id: Optional[int] = None

    @validator('name', pre=True)
    def parse_name(cls, v):
        if isinstance(v, str):
             # Try to parse if it looks like a JSON string
             if v.strip().startswith("{"):
                try:
                    import json
                    return json.loads(v)
                except:
                    pass
             return {"en": v, "de": v}
        return v

    linked_recipe_id: Optional[UUID] = None # Changed to UUID to match Recipe.id type
    is_verified: bool = False

class IngredientItemCreate(IngredientItemBase):
    pass

class IngredientItem(IngredientItemBase):
    id: int
    default_unit: Optional[Unit] = None
    linked_recipe: Optional['Recipe'] = None  # We need to be careful with circular imports here, maybe use "Recipe" string or a simplified schema

    class Config:
        from_attributes = True

class RecipePage(BaseModel):
    items: List[Recipe]
    total: int
    page: int
    size: int
    pages: int

class SystemInfo(BaseModel):
    version: str
    environment: str
    update_available: bool
    latest_version: Optional[str] = None
    message: Optional[str] = None
    services: Optional[Dict[str, str]] = None

class SystemSetting(BaseModel):
    key: str
    value: str

    class Config:
        from_attributes = True

class SystemSettingsUpdate(BaseModel):
    settings: Dict[str, str]

class SystemInit(BaseModel):
    admin_username: str
    admin_email: EmailStr
    admin_password: str
    app_name: str
    gemini_api_key: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    sender_email: Optional[str] = None
    import_data: bool = False
    favicon_base64: Optional[str] = None # Optional favicon upload
    enable_registration: bool = True
    enable_email_verification: bool = False
    allow_guest_access: bool = False

class SystemVersion(BaseModel):
    version: str

class SystemUpdate(BaseModel):
    version: Optional[str] = None
    changelog: Optional[str] = None
