Click/Tap on any node → opens a modal showing the full chunk text
import requests
try:
    res = requests.get("http://localhost:8000", timeout=2)
    print("OK: Backend is running!")
    print(res.json())
except Exception as e:
    print("ERROR: Backend NOT running:", str(e))
