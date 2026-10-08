"""Matched rectangular occlusion controls; exploratory, not clinical evidence."""
import cv2
import numpy as np
import torch


def evaluate_blocks(model, tensor, cam, target, sizes=(32, 64), repeats=20, seed=42,
                    fill_names=('image_mean', 'gaussian_blur')):
    cam = np.asarray(cam, dtype=np.float32)
    if tensor.ndim != 4 or tensor.shape[:2] != (1, 1) or cam.shape != tuple(tensor.shape[-2:]):
        raise ValueError('Expected one grayscale image with a matching scalar CAM')
    if not torch.isfinite(tensor).all() or not np.isfinite(cam).all() or np.ptp(cam) <= 1e-8:
        raise ValueError('Inputs must be finite and CAM must not be constant')
    h, w = cam.shape
    if repeats < 2 or any(not 0 < side <= min(h, w) for side in sizes):
        raise ValueError('Invalid block size or number of controls')
    if not fill_names or any(name not in ('image_mean', 'gaussian_blur') for name in fill_names):
        raise ValueError('Unknown occlusion fill')
    modes = [(module, module.training) for module in model.modules()]
    results = []
    try:
        model.eval()
        with torch.inference_mode():
            logits = model(tensor)
            if not 0 <= target < logits.shape[1]:
                raise ValueError('Invalid target class')
            baseline = float(logits[0, target])
            fills = {'image_mean': tensor.mean().expand_as(tensor),
                     'gaussian_blur': torch.from_numpy(cv2.GaussianBlur(
                         tensor[0, 0].cpu().numpy(), (31, 31), 10)).to(tensor).reshape_as(tensor)}
            # Integral sums rank every possible same-sized block without image labels.
            integral = np.pad(cam.astype(np.float64), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
            for side in sizes:
                means = (integral[side:, side:] - integral[:-side, side:]
                         - integral[side:, :-side] + integral[:-side, :-side]) / side**2
                high, low = int(means.argmax()), int(means.argmin())
                available = np.setdiff1d(np.arange(means.size), [high, low])
                if repeats > len(available):
                    raise ValueError('Not enough distinct control positions')
                random = np.random.default_rng(seed + side).choice(available, repeats, replace=False)
                positions = [np.unravel_index(i, means.shape) for i in [high, low, *random]]
                boxes = [[int(y), int(x), int(y+side), int(x+side)] for y, x in positions]
                for fill_name, fill in fills.items():
                    if fill_name not in fill_names:
                        continue
                    drops = []
                    for y, x in positions:
                        masked = tensor.clone()
                        masked[:, :, y:y+side, x:x+side] = fill[:, :, y:y+side, x:x+side]
                        drops.append(baseline - float(model(masked)[0, target]))
                    results.append({
                        'side': side, 'pixels': side**2, 'fill': fill_name,
                        'boxes_yxyx': boxes, 'cam_block_means': [float(means[y, x]) for y, x in positions],
                        'high_logit_drop': drops[0], 'low_logit_drop': drops[1],
                        'random_logit_drops': drops[2:],
                        'random_mean_logit_drop': float(np.mean(drops[2:])),
                        'random_std_logit_drop': float(np.std(drops[2:], ddof=1)),
                        'random_fraction_drop_ge_high': float(np.mean(np.array(drops[2:]) >= drops[0])),
                    })
    finally:
        for module, mode in modes:
            module.training = mode
    return {'baseline_logit': baseline, 'target': target, 'seed': seed,
            'repeats': repeats, 'controls': results, 'clinical_validation': False,
            'limitations': ['Single image; random controls may overlap highlighted regions',
                           'Occlusion and blur may cause distribution shift',
                           'Empirical control fractions are not confirmatory p-values']}
