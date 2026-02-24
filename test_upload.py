import requests
import sys

url = "http://localhost:8000/api/predictions/upload-csv"
file_path = "ml/data/gym_churn_us.csv"

try:
    with open(file_path, "rb") as f:
        files = {"file": f}
        print(f"Uploading {file_path} to {url}...")
        response = requests.post(url, files=files)
        
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Upload success!")
        print(response.json())
    else:
        print(f"Upload failed: {response.text}")
        
except Exception as e:
    print(f"Error: {e}")
