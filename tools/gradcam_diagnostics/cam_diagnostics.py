"""Instrument existing CAM methods without changing model predictions."""
import math

import cv2
import numpy as np
import torch
from pytorch_grad_cam import GradCAM, HiResCAM, LayerCAM


def patch_tokens_to_grid(tokens):
    patches = tokens[:, 1:, :]
    side = math.isqrt(patches.shape[1])
    if side * side != patches.shape[1]:
        raise ValueError('Expected CLS token followed by a square patch grid')
    return patches.reshape(tokens.shape[0], side, side, tokens.shape[2]).permute(0, 3, 1, 2)


class EnsembleScore(torch.nn.Module):
    """Differentiate the actual weighted sigmoid score, not averaged CAM images."""
    def __init__(self, v1, v2, w1, w2, temperature=1.0):
        super().__init__()
        if temperature <= 0 or min(w1, w2) < 0 or abs(w1+w2-1) > 1e-6:
            raise ValueError('Invalid ensemble weights or temperature')
        self.v1, self.v2 = v1, v2
        self.w1, self.w2, self.temperature = w1, w2, temperature

    def forward(self, tensor):
        return (self.w1 * torch.sigmoid(self.v1(tensor) / self.temperature)
                + self.w2 * torch.sigmoid(self.v2(tensor) / self.temperature))


class Capture:
    def get_cam_image(self, input_tensor, target_layer, targets, activations, grads, eigen_smooth=False):
        raw = super().get_cam_image(input_tensor, target_layer, targets, activations, grads, eigen_smooth)
        self.raw_maps = getattr(self, 'raw_maps', []) + [np.array(raw, copy=True)]
        self.layer_diagnostics = getattr(self, 'layer_diagnostics', []) + [{
            'activation_shape': list(activations.shape), 'gradient_shape': list(grads.shape),
            'activation_finite': bool(np.isfinite(activations).all()),
            'gradient_finite': bool(np.isfinite(grads).all()),
            'gradient_l2': float(np.linalg.norm(grads)),
            'gradient_max_abs': float(np.max(np.abs(grads))),
            'raw_min': float(np.min(raw)), 'raw_max': float(np.max(raw)),
            'raw_positive_fraction': float(np.mean(raw > 0)),
        }]
        return raw


class DiagnosticGradCAM(Capture, GradCAM):
    pass


class DiagnosticHiResCAM(Capture, HiResCAM):
    pass


class DiagnosticLayerCAM(Capture, LayerCAM):
    pass


class EnsembleGradCAM(DiagnosticGradCAM):
    def compute_cam_per_layer(self, input_tensor, targets, eigen_smooth):
        activations = self.activations_and_grads.activations
        gradients = self.activations_and_grads.gradients
        raw = []
        for i, layer in enumerate(self.target_layers):
            raw.append(self.get_cam_image(input_tensor, layer, targets,
                       activations[i].detach().cpu().numpy(),
                       gradients[i].detach().cpu().numpy(), eigen_smooth))
        if any(item.shape != raw[0].shape for item in raw):
            raise ValueError('Ensemble branch maps must have the same spatial grid')
        # Gradients already include ensemble weights and temperature. Sum signed
        # branch contributions before ReLU/normalization; never average RGB maps.
        combined = np.maximum(np.sum(raw, axis=0), 0)
        self.combined_raw = np.sum(raw, axis=0)
        normalized = []
        width, height = self.get_target_width_height(input_tensor)
        for item in combined:
            item = item - item.min()
            item = item / (item.max() + 1e-7)
            normalized.append(cv2.resize(item, (width, height)))
        return [np.array(normalized, dtype=np.float32)[:, None, :, :]]


class EnsembleHiResCAM(DiagnosticHiResCAM):
    compute_cam_per_layer = EnsembleGradCAM.compute_cam_per_layer
