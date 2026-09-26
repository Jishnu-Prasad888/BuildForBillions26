"""Synthetic forms used by the tests (no external files)."""
import fitz


def sample_form_pdf(rotate: int = 0) -> bytes:
    doc = fitz.open()
    p = doc.new_page(width=595, height=842)

    def T(x, y, s, size=11):
        p.insert_text((x, y), s, fontsize=size, fontname="helv")

    T(180, 60, "CROP LOSS APPLICATION FORM", 16)
    T(50, 110, "Name of Applicant:")
    p.draw_line((190, 113), (500, 113), width=0.8)
    T(50, 145, "Date of Birth: __/__/____")
    T(50, 215, "Gender:")
    for i, lab in enumerate(["Male", "Female", "Other"]):
        x = 110 + i * 90
        p.draw_rect(fitz.Rect(x, 205, x + 10, 215), width=0.8)
        T(x + 15, 214, lab)
    T(50, 250, "Address:")
    p.draw_line((50, 280), (540, 280), width=0.8)
    p.draw_line((50, 305), (540, 305), width=0.8)
    T(50, 340, "Phone Number")
    p.draw_rect(fitz.Rect(180, 326, 400, 346), width=0.8)
    T(50, 380, "Identity Proof:")
    for i, lab in enumerate(["Aadhaar", "Driving Licence"]):
        y = 372 + i * 20
        p.draw_rect(fitz.Rect(150, y, 160, y + 10), width=0.8)
        T(166, y + 9, lab)
    T(50, 440, "Land Survey Number:")
    p.draw_line((190, 443), (330, 443), width=0.8)
    T(340, 440, "Taluk:")
    p.draw_line((380, 443), (540, 443), width=0.8)
    T(50, 730, "Signature of Applicant:")
    p.draw_line((190, 733), (400, 733), width=0.8)
    if rotate:
        p.set_rotation(rotate)
    return doc.tobytes()


def rotated_form_pdf() -> bytes:
    """Upright-looking form stored sideways with /Rotate (typical of scanned PDFs): mediabox 842x595, displayed 595x842."""
    src = fitz.open(stream=sample_form_pdf(), filetype="pdf")
    doc = fitz.open()
    page = doc.new_page(width=842, height=595)
    page.show_pdf_page(page.rect, src, 0, rotate=90)
    page.set_rotation(90)
    return doc.tobytes()


def fillable_pdf() -> bytes:
    doc = fitz.open()
    p = doc.new_page(width=595, height=842)
    p.insert_text((50, 100), "Full Name", fontsize=11, fontname="helv")
    p.insert_text((50, 150), "Mobile Number", fontsize=11, fontname="helv")
    p.insert_text((50, 200), "I agree to the terms", fontsize=11, fontname="helv")
    for name, rect, wtype in (("full_name", (150, 85, 400, 105), fitz.PDF_WIDGET_TYPE_TEXT),
                              ("mobile", (150, 135, 400, 155), fitz.PDF_WIDGET_TYPE_TEXT),
                              ("agree", (200, 190, 212, 202), fitz.PDF_WIDGET_TYPE_CHECKBOX)):
        w = fitz.Widget()
        w.field_name, w.field_type, w.rect = name, wtype, fitz.Rect(*rect)
        if wtype == fitz.PDF_WIDGET_TYPE_TEXT:
            w.field_value = ""
        p.add_widget(w)
    return doc.tobytes()


def encrypted_pdf() -> bytes:
    doc = fitz.open()
    doc.new_page().insert_text((50, 100), "secret")
    return doc.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="pw", owner_pw="pw")


def render_png(pdf: bytes, dpi: int = 170) -> bytes:
    with fitz.open(stream=pdf, filetype="pdf") as d:
        return d[0].get_pixmap(dpi=dpi, alpha=False).tobytes("png")


def kcc_form_pdf() -> bytes:
    """A fillable KCC-style application: the fields from the KCC bug transcript, including an office-use box."""
    doc = fitz.open()
    p = doc.new_page(width=595, height=842)
    p.insert_text((180, 60), "KISAN CREDIT CARD APPLICATION", fontsize=14, fontname="helv")
    rows = [
        ("Branch", "branch", fitz.PDF_WIDGET_TYPE_TEXT, None),
        ("To", "to", fitz.PDF_WIDGET_TYPE_TEXT, None),
        ("Select one", "card_type", fitz.PDF_WIDGET_TYPE_COMBOBOX, ["New Card", "Renewal"]),
        ("Name of Applicant", "name", fitz.PDF_WIDGET_TYPE_TEXT, None),
        ("Account Number", "account", fitz.PDF_WIDGET_TYPE_TEXT, None),
        ("IFSC Code", "ifsc", fitz.PDF_WIDGET_TYPE_TEXT, None),
        ("Mobile Number", "mobile", fitz.PDF_WIDGET_TYPE_TEXT, None),
        ("70 office use", "office", fitz.PDF_WIDGET_TYPE_TEXT, None),
    ]
    for i, (label, name, wtype, choices) in enumerate(rows):
        y = 110 + i * 40
        p.insert_text((50, y), label, fontsize=11, fontname="helv")
        w = fitz.Widget()
        w.field_name, w.field_type, w.rect = name, wtype, fitz.Rect(200, y - 14, 480, y + 4)
        if choices:
            w.choice_values = choices
        else:
            w.field_value = ""
        p.add_widget(w)
    return doc.tobytes()
