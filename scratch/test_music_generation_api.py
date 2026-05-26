import sys
import asyncio
sys.path.append("c:\\Users\\ganxa\\Downloads\\My Project\\Eduai\\backend")

from core.database import db
from routers.documents import get_document
from models.user import User

async def main():
    # Fetch student Jajang Sarako
    user_dict = await db.users.find_one({"user_id": "0ede8fa8-ecc9-40aa-afd6-b483df9f9855"})
    if not user_dict:
        print("Student Jajang Sarako not found in DB")
        return
        
    doc_id = "3c64c88fc87743c08980fad8b3c33985"
    
    # Let's temporarily clear music_summaries in the database for the test document to verify dynamic generation
    await db.documents.update_one(
        {"document_id": doc_id},
        {"$unset": {"music_summaries": ""}}
    )
    print("Cleared music_summaries from the test document in DB.")
    
    # Instantiate User model
    if "created_at" not in user_dict or not user_dict["created_at"]:
        user_dict["created_at"] = "2026-05-26T23:36:32+07:00"
    user = User(**user_dict)
    
    # Call get_document
    print(f"Calling get_document for user Jajang Sarako (Hobby: {user.hobby}, Genre: {user.music_genre})...")
    doc = await get_document(doc_id, user)
    
    print("\nAPI returned successfully!")
    music_summaries = doc.get("music_summaries", {})
    genre = (user.music_genre or "pop, romantic").strip()
    if genre in music_summaries:
        print(f"Verification: Music summary for genre '{genre}' generated successfully on-the-fly!")
        print(f"Lyrics (first 100 chars):\n{music_summaries[genre]['lyrics'][:100]}...")
        print(f"Audio URL: {music_summaries[genre]['audio_url']}")
    else:
        print("Verification FAILED: Music summary not found in response!")

if __name__ == "__main__":
    asyncio.run(main())
