import asyncio
import httpx
import json

async def run_test():
    prompt = "Lagu pop ceria tentang fotosintesis."
    tags = "pop, romantic"
    lyrics = "[verse]\nDaun hijau menyerap cahaya surya."

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            call_url = "https://ace-step-ace-step.hf.space/gradio_api/call/__call__"
            r2 = await client.post(
                call_url,
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
                    ]
                },
                timeout=30.0
            )
            if r2.status_code == 200:
                event_id = r2.json().get("event_id")
                if event_id:
                    status_url = f"https://ace-step-ace-step.hf.space/gradio_api/call/__call__/{event_id}"
                    async with client.stream("GET", status_url, timeout=120.0) as response:
                        if response.status_code == 200:
                            async for line in response.aiter_lines():
                                print(f"LINE: {line}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
