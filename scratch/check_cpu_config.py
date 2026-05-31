import httpx

r = httpx.get("https://werecooking-ace-step-cpu.hf.space/config")
if r.status_code == 200:
    config = r.json()
    dependencies = config.get("dependencies", [])
    dep = dependencies[4]  # Endpoint 4
    inputs = dep.get("inputs", [])
    components = config.get("components", [])
    print(f"Inputs count for Endpoint 4: {len(inputs)}")
    for idx, inp_id in enumerate(inputs):
        comp = next((c for c in components if c.get("id") == inp_id), {})
        print(f"Input {idx}: Label: '{comp.get('props', {}).get('label')}', Type: {comp.get('type')}")
else:
    print("Failed")
