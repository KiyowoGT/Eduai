import asyncio
import httpx
import json
import traceback

async def run_test():
    prompt = "A song about photosynthesis in plants, with clear rhyming educational lyrics."
    query_payload = [
        {
            "role": "system",
            "content": "You are a professional lyricist AI trained to write poetic and rhythmic song lyrics. Respond with lyrics only, using [verse], [chorus], [bridge], and [instrumental] or [inst] tags to structure the song. Use only the tag (e.g., [verse]) without any numbering or extra text. Do not add explanations, titles, or any other text outside of the lyrics. Respond in clean plain text."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.get(
                "https://8pe3nv3qha.execute-api.us-east-1.amazonaws.com/default/llm_chat",
                params={
                    "query": json.dumps(query_payload),
                    "link": "writecream.com"
                },
                timeout=15.0
            )
            print(f"Status: {r.status_code}")
            if r.status_code == 200:
                print("Response Content:")
                print(r.json().get("response_content", "")[:1000])
            else:
                print(f"Failed: {r.text}")
        except Exception as e:
            print(f"Error: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
