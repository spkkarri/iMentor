import fitz  # PyMuPDF

def extract_text_from_pdf(pdf_path):
    try:
        with fitz.open(pdf_path) as doc:
            text = ""
            for page in doc:
                text += page.get_text()
            return text
    except RuntimeError as e:
        if "password" in str(e).lower():
            print("The PDF is password-protected.")
        else:
            print(f"RuntimeError: {e}")
        return ""

extract_text_from_pdf("V23 CAI & AIM Syllabus Book.pdf")
# Uncomment the lines below to check the version of PyMuPDF

# import fitz
# print(fitz.__file__)
# print(fitz.__version__)