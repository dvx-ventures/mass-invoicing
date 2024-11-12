import requests
import argparse
import base64

# Initialize argument parser
parser = argparse.ArgumentParser(description="Extract information from a PDF file using Cambio API.")
parser.add_argument("pdf_file", type=str, help="Path to the PDF file to be extracted.")
parser.add_argument("output_file", type=str, help="Path to save the output JSON response.")
args = parser.parse_args()

# Read the PDF file content and encode it to base64
with open(args.pdf_file, "rb") as pdf_file:
    file_content = base64.b64encode(pdf_file.read()).decode("utf-8")

# Define the API URL and payload
url = "https://public-api.cambio-ai.com/json/extract"
payload = {
    "file_content": file_content,
    "file_type": "pdf",
    "instruction_args": {"extract_instruction": {}}
}
headers = {
    "x-api-key": "cXikpRUClC7rXHzOBAr1L9OLi1WzJKpm3EQrVzaJ",
    "Content-Type": "application/json"
}

# Make the POST request
response = requests.post(url, json=payload, headers=headers)

# Write the response to the specified output file
with open(args.output_file, "w") as output_file:
    output_file.write(response.text)

print(f"Response saved to {args.output_file}")
