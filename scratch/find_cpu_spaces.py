import httpx

def find_cpu_spaces():
    url = "https://huggingface.co/api/spaces"
    try:
        r = httpx.get(url, params={"search": "ace-step", "limit": 100})
        if r.status_code == 200:
            spaces = r.json()
            print(f"Found {len(spaces)} spaces:")
            for s in spaces:
                space_id = s.get('id')
                # Query detail of this space to get hardware
                try:
                    r_detail = httpx.get(f"{url}/{space_id}")
                    if r_detail.status_code == 200:
                        detail = r_detail.json()
                        runtime = detail.get("runtime", {})
                        hardware = runtime.get("hardware")
                        stage = runtime.get("stage")
                        print(f"- {space_id} | Hardware: {hardware} | Stage: {stage} | SDK: {detail.get('sdk')}")
                except Exception:
                    pass
        else:
            print(f"Failed: {r.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_cpu_spaces()
