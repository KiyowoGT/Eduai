from models.user import User, TeacherTitle

def scope_teacher_query(user: User, class_field: str = "student_class", subject_field: str = "subject_name") -> dict:
    if not user.institution_code:
        return {"institution_code": "ISOLATED_NONE"}
    
    base_filter = {"institution_code": user.institution_code}
    
    if user.title == TeacherTitle.guru_kelas.value:
        base_filter[class_field] = user.assigned_class
    elif user.title == TeacherTitle.guru_pengajar.value:
        base_filter[subject_field] = user.assigned_subject
        
    return base_filter
