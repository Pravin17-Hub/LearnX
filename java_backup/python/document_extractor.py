import sys
import os
import zipfile
import xml.etree.ElementTree as ET
import pdfplumber

def extract_docx(file_path):
    try:
        with zipfile.ZipFile(file_path) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            texts = []
            for elem in root.iter(ns + 't'):
                if elem.text:
                    texts.append(elem.text)
            return '\n'.join(texts)
    except Exception as e:
        return f"ERROR: Failed to extract DOCX: {str(e)}"

def extract_pdf(file_path):
    try:
        text_content = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_content.append(text)
        return '\n'.join(text_content)
    except Exception as e:
        return f"ERROR: Failed to extract PDF: {str(e)}"

def main():
    if len(sys.argv) < 2:
        print("ERROR: Missing file path argument.")
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"ERROR: File '{file_path}' does not exist.")
        sys.exit(1)
        
    _, ext = os.path.splitext(file_path.lower())
    
    if ext == '.pdf':
        print(extract_pdf(file_path))
    elif ext in ['.docx', '.doc']:
        print(extract_docx(file_path))
    elif ext in ['.jpg', '.jpeg', '.png']:
        # Indicate to Java that we need multimodal API OCR
        print("[MULTIMODAL_IMAGE_OCR]")
    elif ext in ['.txt']:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                print(f.read())
        except Exception as e:
            print(f"ERROR: Failed to read text file: {str(e)}")
    else:
        print(f"ERROR: Unsupported file format '{ext}'")
        sys.exit(1)

if __name__ == '__main__':
    main()
