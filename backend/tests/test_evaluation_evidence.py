import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from evaluation_evidence import EXPECTED_SHA256, evidence_for_manifest


class TestEvaluationEvidence(unittest.TestCase):
    def test_returns_reproduced_metrics_for_matching_artifacts(self):
        manifest = {"artifact_sha256": dict(EXPECTED_SHA256)}
        evidence = evidence_for_manifest(manifest)
        self.assertAlmostEqual(evidence["auc_macro"], 0.8044989191922561)
        self.assertEqual(evidence["n_test_images"], 4023)
        self.assertEqual(len(evidence["metrics"]), 14)

    def test_hides_metrics_when_checkpoint_or_config_changes(self):
        for name in EXPECTED_SHA256:
            with self.subTest(name=name):
                hashes = dict(EXPECTED_SHA256)
                hashes[name] = "0" * 64
                self.assertIsNone(evidence_for_manifest({"artifact_sha256": hashes}))

    def test_hides_metrics_without_manifest(self):
        self.assertIsNone(evidence_for_manifest(None))
        self.assertIsNone(evidence_for_manifest({}))


if __name__ == "__main__":
    unittest.main()
