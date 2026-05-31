import asyncio
import httpx
import json
import random

async def test_clone(space_id):
    host = f"https://{space_id.replace('/', '-').lower()}.hf.space"
    print(f"Testing: {space_id} ({host})")
    tags = "pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya."
    
    session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            join_url = f"{host}/gradio_api/queue/join"
            r = await client.post(
                join_url,
                json={
                    "data": [
                        30.0,
                        tags,
                        lyrics,
                        40,
                        15.0,
                        "euler",
                        "apg",
                        10.0,
                        "",
                        0.5,
                        0.0,
                        3.0,
                        True,
                        False,
                        True,
                        "",
                        0.0,
                        0.0,
                        False,
                        0.5,
                        None,
                        "none"
                    ],
                    "event_data": None,
                    "fn_index": 11,
                    "trigger_id": 45,
                    "session_hash": session_hash
                },
                timeout=10.0
            )
            if r.status_code != 200:
                print(f"  Failed join: status {r.status_code}")
                return False
                
            status_url = f"{host}/gradio_api/queue/data?session_hash={session_hash}"
            async with client.stream("GET", status_url, timeout=30.0) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str:
                                d = json.loads(data_str)
                                msg = d.get("msg")
                                if msg == "process_completed":
                                    if "output" in d and "error" in d["output"]:
                                        err = d["output"]["error"]
                                        print(f"  Failed execution: {err}")
                                        return False
                                    url = d['output']['data'][0]['url']
                                    print(f"  SUCCESS! URL: {url}")
                                    return host
                                elif msg == "process_failed":
                                    print("  Process failed")
                                    return False
        except Exception as e:
            print(f"  Error: {e}")
    return False

async def main():
    clones = [
        "saitejach127/ACE-Step",
        "ZHunkirw/ACE-Step",
        "KUI71/ACE-Step",
        "mbarnig/ACE-Step",
        "guysss/ACE-Step",
        "AhmadFiaz/ACE-Step",
        "APP6161/ACE-Step",
        "mikegpt/ACE-Step",
        "javier233455/ACE-Step",
        "ElLeon17/ACE-Step",
        "yokokome/ACE-Step"
    ]
    for c in clones:
        res = await test_clone(c)
        if res:
            print(f"\nFOUND WORKING CLONE: {c} -> {res}")
            return
    print("\nNo working clones found.")

if __name__ == "__main__":
    asyncio.run(main())
