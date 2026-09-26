"""Historical NIH test evidence, shown only for matching model artifact hashes."""

EXPECTED_SHA256 = {
    "sprint4ml_v1.pt": "59f98c72981929fde8e6044a78ff46b8b23c519b8f50cd4ad4c85566bf34224b",
    "sprint4ml_v2.pt": "d93fa69ba1e348b8b4653502392a1faee6ef3883a1138968bf6ac05531401813",
    "ensemble_config.json": "27718f166be8beed38081dd8bd01cca7e43daa3a170b14dfbdf019a23628daeb",
    "model_config_14.json": "21836cbfb7bcd196d4d3d433874ca593b6c67f8cac08b5d2f50b8db48f5d0bb6",
}

HISTORICAL_TEST = {
    "auc_macro": 0.8044989191922561,
    "val_auc_macro": 0.7990317790600593,
    "map": 0.1521846954740413,
    "n_test_images": 4023,
    "test_split_sha256": "6bc9c420dcc222b26aa29435ff84cc513bd800d94b0a40c89f0fc6637425b459",
    "metrics": {
        "Atelectasis": {"auc": 0.759508, "ap": 0.185005, "n_positive": 257},
        "Cardiomegaly": {"auc": 0.934950, "ap": 0.354379, "n_positive": 105},
        "Consolidation": {"auc": 0.823054, "ap": 0.082197, "n_positive": 56},
        "Edema": {"auc": 0.925848, "ap": 0.110729, "n_positive": 23},
        "Effusion": {"auc": 0.889035, "ap": 0.390166, "n_positive": 230},
        "Emphysema": {"auc": 0.841911, "ap": 0.095940, "n_positive": 49},
        "Fibrosis": {"auc": 0.803114, "ap": 0.088724, "n_positive": 73},
        "Hernia": {"auc": 0.879093, "ap": 0.048021, "n_positive": 10},
        "Infiltration": {"auc": 0.636111, "ap": 0.214830, "n_positive": 522},
        "Mass": {"auc": 0.808678, "ap": 0.203069, "n_positive": 145},
        "Nodule": {"auc": 0.680921, "ap": 0.133243, "n_positive": 191},
        "Pleural_Thickening": {"auc": 0.783164, "ap": 0.103781, "n_positive": 88},
        "Pneumonia": {"auc": 0.712036, "ap": 0.012622, "n_positive": 25},
        "Pneumothorax": {"auc": 0.785563, "ap": 0.107879, "n_positive": 67},
    },
}


def evidence_for_manifest(manifest: dict | None) -> dict | None:
    if not isinstance(manifest, dict):
        return None
    hashes = manifest.get("artifact_sha256")
    if not isinstance(hashes, dict):
        return None
    if any(hashes.get(name) != expected for name, expected in EXPECTED_SHA256.items()):
        return None
    return HISTORICAL_TEST
