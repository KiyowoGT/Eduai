from enum import Enum
from typing import Literal, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, model_validator, ConfigDict

class UserRole(str, Enum):
    pengajar = "pengajar"
    pelajar = "pelajar"

class TeacherTitle(str, Enum):
    kepala_sekolah = "kepala_sekolah"
    kurikulum = "kurikulum"
    guru_kelas = "guru_kelas"
    guru_pengajar = "guru_pengajar"

EducationLevel = Literal["SD", "SMP", "SMA", "SMK", "MA", "Universitas"]

class User(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    friend_code: Optional[str] = None
    role: Optional[UserRole] = None
    title: Optional[TeacherTitle] = None          # hanya pengajar
    institution_code: Optional[str] = None
    institution_owner: bool = False
    assigned_class: Optional[str] = None            # guru_kelas
    assigned_subject: Optional[str] = None        # guru_pengajar
    enrolled_class: Optional[str] = None          # pelajar
    class_token_used: Optional[str] = None
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
    created_at: datetime

    @model_validator(mode="after")
    def check_title_fields(self) -> "User":
        if self.role != UserRole.pengajar:
            return self
        if self.title == TeacherTitle.guru_kelas and not self.assigned_class:
            raise ValueError("assigned_class wajib untuk guru_kelas")
        if self.title == TeacherTitle.guru_pengajar and not self.assigned_subject:
            raise ValueError("assigned_subject wajib untuk guru_pengajar")
        return self

class ProfileUpdate(BaseModel):
    education_level: str
    major: Optional[str] = None
    institution: str
    current_semester: int
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
