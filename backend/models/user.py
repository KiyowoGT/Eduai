from enum import Enum
from typing import Literal, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, model_validator, ConfigDict

class UserRole(str, Enum):
    pengajar = "pengajar"
    pelajar = "pelajar"

class AccountType(str, Enum):
    pribadi = "pribadi"
    perusahaan = "perusahaan"

class TeacherTitle(str, Enum):
    kepala_sekolah = "kepala_sekolah"
    kurikulum = "kurikulum"
    guru_kelas = "guru_kelas"
    guru_pengajar = "guru_pengajar"
    kajur = "kajur"

EducationLevel = Literal["SD", "SMP", "SMA", "SMK", "MA", "Universitas"]

class ParentContact(BaseModel):
    name: str
    phone: str
    relation: str
    verified: bool = False

class UserPreferences(BaseModel):
    ai_tone: str = "friendly"
    notification_enabled: bool = True

class User(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    user_id: str
    email: str
    username: Optional[str] = None
    name: str
    picture: Optional[str] = None
    friend_code: Optional[str] = None
    role: Optional[UserRole] = None
    account_type: Optional[AccountType] = None
    title: Optional[TeacherTitle] = None          # hanya pengajar
    titles: Optional[List[TeacherTitle]] = Field(default_factory=list) # multi-jabatan
    institution_code: Optional[str] = None
    institution_owner: bool = False
    assigned_class: Optional[str] = None            # guru_kelas
    assigned_subject: Optional[str] = None        # guru_pengajar
    enrolled_class: Optional[str] = None          # pelajar
    class_token_used: Optional[str] = None
    nis: Optional[str] = None                     # pelajar institusi
    nisn: Optional[str] = None                    # pelajar institusi
    academic_year_id: Optional[str] = None        # pelajar institusi
    parent_contacts: Optional[List[ParentContact]] = Field(default_factory=list)
    preferences: Optional[UserPreferences] = Field(default_factory=UserPreferences)
    education_level: Optional[str] = None          # SD, SMP, SMA, SMK, MA, Universitas
    major: Optional[str] = None
    institution: Optional[str] = None
    current_semester: Optional[int] = None
    subjects: Optional[list] = None               # [{id, name, folder_id}]
    schedule: Optional[list] = None               # [{day, start_time, end_time, subject_id}]
    teaching_methods: Optional[list] = None       # ["real_world","imagination","independence","confidence"]
    onboarded: bool = False
    clone_voice_enabled: Optional[bool] = None
    clone_voice_url: Optional[str] = None
    is_institution_linked: Optional[bool] = None
    is_class_linked: Optional[bool] = None
    created_by_admin: Optional[bool] = None
    permissions: Optional[List[str]] = Field(default_factory=list)
    teaching_classes: Optional[List[str]] = Field(default_factory=list)
    created_at: datetime

    @property
    def all_titles(self) -> List[TeacherTitle]:
        res = []
        if self.titles:
            res.extend(self.titles)
        if self.title and self.title not in res:
            res.append(self.title)
        return res

    @model_validator(mode="after")
    def check_title_fields(self) -> "User":
        if self.role != UserRole.pengajar:
            return self

        if self.account_type == AccountType.pribadi:
            if self.title is not None or (self.titles and len(self.titles) > 0):
                raise ValueError("Guru mandiri (akun pribadi) tidak boleh memiliki sub-role (title)")
            return self

        if self.account_type == AccountType.perusahaan:
            import logging
            titles = self.all_titles
            if TeacherTitle.guru_kelas in titles and not self.assigned_class:
                logging.getLogger(__name__).warning(
                    f"User {self.user_id} has guru_kelas title but no assigned_class"
                )
            if TeacherTitle.guru_pengajar in titles and not self.assigned_subject:
                logging.getLogger(__name__).warning(
                    f"User {self.user_id} has guru_pengajar title but no assigned_subject"
                )
        
        return self

    def get_permissions(self) -> List[str]:
        if self.role == UserRole.pelajar:
            return ["read_materials", "take_quiz", "chat_ai"]
        
        if self.account_type == AccountType.pribadi:
            # Guru Mandiri: Full Access
            return ["studio_materi", "ruang_kelas", "jadwal_master", "analitik_full"]
        
        permissions = set()
        # USE ACTIVE TITLE ONLY for strict role switching
        active_title = self.title
        
        if active_title == TeacherTitle.kepala_sekolah:
            permissions.update(["ruang_kelas_view", "analitik_makro"])
        elif active_title == TeacherTitle.kurikulum:
            permissions.update(["ruang_kelas_view", "jadwal_master", "analitik_makro"])
        elif active_title == TeacherTitle.guru_kelas:
            permissions.update(["ruang_kelas_full", "jadwal_view", "analitik_kelas"])
        elif active_title == TeacherTitle.guru_pengajar:
            permissions.update(["studio_materi", "analitik_butir_soal"])
        elif active_title == TeacherTitle.kajur:
            permissions.update(["ruang_kelas_view", "studio_materi", "analitik_butir_soal"])
        
        return list(permissions)

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    education_level: Optional[str] = None
    major: Optional[str] = None
    institution: Optional[str] = None
    current_semester: Optional[int] = None
    teaching_methods: Optional[List[str]] = None
    clone_voice_enabled: Optional[bool] = None
    clone_voice_url: Optional[str] = None

class TeachingMethodsUpdate(BaseModel):
    teaching_methods: List[str]

class FriendCodeUpdate(BaseModel):
    friend_code: str

class SubjectItem(BaseModel):
    id: str
    name: str
    folder_id: Optional[str] = None

class ScheduleItem(BaseModel):
    day: str
    start_time: str
    end_time: str
    subject_id: str

class EducationSettingsPayload(BaseModel):
    subjects: List[SubjectItem]
    schedule: List[ScheduleItem]

class CreateInstitutionBody(BaseModel):
    name: str
    level: str  # SD, SMP, SMA, SMK, MA, Universitas
    major: Optional[str] = None

class OnboardingCompletePayload(BaseModel):
    username: Optional[str] = None
    role: Literal["pengajar", "pelajar"]
    account_type: Optional[AccountType] = None  # "pribadi" = guru mandiri
    create_institution: Optional[CreateInstitutionBody] = None
    staff_passcode: Optional[str] = None
    class_token: Optional[str] = None
    nis: Optional[str] = None
    nisn: Optional[str] = None
    education_level: Optional[str] = None
    institution: Optional[str] = None
    current_semester: Optional[int] = None
    major: Optional[str] = None
    teaching_methods: Optional[List[str]] = None

