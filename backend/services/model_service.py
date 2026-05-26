import torch

from models.cnn_vit import CNNViT


def load_model(checkpoint_path: str) -> CNNViT:
    """Loads the CNN-ViT model from a checkpoint file."""
    model = CNNViT(
        num_classes=4,
        embedding_dim=512,
        num_heads=8,
        num_layers=4,
        mlp_dim=1024,
        dropout=0.1,
    )
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()
    return model


def run_inference(model: CNNViT, tensor: torch.Tensor) -> dict:
    """
    Runs forward pass and returns softmax probabilities.
    tensor: (1, 1, 224, 224) in [-1024, 1024]
    Returns: {"probs": [p0, p1, p2, p3], "predicted_label": int}
    """
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0].tolist()
    predicted_label = int(torch.argmax(torch.tensor(probs)).item())
    return {"probs": probs, "predicted_label": predicted_label}
