import json
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from model_manifest import MANIFEST_NAME, build_manifest, verify_manifest


class TestModelManifest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.artifacts = Path(self.directory.name)
        (self.artifacts / "sprint4ml_v1.pt").write_bytes(b"v1")
        (self.artifacts / "sprint4ml_v2.pt").write_bytes(b"v2")
        self._write_json("ensemble_config.json", {
            "checkpoint_v1": "sprint4ml_v1.pt",
            "checkpoint_v2": "sprint4ml_v2.pt",
            "weight_v1": 0.3,
            "weight_v2": 0.7,
            "test_auc_macro": 0.8045,
        })
        self._write_json("model_config_14.json", {"num_classes": 14})
        labels = {str(index): f"Class_{index}" for index in range(14)}
        self._write_json("labels_14.json", labels)
        self._write_json(
            "thresholds_14.json", {"thresholds": {name: 0.3 for name in labels.values()}}
        )

    def _write_json(self, name, value):
        (self.artifacts / name).write_text(json.dumps(value), encoding="utf-8")

    def test_verifies_all_artifacts(self):
        manifest = build_manifest(self.artifacts, app_commit="abc123")
        self._write_json(MANIFEST_NAME, manifest)

        self.assertEqual(verify_manifest(self.artifacts, required=True), manifest)
        self.assertEqual(len(manifest["artifact_sha256"]), 6)
        self.assertIsNone(manifest["research_commit"])
        self.assertEqual(manifest["dataset_audit"], "pending")

    def test_rejects_changed_checkpoint(self):
        self._write_json(MANIFEST_NAME, build_manifest(self.artifacts))
        (self.artifacts / "sprint4ml_v1.pt").write_bytes(b"changed")

        with self.assertRaisesRegex(ValueError, "no coincide"):
            verify_manifest(self.artifacts, required=True)

    def test_requires_manifest_in_production(self):
        self.assertIsNone(verify_manifest(self.artifacts))
        with self.assertRaisesRegex(ValueError, "Falta el manifiesto"):
            verify_manifest(self.artifacts, required=True)

    def test_rejects_mismatched_thresholds(self):
        self._write_json("thresholds_14.json", {"thresholds": {"Other": 0.3}})
        with self.assertRaisesRegex(ValueError, "clases y los umbrales"):
            build_manifest(self.artifacts)

    def test_rejects_invalid_weights(self):
        path = self.artifacts / "ensemble_config.json"
        config = json.loads(path.read_text(encoding="utf-8"))
        config["weight_v1"] = 0.8
        self._write_json("ensemble_config.json", config)
        with self.assertRaisesRegex(ValueError, "sumar 1"):
            build_manifest(self.artifacts)


if __name__ == "__main__":
    unittest.main()
