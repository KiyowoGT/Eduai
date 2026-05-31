import httpx

def find_spaces():
    url = "https://huggingface.co/api/spaces"
    try:
        r = httpx.get(url, params={"search": "ace-step", "limit": 100})
        if r.status_code == 200:
            spaces = r.json()
            print(f"Found {len(spaces)} spaces matching 'ace-step':")
            for s in spaces:
                print(f"- {s.get('id')} (Author: {s.get('author')}, Likes: {s.get('likes')}, SDK: {s.get('sdk')})")
        else:
            print(f"Failed to query HF API search: {r.status_code}")
    except Exception as e:
        print(f"Error search: {e}")

    try:
        r2 = httpx.get(url, params={"search": "acestep", "limit": 100})
        if r2.status_code == 200:
            spaces = r2.json()
            print(f"\nFound {len(spaces)} spaces matching 'acestep':")
            for s in spaces:
                print(f"- {s.get('id')} (Author: {s.get('author')}, Likes: {s.get('likes')}, SDK: {s.get('sdk')})")
    except Exception as e:
        print(f"Error search 2: {e}")

if __name__ == "__main__":
    find_spaces()
