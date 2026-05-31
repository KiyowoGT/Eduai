import asyncio
import httpx
import json
import random

async def run_test():
    host = "https://lububmusicai-ace-step-custom.hf.space"
    print(f"Testing LububMusicAi standard_generate queue...")
    
    tags = "upbeat pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya.\n[chorus]\nKlorofil mengubah energi menjadi makanan."

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
                        30.0,   # Duration (30s)
                        0.7,    # Temperature
                        0.9,    # Top P
                        -1.0,   # Seed
                        "auto", # Style
                        False,  # Use LoRA
                        ""      # LoRA Path
                    ],
                    "event_data": None,
                    "fn_index": 0,  # standard_generate is Endpoint 0!
                    "trigger_id": 13,
                    "session_hash": session_hash
                },
                timeout=30.0
            )
            print(f"Join Status: {r.status_code}")
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
                                    msg = d.get("msg")
                                    print(f"  Event: {msg}")
                                    if msg == "process_completed":
                                        if "output" in d and "error" in d["output"]:
                                            print(f"  Error: {d['output']['error']}")
                                            return
                                        output_data = d.get("output", {}).get("data", [])
                                        # Let's inspect output_data
                                        print(f"  Output Data: {output_data}")
                                        if output_data and isinstance(output_data[0], dict) and "url" in output_data[0]:
                                            url = output_data[0]["url"]
                                            if url.startswith("/"):
                                                url = host + url
                                            print(f"\nSUCCESS! Generated URL: {url}")
                                            return
                                    elif msg == "process_failed":
                                        print("  Process failed")
                                        return
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
