from fastapi import HTTPException, Depends
from deps.auth import get_current_user
from models.user import UserRole

async def admin_required(user = Depends(get_current_user)):
    """
    Raise 403 if the current authenticated user is not an admin or superadmin.
    """
    is_superadmin = getattr(user, "is_superadmin", False)
    if user.role != UserRole.admin and not is_superadmin:
        raise HTTPException(
            status_code=403,
            detail="Akses admin diperlukan"
        )
    return user
