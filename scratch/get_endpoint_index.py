import httpx

r = httpx.get("https://timefractal-ace-step-turbo-music-gen.hf.space/config", timeout=15.0)
if r.status_code == 200:
    config = r.json()
    dependencies = config.get("dependencies", [])
    for idx, dep in enumerate(dependencies):
        print(f"Endpoint {idx}: {dep.get('api_name')} -> index {dep.get('id') or dep.get('fn_index')}")
else:
    print(f"Failed status: {r.status_code}")
