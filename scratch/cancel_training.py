import asyncio
import httpx
import json
import random

async def cancel_training():
    host = "https://werecooking-ace-step-cpu.hf.space"
    print("Sending cancel request to WeReCooking/ACE-Step-CPU...")
    session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.post(
                f"{host}/gradio_api/queue/join",
                json={
                    "data": [],
                    "event_data": None,
                    "fn_index": 4,  # Endpoint 4 is _on_cancel
                    "trigger_id": None,
                    "session_hash": session_hash
                },
                timeout=10.0
            )
            print(f"Join Status: {r.status_code}")
            if r.status_code == 200:
                # Poll for completion
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
                                    print(f"  Event: {msg}")
                                    if msg == "process_completed":
                                        print("  SUCCESSFULLY CANCELLED!")
                                        return True
        except Exception as e:
            print(f"Error: {e}")
    return False

if __name__ == "__main__":
    asyncio.run(cancel_training())
