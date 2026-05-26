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


def generate_gradcam(
    model: CNNViT,
    tensor: torch.Tensor,
    img_array: np.ndarray,
    predicted_label: int,
    method: str = "gradcam",
) -> str:
    """
    Generates a Grad-CAM heatmap overlay for the predicted class.

    Args:
        model: trained CNNViT in eval mode
        tensor: (1, 1, 224, 224) preprocessed tensor in [-1024, 1024]
        img_array: (H, W) uint8 original grayscale image
        predicted_label: class index for which to compute Grad-CAM

    Returns:
        Base64-encoded PNG string with data URI prefix.
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

    pil_image = Image.fromarray(heatmap_overlay)
    buffer = io.BytesIO()
    pil_image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"
