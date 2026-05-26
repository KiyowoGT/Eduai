import sys
import asyncio
sys.path.append("c:\\Users\\ganxa\\Downloads\\My Project\\Eduai\\backend")

from core.database import db
from services.ai_service import personalize_document_for_student

async def main():
    # Fetch the document
    doc = await db.documents.find_one({"document_id": "3c64c88fc87743c08980fad8b3c33985"})
    if not doc:
        print("Document not found!")
        return
        
    print(f"Original Summary (first 100 chars): {doc.get('summary', '')[:100]}...")
    
    # Personalize for olahraga
    print("\nPersonalizing for olahraga...")
    pers = await personalize_document_for_student(doc, "olahraga")
    
    print("\nPersonalized Summary:")
    print(pers.get("summary"))
    
    print("\nPersonalized Key Concepts:")
    for c in pers.get("key_concepts", []):
        print(f"- Concept: {c.get('concept')}")
        print(f"  Explanation: {c.get('explanation')}")

if __name__ == "__main__":
    asyncio.run(main())
