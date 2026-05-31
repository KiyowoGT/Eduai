import asyncio
import httpx
import json
import random

async def test_cpu_space(space_id):
    host = f"https://{space_id.replace('/', '-').lower()}.hf.space"
    print(f"\nTesting CPU Space: {space_id} ({host})")
    tags = "pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya.\n[chorus]\nKlorofil mengubah energi menjadi makanan."

    session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))
    async with httpx.AsyncClient(timeout=180.0) as client:
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
                timeout=15.0
            )
            print(f"Join Status: {r.status_code}")
            if r.status_code != 200:
                print(f"  Failed join: {r.text}")
                return False
                
            status_url = f"{host}/gradio_api/queue/data?session_hash={session_hash}"
            print("Listening to stream...")
            async with client.stream("GET", status_url, timeout=120.0) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str:
                                d = json.loads(data_str)
                                msg = d.get("msg")
                                print(f"  Event: {msg}")
                                if msg == "process_completed":
                                    if "output" in d and "error" in d["output"]:
                                        print(f"  Error: {d['output']['error']}")
                                        return False
                                    output_data = d.get("output", {}).get("data", [])
                                    if output_data and isinstance(output_data[0], dict) and "url" in output_data[0]:
                                        url = output_data[0]["url"]
                                        if url.startswith("/"):
                                            url = host + url
                                        print(f"\nSUCCESS! Generated URL: {url}")
                                        return True
                                elif msg == "process_failed":
                                    print("  Process failed")
                                    return False
        except Exception as e:
            print(f"Error: {e}")
    return False

async def main():
    spaces = [
        "LububMusicAi/ACE-Step-Custom",
        "timefractal/ACE-Step-Turbo-Music-Gen"
    ]
    for s in spaces:
        res = await test_cpu_space(s)
        if res:
            print(f"\nWINNER FOUND: {s} works perfectly!")
            break

if __name__ == "__main__":
    asyncio.run(main())
