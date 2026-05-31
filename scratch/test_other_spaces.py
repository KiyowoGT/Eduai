import asyncio
import httpx
import json
import random

async def test_space(space_host, space_name):
    print(f"\n--- Testing Space: {space_name} ({space_host}) ---")
    tags = "pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya."
    
    session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # 1. Join queue
            join_url = f"{space_host}/gradio_api/queue/join"
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
                print(f"Failed to join: {r.text}")
                return False
                
            # 2. Poll status
            status_url = f"{space_host}/gradio_api/queue/data?session_hash={session_hash}"
            async with client.stream("GET", status_url, timeout=60.0) as response:
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
                                    print("  SUCCESS!")
                                    print(json.dumps(d, indent=2)[:500])
                                    return True
                                elif msg == "process_failed":
                                    print("  Failed")
                                    return False
        except Exception as e:
            print(f"Error calling {space_name}: {e}")
    return False

async def main():
    # Test spaces
    spaces = [
        ("https://victor-ace-step-jam.hf.space", "victor/ace-step-jam"),
        ("https://ace-step-ace-step-v1-5.hf.space", "ACE-Step/Ace-Step-v1.5"),
        ("https://ace-step-ace-step.hf.space", "ACE-Step/ACE-Step")
    ]
    for host, name in spaces:
        success = await test_space(host, name)
        if success:
            print(f"\nWINNER: {name} works perfectly!")
            break

if __name__ == "__main__":
    asyncio.run(main())
