import requests
import argparse

# Set up argument parser
parser = argparse.ArgumentParser(description="Upload a file with a specified filename.")
parser.add_argument("file_name", type=str, help="The name of the file to upload")

# Parse arguments
args = parser.parse_args()

# URL and payload configuration
url = "https://public-api.cambio-ai.com/async/upload"

payload = {
    "file_name": args.file_name,
    "process_type": "file",
    "extract_args": {}
}
headers = {
    "x-api-key": "cXikpRUClC7rXHzOBAr1L9OLi1WzJKpm3EQrVzaJ",
    "Content-Type": "application/json"
}

# Send request
response = requests.post(url, json=payload, headers=headers)

# Print response
print(response.text)
