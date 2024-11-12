from any_parser import AnyParser

import sys

# Check if the file path is provided
if len(sys.argv) < 2:
    print("Usage: python script.py <file_path>")
    sys.exit(1)

# Get the file path from the command-line arguments
file_path = sys.argv[1]

ap = AnyParser(api_key="cXikpRUClC7rXHzOBAr1L9OLi1WzJKpm3EQrVzaJ")

file_id = ap.async_extract(file_path=file_path)

md = ap.async_fetch(file_id=file_id)

print(md)  # Optionally print or process the result
