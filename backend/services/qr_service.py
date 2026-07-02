"""QR code generation for job fair / training attendance. Fully real."""

import base64
import io

import qrcode


def generate_qr_data_url(token: str) -> str:
    img = qrcode.make(token)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"
