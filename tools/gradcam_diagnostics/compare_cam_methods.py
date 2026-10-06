"""Bounded exploratory comparison; never selects a production CAM method."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from cam_diagnostics import (DiagnosticGradCAM, DiagnosticHiResCAM, DiagnosticLayerCAM,
                             EnsembleScore, EnsembleGradCAM, EnsembleHiResCAM, patch_tokens_to_grid)
from gradcam_block_controls import evaluate_blocks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--sample', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--targets', nargs='+', default=['Emphysema'])
    parser.add_argument('--extended', action='store_true')
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError('Evidence is never overwritten')
    sys.path.insert(0, str(args.repo / 'backend'))
    from models.cnn_vit import CNNViT
    from services.model_service import CLASSES_14
    from utils.image_utils import preprocess_for_model
    torch.set_num_threads(2)
    if len(set(args.targets)) != len(args.targets) or any(name not in CLASSES_14 for name in args.targets):
        raise ValueError('Unknown class')
    artifacts = args.repo / 'backend' / 'artifacts'
    cfg = json.loads((artifacts / 'model_config_14.json').read_text())
    ens = json.loads((artifacts / 'ensemble_config.json').read_text())
    models, hashes = {}, {}
    for version in ('v1', 'v2'):
        path = artifacts / ens[f'checkpoint_{version}']
        model = CNNViT(backbone_weights=None, num_classes=cfg['num_classes'],
                       embedding_dim=cfg['embedding_dim'], num_heads=cfg['num_heads'],
                       num_layers=cfg[f'num_layers_{version}'], mlp_dim=cfg['mlp_dim'])
        model.load_state_dict(torch.load(path, map_location='cpu', weights_only=True)['model_state_dict'])
        models[version] = model.eval()
        hashes[version] = hashlib.sha256(path.read_bytes()).hexdigest()
    v1, v2 = models['v1'], models['v2']
    wrapper = EnsembleScore(v1, v2, ens['weight_v1'], ens['weight_v2'], ens.get('temperature', 1.0)).eval()
    variants = [
        ('v2_gradcam_block4', v2, DiagnosticGradCAM, [v2.cnn_features.denseblock4], None),
        ('v2_hirescam_block4', v2, DiagnosticHiResCAM, [v2.cnn_features.denseblock4], None),
        ('v2_layercam_block3', v2, DiagnosticLayerCAM, [v2.cnn_features.denseblock3], None),
        ('v2_gradcam_transformer', v2, DiagnosticGradCAM, [v2.vit.blocks[-1].norm1], patch_tokens_to_grid),
        ('ensemble_gradcam_block4', wrapper, EnsembleGradCAM,
         [v1.cnn_features.denseblock4, v2.cnn_features.denseblock4], None),
    ]
    if args.extended:
        variants = [variants[0], variants[-1],
                    ('ensemble_hirescam_block4', wrapper, EnsembleHiResCAM,
                     [v1.cnn_features.denseblock4, v2.cnn_features.denseblock4], None)]
    files = sorted((args.sample / 'images').glob('*.png'))
    if not files:
        raise ValueError('No PNG images found in sample/images')
    args.output.mkdir(parents=True)
    protocol = {'variants': [v[0] for v in variants], 'targets': args.targets,
                'images': [p.name for p in files], 'checkpoint_sha256': hashes,
                'occlusion': '32x32 gaussian_blur, 20 random controls',
                'limitations': ['Convenience sample; labels and split membership unverified',
                                'Exploratory only; no clinical validation or method selection',
                                'Ensemble drops are score units; v2 drops are logit units']}
    (args.output / 'protocol.json').write_text(json.dumps(protocol, indent=2))
    rows = []
    for path, target_name in [(p, name) for p in files for name in args.targets]:
        target = CLASSES_14.index(target_name)
        pixels = np.array(Image.open(path).convert('L'))
        tensor = preprocess_for_model(pixels)
        for name, model, method, layers, reshape in variants:
            folder = args.output / path.stem / target_name / name
            folder.mkdir(parents=True)
            with torch.enable_grad(), method(model, layers, reshape_transform=reshape) as cam:
                scalar = cam(tensor, targets=[ClassifierOutputTarget(target)])[0]
                diagnostics = cam.layer_diagnostics
                for i, raw in enumerate(cam.raw_maps):
                    np.save(folder / f'raw_signed_{i}.npy', raw)
            valid = bool(np.isfinite(scalar).all() and np.ptp(scalar) > 1e-8)
            controls = evaluate_blocks(model, tensor, scalar, target, sizes=(32,),
                                      repeats=20, fill_names=('gaussian_blur',)) if valid else None
            row = {'image': path.name, 'method': name, 'image_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                   'target_class': target_name, 'output_units': 'score' if model is wrapper else 'logit',
                   'status': 'variable' if valid else 'not_interpretable',
                   'diagnostics': diagnostics, 'controls': controls}
            np.save(folder / 'scalar_cam.npy', scalar)
            rgb = np.repeat(cv2.resize(pixels, (224, 224))[:, :, None], 3, axis=2)
            heat = cv2.cvtColor(cv2.applyColorMap((scalar*255).astype('uint8'), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
            alpha = .4 * scalar[:, :, None]
            Image.fromarray(np.clip(rgb*(1-alpha)+heat*alpha, 0, 255).astype('uint8')).save(folder / 'overlay.png')
            (folder / 'report.json').write_text(json.dumps(row, indent=2))
            rows.append(row)
            print(path.name, target_name, name, row['status'], flush=True)
    (args.output / 'summary.json').write_text(json.dumps({'protocol': protocol, 'cases': rows}, indent=2))


if __name__ == '__main__':
    main()
