import sys
import asyncio
from datetime import datetime, timezone
sys.path.append("c:\\Users\\ganxa\\Downloads\\My Project\\Eduai\\backend")

from core.database import db

async def main():
    # Update the document to published
    result = await db.documents.update_one(
        {"document_id": "3c64c88fc87743c08980fad8b3c33985"},
        {
            "$set": {
                "status": "published",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "published_by": "ddd8e614-c8d3-411d-be34-016a20f17fe9"
            }
        }
    )
    print(f"Modified count: {result.modified_count}")

if __name__ == "__main__":
    asyncio.run(main())
