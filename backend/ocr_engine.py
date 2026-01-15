import pytesseract
from pdf2image import convert_from_path
import re
import cv2
import numpy as np
import shutil

# Mac Tesseract setup
tesseract_path = shutil.which("tesseract")
if tesseract_path:
    pytesseract.pytesseract.tesseract_cmd = tesseract_path

def extract_carbon_value(pdf_path):
    try:
        pages = convert_from_path(pdf_path)
        full_text = ""
        
        for page in pages:
            # OpenCV Pre-processing (Grayscale + Threshold)
            img = np.array(page)
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Extract text
            full_text += pytesseract.image_to_string(thresh)

        # IMPROVED REGEX: 
        # This looks for a number followed by tons/tCO2e/tonnes
        # It handles decimals like 750.5
        pattern = r'(\d+(?:\.\d+)?)\s*(?:tons|tCO2e|tonnes)'
        matches = re.findall(pattern, full_text, re.IGNORECASE)
        
        if matches:
            # Convert all matches to floats and return the largest one
            # This avoids picking up small stray numbers like "1"
            return max([float(x) for x in matches])

        return 0.0
    except Exception as e:
        print(f"OCR Error: {e}")
        return 0.0