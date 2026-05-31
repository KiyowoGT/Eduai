import asyncio
import httpx
import json
import random

async def run_test():
    host = "https://timefractal-ace-step-turbo-music-gen.hf.space"
    tags = "upbeat pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya."
    session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            join_url = f"{host}/gradio_api/queue/join"
            r = await client.post(
                join_url,
                json={
                    "data": [
                        tags,
                        lyrics,
                        30.0,
                        42,
                        8
                    ],
                    "event_data": None,
                    "fn_index": 0,
                    "trigger_id": 4,
                    "session_hash": session_hash
                },
                timeout=30.0
            )
            if r.status_code == 200:
                status_url = f"{host}/gradio_api/queue/data?session_hash={session_hash}"
                async with client.stream("GET", status_url, timeout=120.0) as response:
                    if response.status_code == 200:
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if line.startswith("data:"):
                                data_str = line[5:].strip()
                                if data_str:
                                    d = json.loads(data_str)
                                    if d.get("msg") == "process_completed":
                                        print("COMPLETED JSON:")
                                        print(json.dumps(d, indent=2))
                                        return
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
