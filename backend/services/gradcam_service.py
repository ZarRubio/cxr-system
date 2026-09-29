import base64
import io

import cv2
import numpy as np
import torch
from PIL import Image
from pytorch_grad_cam import GradCAM, GradCAMPlusPlus, ScoreCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

from models.cnn_vit import CNNViT


def generate_gradcam_layers(
    model: CNNViT,
    tensor: torch.Tensor,
    img_array: np.ndarray,
    predicted_label: int,
    method: str = "gradcam",
) -> tuple[str, str]:
    """
    Generates a legacy overlay and a separate RGB heatmap in one CAM pass.

    Args:
        model: trained CNNViT in eval mode
        tensor: (1, 1, 224, 224) preprocessed tensor in [-1024, 1024]
        img_array: (H, W) uint8 original grayscale image
        predicted_label: class index for which to compute Grad-CAM

    Returns:
        (overlay, pure_heatmap), each a base64 PNG with data URI prefix.
    """
    target_layer = model.cnn_features.denseblock4

    # Resize original image to 224x224 and convert to RGB float [0, 1] for overlay
    img_224 = cv2.resize(img_array, (224, 224))
    img_rgb = np.stack([img_224, img_224, img_224], axis=-1).astype(np.float32) / 255.0

    targets = [ClassifierOutputTarget(predicted_label)]

    cam_cls = {
        "gradcam": GradCAM,
        "gradcam++": GradCAMPlusPlus,
        "scorecam": ScoreCAM,
    }.get(method.lower(), GradCAM)

    with cam_cls(model=model, target_layers=[target_layer]) as cam:
        grayscale_cam = cam(input_tensor=tensor, targets=targets)

    heatmap_overlay = show_cam_on_image(img_rgb, grayscale_cam[0], use_rgb=True)
    heatmap = cv2.cvtColor(
        cv2.applyColorMap(np.uint8(255 * grayscale_cam[0]), cv2.COLORMAP_JET),
        cv2.COLOR_BGR2RGB,
    )
    return _encode_png(heatmap_overlay), _encode_png(heatmap)


def _encode_png(pixels: np.ndarray) -> str:
    pil_image = Image.fromarray(pixels)
    buffer = io.BytesIO()
    pil_image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def generate_gradcam(model, tensor, img_array, predicted_label, method="gradcam") -> str:
    """Legacy overlay used by reports and older clients."""
    return generate_gradcam_layers(model, tensor, img_array, predicted_label, method)[0]
