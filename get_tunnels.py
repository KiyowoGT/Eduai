import urllib.request, json
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels") as response:
        print(json.dumps(json.loads(response.read().decode()), indent=2))
except Exception as e:
    print("Error:", e)
