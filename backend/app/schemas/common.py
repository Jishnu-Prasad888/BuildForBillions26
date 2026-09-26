from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    preferred_language: str
    profile: dict
    created_at: datetime
    last_login_at: datetime | None = None


class SignUpIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    preferred_language: str = Field(default="en", pattern="^(en|hi|kn)$")


class SignInIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    password: str = Field(min_length=8, max_length=128)


class ProfileIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    preferred_language: str | None = Field(default=None, pattern="^(en|hi|kn)$")
    profile: dict | None = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    language: str | None = Field(default=None, pattern="^(en|hi|kn)$")
    application_id: str | None = None
    input_mode: str = Field(default="text", pattern="^(text|voice)$")  # logging only; never changes routing


class NoteIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    item_type: str = Field(default="todo", pattern="^(todo|question|text)$")
    application_id: str | None = None
    origin: str = Field(default="user", pattern="^(user|ai_suggested)$")


class NotePatch(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    done: bool | None = None
    item_type: str | None = Field(default=None, pattern="^(todo|question|text)$")


class ApplicationCreate(BaseModel):
    scheme_code: str = Field(min_length=2, max_length=64)
    evidence: list[dict] = []


class FormPatch(BaseModel):
    values: dict


class SubmitIn(BaseModel):
    confirm: bool


class ScreenIn(BaseModel):
    visible_fields: list[dict] = []
    focused_field_id: str | None = None
    buttons: list[str] = []
    warnings: list[str] = []
    values: dict | None = None
    frame: str | None = Field(default=None, max_length=4_000_000)  # base64 JPEG, never stored


class SessionStart(BaseModel):
    application_id: str
    language: str = Field(default="en", pattern="^(en|hi|kn)$")
    screen: ScreenIn | None = None
    screen_shared: bool = False


class SessionMessage(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    screen: ScreenIn | None = None
    language: str | None = Field(default=None, pattern="^(en|hi|kn)$")
    input_mode: str = Field(default="text", pattern="^(text|voice)$")  # logging only; never changes routing


class AdminUserPatch(BaseModel):
    role: str | None = Field(default=None, pattern="^(USER|ADMIN)$")
    is_active: bool | None = None


class SourceIn(BaseModel):
    url: str = Field(min_length=8, max_length=1024, pattern=r"^https?://")
    title: str | None = Field(default=None, max_length=300)
    publisher: str | None = Field(default=None, max_length=255)
    scheme_codes: list[str] = []


class SchemeIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9_]{3,40}$")
    name: str = Field(min_length=3, max_length=255)
    short_name: str | None = None
    summary: str = ""
    benefit: str = ""
    life_events: list[str] = ["CROP_DAMAGE"]
    department: str | None = None
    states: list[str] = []
    portal: str | None = None
    documents: list[str] = []
    rules: list[dict] = []
    source_doc: str | None = None


class KagQueryIn(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    language: str | None = Field(default=None, pattern="^(en|hi|kn)$")
    generate: bool = True
