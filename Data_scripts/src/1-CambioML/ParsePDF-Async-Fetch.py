import requests

url = "https://public-api.cambio-ai.com/async/fetch"

payload = {"file_id": "d2bd053f-3646-4a0b-85d9-a81423007496d75bb334d378264a6eb637002bb9b862fc62c0180dd152a7260f6d6ab2a22dab"}
headers = {
    "x-api-key": "cXikpRUClC7rXHzOBAr1L9OLi1WzJKpm3EQrVzaJ",
    "Content-Type": "application/json"
}

response = requests.request("POST", url, json=payload, headers=headers)

print(response.text)