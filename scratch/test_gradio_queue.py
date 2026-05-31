import asyncio
import httpx
import json
import random

async def run_test():
    prompt = "Lagu pop ceria tentang klorofil dan fotosintesis."
    tags = "pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya."

    async with httpx.AsyncClient(timeout=180.0) as client:
        session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))
        try:
            join_url = "https://ace-step-ace-step.hf.space/gradio_api/queue/join"
            r2 = await client.post(
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
                timeout=30.0
            )
            
            if r2.status_code == 200:
                status_url = f"https://ace-step-ace-step.hf.space/gradio_api/queue/data?session_hash={session_hash}"
                async with client.stream("GET", status_url, timeout=120.0) as response:
                    if response.status_code == 200:
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if line.startswith("data:"):
                                data_str = line[5:].strip()
                                if data_str:
                                    d = json.loads(data_str)
                                    msg = d.get("msg")
                                    if msg == "process_completed":
                                        print("FULL COMPLETED JSON:")
                                        print(json.dumps(d, indent=2))
                                        return
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
