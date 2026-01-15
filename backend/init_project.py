import os

# Define the folder structure
folders = ['uploads']
files = {
    'main.py': '# FastAPI routes go here\nfrom fastapi import FastAPI\napp = FastAPI()\n',
    'ocr_engine.py': '# OCR logic goes here\ndef extract_carbon_value(path):\n    pass\n',
    'requirements.txt': 'fastapi\nuvicorn\npython-multipart\npytesseract\npdf2image\n',
    '.env': 'ETH_NODE_URL=your_infura_or_alchemy_url\nPRIVATE_KEY=your_private_key\n'
}

def setup():
    # Create folders
    for folder in folders:
        if not os.path.exists(folder):
            os.makedirs(folder)
            print(f"Created folder: {folder}")

    # Create files
    for filename, content in files.items():
        if not os.path.exists(filename):
            with open(filename, 'w') as f:
                f.write(content)
            print(f"Created file: {filename}")

if __name__ == "__main__":
    setup()
    print("\nProject structure is ready!")