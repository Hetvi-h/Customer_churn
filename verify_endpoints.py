import requests
import sys

endpoints = [
    "http://localhost:8000/api/segments",
    "http://localhost:8000/api/trends",
    "http://localhost:8000/api/model/feature-importance",
    "http://localhost:8000/api/customers/stats/summary"
]

failed = False
for url in endpoints:
    try:
        response = requests.get(url)
        print(f"{url}: {response.status_code}")
        if response.status_code != 200:
            print(f"Error content: {response.text[:200]}")
            failed = True
    except Exception as e:
        print(f"{url}: Failed - {e}")
        failed = True

if failed:
    sys.exit(1)
