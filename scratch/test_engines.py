import asyncio
import sys
import os

# Append backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from services.ai_service import aimusic, aimusic_suno

async def run_test():
    prompt = "A happy and educational pop song about photosyntesis in plants, explaining chlorophyll and solar energy."
    print("=== Testing aimusic (Ace-Step Engine) ===")
    try:
        res_old = await aimusic(prompt, "pop, romantic")
        print("Success!")
        print(f"Lyrics (first 100 chars):\n{res_old.get('lyrics', '')[:100]}...")
        print(f"Audio URL: {res_old.get('audio_url', '')}")
    except Exception as e:
        print(f"aimusic failed: {e}")

    print("\n=== Testing aimusic_suno (Suno Engine) ===")
    try:
        res_suno = await aimusic_suno(prompt, "pop, romantic", "Photosynthesis Song")
        print("Success!")
        print(f"Lyrics (first 100 chars):\n{res_suno.get('lyrics', '')[:100]}...")
        print(f"Audio URL: {res_suno.get('audio_url', '')}")
    except Exception as e:
        print(f"aimusic_suno failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
