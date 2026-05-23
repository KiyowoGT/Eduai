from models.user import User, TeacherTitle, AccountType

def scope_teacher_query(user: User, class_field: str = "student_class", subject_field: str = "subject_name") -> dict:
    if user.account_type == AccountType.pribadi:
        return {"created_by": user.user_id}
    
    if not user.institution_code:
        # Fallback untuk user lama atau data yang belum ter-link
        return {"created_by": user.user_id}
    
    base_filter = {"institution_code": user.institution_code}
    
    if user.title == TeacherTitle.guru_kelas:
        base_filter[class_field] = user.assigned_class
    elif user.title == TeacherTitle.guru_pengajar:
        base_filter[subject_field] = user.assigned_subject
        
    # Untuk kepala_sekolah dan kurikulum, filter hanya berbasis institution_code (melihat semua)
    return base_filter
