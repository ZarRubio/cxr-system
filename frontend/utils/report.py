import base64
import io
from datetime import datetime

from PIL import Image

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
except ModuleNotFoundError:
    REPORTLAB_AVAILABLE = False
    colors = None
    A4 = None
    ImageReader = None
    canvas = None
else:
    REPORTLAB_AVAILABLE = True


def _decode_gradcam(data_uri: str) -> bytes:
    if "," in data_uri:
        data_uri = data_uri.split(",", 1)[1]
    return base64.b64decode(data_uri)


def _image_reader(image_bytes: bytes):
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _draw_wrapped(pdf, text: str, x: int, y: int, width_chars: int, leading: int = 11) -> int:
    text_obj = pdf.beginText(x, y)
    text_obj.setLeading(leading)
    for i in range(0, len(text), width_chars):
        text_obj.textLine(text[i:i + width_chars])
    pdf.drawText(text_obj)
    return y - leading * (len(text) // width_chars + 1)


def build_prediction_pdf(filename: str, original_bytes: bytes, response: dict) -> bytes:
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("Instala reportlab para generar PDF: pip install reportlab")

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFillColor(colors.HexColor("#0F172A"))
    pdf.rect(0, height - 92, width, 92, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(42, height - 42, "Reporte CXR Classifier")
    pdf.setFont("Helvetica", 9)
    pdf.drawString(42, height - 62, "Sistema academico de apoyo diagnostico - HNAL 2026")
    pdf.drawRightString(width - 42, height - 62, datetime.now().strftime("%Y-%m-%d %H:%M"))

    y = height - 122
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(42, y, "Resumen")
    y -= 18
    pdf.setFont("Helvetica", 10)
    pdf.drawString(52, y, f"Archivo: {filename}")
    y -= 14
    pdf.drawString(52, y, f"Hallazgo principal: {response.get('predicted_class', '-')}")
    y -= 14
    pdf.drawString(52, y, f"Confianza: {response.get('confidence', 0) * 100:.1f}%")
    y -= 14
    pdf.drawString(52, y, f"Tiempo de procesamiento: {response.get('processing_time_ms', 0):.0f} ms")
    y -= 14
    image_hash = response.get("image_hash")
    if image_hash:
        pdf.drawString(52, y, f"Hash SHA256: {image_hash[:24]}...")
        y -= 18

    original = _image_reader(original_bytes)
    gradcam = _image_reader(_decode_gradcam(response.get("gradcam_image", "")))
    pdf.setFont("Helvetica-Bold", 11)
    if original:
        pdf.drawString(42, y, "Imagen original")
        pdf.drawImage(original, 42, y - 185, width=190, height=175, preserveAspectRatio=True, anchor="c")
    if gradcam:
        pdf.drawString(302, y, "Mapa de calor")
        pdf.drawImage(gradcam, 302, y - 185, width=190, height=175, preserveAspectRatio=True, anchor="c")
    y -= 215

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(42, y, "Probabilidades")
    y -= 18
    pdf.setFont("Helvetica", 10)
    for label, prob in response.get("probabilities", {}).items():
        pdf.drawString(52, y, f"{label}: {prob * 100:.1f}%")
        y -= 14

    explanation = response.get("explanation") or {}
    if explanation:
        y -= 10
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(42, y, "Explicabilidad del resultado")
        y -= 14
        pdf.setFont("Helvetica", 9)
        y = _draw_wrapped(pdf, f"Lectura del modelo: {explanation.get('summary', '')}", 52, y, 92, leading=11)
        y = _draw_wrapped(pdf, f"Mapa de calor: {explanation.get('visual', '')}", 52, y, 92, leading=11)
        y = _draw_wrapped(pdf, f"Nota clinica: {explanation.get('clinical', '')}", 52, y, 92, leading=11)

    uncertainty = response.get("uncertainty_std")
    if uncertainty:
        y -= 10
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(42, y, "Incertidumbre predictiva")
        y -= 16
        pdf.setFont("Helvetica", 9)
        for label, std in uncertainty.items():
            pdf.drawString(52, y, f"{label}: +/- {std * 100:.1f} pp")
            y -= 12

    warnings = response.get("image_warnings") or []
    if warnings:
        y -= 8
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(42, y, "Alertas de calidad de imagen")
        y -= 14
        pdf.setFont("Helvetica", 9)
        for warning in warnings:
            y = _draw_wrapped(pdf, f"- {warning}", 52, y, 90, leading=11)

    y -= 12
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(42, y, "Disclaimer")
    y -= 14
    pdf.setFont("Helvetica", 8)
    _draw_wrapped(pdf, response.get("disclaimer", ""), 42, y, 95, leading=11)

    pdf.setFont("Helvetica-Oblique", 7)
    pdf.setFillColor(colors.HexColor("#4B5563"))
    pdf.drawString(
        42,
        28,
        "Documento generado automaticamente. No constituye diagnostico medico independiente.",
    )

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
