import sys
import asyncio
sys.path.append("c:\\Users\\ganxa\\Downloads\\My Project\\Eduai\\backend")

from core.database import db
from routers.documents import get_document
from models.user import User

async def main():
    # Fetch student std1_858074
    user_dict = await db.users.find_one({"user_id": "std1_858074"})
    if not user_dict:
        # Create a mock dictionary if student not in db
        user_dict = {
            "user_id": "std1_858074",
            "name": "Student A",
            "email": "student@sman3.sch.id",
        }
        
    # Set hobby, role, and institution code to match the document
    user_dict["hobby"] = "olahraga"
    user_dict["role"] = "pelajar"
    user_dict["institution_code"] = "SMAN3JAKAR-OJCQ"
    if "created_at" not in user_dict or not user_dict["created_at"]:
        user_dict["created_at"] = "2026-05-26T23:36:32+07:00"
    
    # Instantiate User model
    user = User(**user_dict)
    
    # Call get_document
    doc_id = "3c64c88fc87743c08980fad8b3c33985"
    doc = await get_document(doc_id, user)
    
    print("API returned successfully!")
    print(f"Returned Summary (first 150 chars):\n{doc.get('summary')[:150]}...")
    print(f"Returned Key Concepts count: {len(doc.get('key_concepts', []))}")
    
    # Verify that it was saved to the personalized_documents collection
    cached = await db.personalized_documents.find_one({
        "document_id": doc_id,
        "user_id": user.user_id,
        "hobby": "olahraga"
    })
    if cached:
        print("Verification: Personalized document cached successfully in MongoDB!")
    else:
        print("Verification: Personalized document was NOT cached!")

if __name__ == "__main__":
    asyncio.run(main())
