import sys
import asyncio
sys.path.append("c:\\Users\\ganxa\\Downloads\\My Project\\Eduai\\backend")

from core.database import db

async def main():
    # Find some students
    students = await db.users.find({"role": "pelajar"}).to_list(100)
    print(f"Total students: {len(students)}")
    for s in students:
        print(f"User ID: {s.get('user_id')}")
        print(f"Name: {s.get('name')}")
        print(f"Hobby: {s.get('hobby')}")
        print(f"Music Genre: {s.get('music_genre')}")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(main())
