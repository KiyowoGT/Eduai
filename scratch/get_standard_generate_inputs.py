import httpx

r = httpx.get("https://lububmusicai-ace-step-custom.hf.space/config", timeout=15.0)
if r.status_code == 200:
    config = r.json()
    dependencies = config.get("dependencies", [])
    dep = dependencies[0]
    inputs = dep.get("inputs", [])
    components = config.get("components", [])
    print(f"Inputs count for standard_generate: {len(inputs)}")
    for idx, inp_id in enumerate(inputs):
        comp = next((c for c in components if c.get("id") == inp_id), {})
        print(f"Input {idx}: Label: '{comp.get('props', {}).get('label')}', Type: {comp.get('type')}, Default: {comp.get('props', {}).get('value')}")
else:
    print("Failed")
