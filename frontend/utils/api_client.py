import os

import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def call_predict_api(file_bytes: bytes, filename: str) -> dict:
    """Posts an image to the backend /predict endpoint and returns the JSON response."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/predict",
            files={"file": (filename, file_bytes)},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        return {"error": "No se puede conectar al backend. ¿Está corriendo en http://localhost:8000?"}
    except requests.exceptions.Timeout:
        return {"error": "El servidor tardó demasiado. Intenta de nuevo."}
    except requests.exceptions.HTTPError as e:
        detail = e.response.json().get("detail", str(e)) if e.response else str(e)
        return {"error": f"Error del servidor: {detail}"}
    except Exception as e:
        return {"error": str(e)}
