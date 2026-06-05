import requests

from settings import settings

BACKEND_URL = str(settings.backend_url).rstrip("/")


def call_predict_api(
    file_bytes: bytes,
    filename: str,
    gradcam_method: str = "gradcam",
    mc_passes: int = 1,
    include_gradcam: bool = False,
) -> dict:
    """Posts an image to the backend /predict endpoint and returns the JSON response."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/predict",
            files={"file": (filename, file_bytes)},
            params={
                "gradcam_method": gradcam_method,
                "mc_passes": mc_passes,
                "include_gradcam": str(include_gradcam).lower(),
            },
            timeout=240,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        return {"error": f"No se puede conectar al backend ({BACKEND_URL}). Verifica la variable BACKEND_URL."}
    except requests.exceptions.Timeout:
        return {"error": "El servidor tardó demasiado. Intenta de nuevo."}
    except requests.exceptions.HTTPError as e:
        detail = e.response.json().get("detail", str(e)) if e.response else str(e)
        return {"error": f"Error del servidor: {detail}"}
    except Exception as e:
        return {"error": str(e)}


def get_model_info() -> dict:
    """Fetches centralized model metadata used by the UI."""
    try:
        response = requests.get(f"{BACKEND_URL}/model-info", timeout=20)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        return {"error": "No se puede conectar al backend."}
    except requests.exceptions.Timeout:
        return {"error": "El servidor tardo demasiado al cargar metadatos."}
    except requests.exceptions.HTTPError as e:
        detail = e.response.json().get("detail", str(e)) if e.response else str(e)
        return {"error": f"Error del servidor: {detail}"}
    except Exception as e:
        return {"error": str(e)}
