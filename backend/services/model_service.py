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
    try:
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    except TypeError:
        checkpoint = torch.load(checkpoint_path, map_location="cpu")
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()
    return model


def run_inference(model: CNNViT, tensor: torch.Tensor, temperature: float = 1.0) -> dict:
    """
    Runs forward pass and returns sigmoid probabilities (independent per class, multi-label).
    Cada clase produce una probabilidad independiente en [0, 1].
    tensor: (1, 1, 224, 224) in [-1024, 1024]
    Returns: {"probs": [p0, p1, p2, p3], "predicted_label": int}
    NOTE: Para calibración óptima el modelo debe reentrenarse con BCEWithLogitsLoss.
    """
    with torch.inference_mode():
        logits = model(tensor)
        probs = torch.sigmoid(logits / max(float(temperature), 1e-6))[0].tolist()
    predicted_label = int(torch.argmax(torch.tensor(probs)).item())
    return {"probs": probs, "predicted_label": predicted_label}


def run_inference_mc_dropout(
    model: CNNViT,
    tensor: torch.Tensor,
    passes: int = 8,
    temperature: float = 1.0,
) -> dict:
    """Runs MC Dropout by enabling only dropout modules during inference."""
    was_training = model.training
    dropout_modules = []
    for module in model.modules():
        if isinstance(module, torch.nn.Dropout):
            dropout_modules.append(module)
            module.train()

    probs_runs = []
    with torch.no_grad():
        for _ in range(max(passes, 2)):
            logits = model(tensor)
            probs_runs.append(torch.sigmoid(logits / max(float(temperature), 1e-6))[0])

    for module in dropout_modules:
        module.eval()
    if was_training:
        model.train()

    stacked = torch.stack(probs_runs)
    mean = stacked.mean(dim=0).tolist()
    std = stacked.std(dim=0).tolist()
    predicted_label = int(torch.argmax(torch.tensor(mean)).item())
    return {"probs": mean, "std": std, "predicted_label": predicted_label}
