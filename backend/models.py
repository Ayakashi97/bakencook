from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Enum, Table, JSON, Float, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PGUUID
import uuid
import enum
from database import Base
from datetime import datetime

class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"

class RecipeCategory(str, enum.Enum):
    baking = "baking"
    cooking = "cooking"

class RecipeType(str, enum.Enum):
    manual = "manual"
    ai_import = "ai_import"

class IngredientType(str, enum.Enum):
    flour = "flour"
    liquid = "liquid"
    starter = "starter"
    salt = "salt"
    add_in = "add_in"
    other = "other"

class StepType(str, enum.Enum):
    active = "active"
    passive = "passive"
    baking = "baking"

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type for PostgreSQL,
    CHAR(36) for others (SQLite, MySQL, etc.)
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PGUUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(str(value)))
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value

class Role(Base):
    __tablename__ = "roles"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, index=True)
    permissions = Column(JSON, default=[]) # List of permission strings e.g. ["user:read", "user:write"]
    users = relationship("User", back_populates="role_rel")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    token_version = Column(Integer, default=1)
    session_duration_minutes = Column(Integer, default=60)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(UserRole), default=UserRole.user)
    email = Column(String, unique=True, nullable=True)
    is_verified = Column(Boolean, default=False)
    language = Column(String, default="en") # User's preferred language
    role_id = Column(String, ForeignKey("roles.id"), nullable=True)
    api_key = Column(String, unique=True, nullable=True, index=True) # New API Key field
    role_rel = relationship("Role", back_populates="users")
    
    recipes = relationship("Recipe", back_populates="owner")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    import_jobs = relationship("ImportJob", back_populates="user", cascade="all, delete-orphan")

class ImportJobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    status = Column(Enum(ImportJobStatus), default=ImportJobStatus.pending)
    recipe_id = Column(GUID, ForeignKey("recipes.id"), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="import_jobs")
    recipe = relationship("Recipe")

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="sessions")

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, index=True)
    source_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    # name is now a JSON object: {"en": "Flour", "de": "Mehl"}
    # name = Column(JSON, nullable=False) # Removed as it seems redundant with title and caused issues
    created_type = Column(Enum(RecipeType), default=RecipeType.manual)
    type = Column(Enum(RecipeCategory), default=RecipeCategory.baking)
    is_public = Column(Boolean, default=False)
    yield_amount = Column(Integer, default=1) # Portions (formerly yield_amount)
    weight_per_piece = Column(Integer, nullable=True) # Optional weight per piece in grams
    reference_temperature = Column(Float, default=20.0) # Reference temperature for fermentation
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="recipes")
    chapters = relationship("Chapter", back_populates="recipe", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="recipe", cascade="all, delete-orphan")

class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    recipe_id = Column(GUID, ForeignKey("recipes.id"))
    name = Column(String)
    order_index = Column(Integer)

    recipe = relationship("Recipe", back_populates="chapters")
    ingredients = relationship("Ingredient", back_populates="chapter", cascade="all, delete-orphan")
    steps = relationship("Step", back_populates="chapter", cascade="all, delete-orphan")

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(GUID, ForeignKey("chapters.id"))
    name = Column(JSON)
    amount = Column(Float) # in grams usually, but can be float if needed
    unit = Column(String, default="g")
    temperature = Column(Float, nullable=True)
    type = Column(Enum(IngredientType), default=IngredientType.other)

    chapter = relationship("Chapter", back_populates="ingredients")

class Step(Base):
    __tablename__ = "steps"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(GUID, ForeignKey("chapters.id"))
    order_index = Column(Integer)
    description = Column(Text)
    duration_min = Column(Integer)
    type = Column(Enum(StepType), default=StepType.passive)
    temperature = Column(Integer, nullable=True)

    chapter = relationship("Chapter", back_populates="steps")

class Favorite(Base):
    __tablename__ = "favorites"
    
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    recipe_id = Column(GUID, ForeignKey("recipes.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="favorites")
    recipe = relationship("Recipe", back_populates="favorites")

class Rating(Base):
    __tablename__ = "ratings"
    
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    recipe_id = Column(GUID, ForeignKey("recipes.id"), primary_key=True)
    score = Column(Integer) # 1-5
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="ratings")
    recipe = relationship("Recipe", back_populates="ratings")

# Update User and Recipe relationships
User.favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
User.ratings = relationship("Rating", back_populates="user", cascade="all, delete-orphan")

Recipe.favorites = relationship("Favorite", back_populates="recipe", cascade="all, delete-orphan")
Recipe.ratings = relationship("Rating", back_populates="recipe", cascade="all, delete-orphan")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"))
    recipe_id = Column(GUID, ForeignKey("recipes.id"))
    target_time = Column(DateTime)
    start_time = Column(DateTime)
    
    # New fields for recurring events and generic tasks
    title = Column(String, nullable=True) # For generic events like "Feed Sourdough"
    event_type = Column(String, default="baking") # baking, feeding, other
    recurrence_rule = Column(String, nullable=True) # RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO")
    real_temperature = Column(Float, nullable=True) # Real room temperature for this schedule

    recipe = relationship("Recipe", back_populates="schedules")

class Unit(Base):
    __tablename__ = "units"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(JSON, nullable=False) # {"en": {"singular": "g", "plural": "g"}, ...}
    description = Column(JSON, nullable=True) # {"en": "Gram", "de": "Gramm"}

class IngredientItem(Base):
    __tablename__ = "ingredient_items" # Kept original tablename
    id = Column(Integer, primary_key=True, index=True)
    name = Column(JSON, nullable=False)  # {"en": "Flour", "de": "Mehl"}
    default_unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    linked_recipe_id = Column(GUID, ForeignKey("recipes.id"), nullable=True) # Corrected type to UUID
    is_verified = Column(Boolean, default=False)

    default_unit = relationship("Unit")
    linked_recipe = relationship("Recipe")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

class VerificationToken(Base):
    __tablename__ = "verification_tokens"
    
    token = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
