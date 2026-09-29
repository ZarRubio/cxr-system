"""Offline attribution diagnostic. Never used to determine clinical severity."""
import numpy as np
import torch


def evaluate_occlusion(model, tensor, cam, target, fraction=0.1, repeats=20, seed=42):
    """Compare logit drops for high/low attribution and equally sized random masks.

    Input must be the exact preprocessed image and scalar CAM for the same model
    and class, NOT an RGB heatmap or overlay. Mean filling introduces artifacts;
    these measurements are diagnostics, not proof of anatomical correctness.
    """
    cam = np.asarray(cam, dtype=np.float32)
    if tensor.ndim != 4 or tensor.shape[0] != 1 or cam.shape != tuple(tensor.shape[-2:]):
        raise ValueError("Expected one image and a scalar CAM with matching dimensions")
    if not np.isfinite(cam).all() or not torch.isfinite(tensor).all():
        raise ValueError("Inputs must be finite")
    if not 0 < fraction < 1 or repeats < 2:
        raise ValueError("Use 0 < fraction < 1 and at least two controls")
    if np.ptp(cam) <= 1e-8:
        raise ValueError("A constant CAM cannot rank regions")
    count = max(1, int(cam.size * fraction))
    order = np.argsort(cam.reshape(-1), kind="stable")
    rng = np.random.default_rng(seed)
    masks = [order[-count:], order[:count]]
    masks.extend(rng.choice(cam.size, count, replace=False) for _ in range(repeats))
    modes = [(module, module.training) for module in model.modules()]
    try:
        model.eval()
        with torch.inference_mode():
            logits = model(tensor)
            if not 0 <= target < logits.shape[1]:
                raise ValueError("Invalid target class")
            baseline = float(logits[0, target])
            fill = tensor.mean(dim=(-2, -1), keepdim=True)
            drops = []
            for indices in masks:
                mask = torch.zeros(cam.size, dtype=torch.bool, device=tensor.device)
                mask[torch.as_tensor(indices.copy(), device=tensor.device)] = True
                masked = torch.where(mask.reshape(1, 1, *cam.shape), fill, tensor)
                drops.append(baseline - float(model(masked)[0, target]))
    finally:
        for module, training in modes:
            module.training = training
    return {
        "target": int(target), "seed": seed, "fraction": fraction,
        "masked_pixels": count, "baseline_logit": baseline,
        "high_attribution_logit_drop": drops[0],
        "low_attribution_logit_drop": drops[1],
        "random_logit_drops": drops[2:],
        "random_mean_logit_drop": float(np.mean(drops[2:])),
        "random_std_logit_drop": float(np.std(drops[2:], ddof=1)),
        "fill": "per_channel_image_mean", "clinical_validation": False,
    }
