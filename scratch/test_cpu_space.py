import httpx
import json

async def run_test():
    host = "https://werecooking-ace-step-cpu.hf.space"
    print(f"Testing WeReCooking/ACE-Step-CPU: {host}")
    try:
        r = httpx.get(f"{host}/config", timeout=15.0)
        print(f"Config Status: {r.status_code}")
        if r.status_code == 200:
            config = r.json()
            dependencies = config.get("dependencies", [])
            print(f"Found {len(dependencies)} endpoints:")
            for idx, dep in enumerate(dependencies):
                print(f"  Endpoint {idx}: {dep.get('api_name')} -> {dep.get('id') or dep.get('fn_index')}")
        else:
            # Try fetching index HTML to see if it wakes up
            r_home = httpx.get(host, timeout=15.0)
            print(f"Home Status: {r_home.status_code}")
            print(r_home.text[:500])
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_test())
