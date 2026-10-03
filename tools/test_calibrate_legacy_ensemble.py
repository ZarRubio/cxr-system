import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from calibrate_legacy_ensemble import CLASSES, evaluate, fit_temperature, run, select_thresholds, transform


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.labels = np.tile([[0], [0], [1], [1]], (1, 14))
        self.scores = np.tile([[.1], [.4], [.6], [.9]], (1, 14))

    def test_identity_and_fixed_midpoint(self):
        np.testing.assert_allclose(transform(self.scores, 1), self.scores)
        self.assertAlmostEqual(float(transform(np.array([.5]), .2669)[0]), .5)

    def test_positive_temperature_preserves_ranking(self):
        self.assertTrue(np.all(np.diff(transform(np.array([.1, .4, .6, .9]), 2)) > 0))
        with self.assertRaises(ValueError):
            transform(self.scores, 0)

    def test_thresholds_and_metrics_use_same_scores(self):
        calibrated = transform(self.scores, 2)
        thresholds = select_thresholds(self.labels, calibrated)
        result = evaluate(self.labels, calibrated, thresholds)
        self.assertEqual(set(thresholds), set(CLASSES))
        for row in result["per_class"].values():
            self.assertEqual(row["tp"], 2)
            self.assertEqual(row["fp"], 0)

    def test_fit_validates_input(self):
        self.assertGreater(fit_temperature(self.labels, self.scores), 0)
        with self.assertRaises(ValueError):
            fit_temperature(self.labels, self.scores * np.nan)
        with self.assertRaises(ValueError):
            select_thresholds(np.zeros_like(self.labels), self.scores)

    def test_output_cannot_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileExistsError):
                run(Path('unused'), Path('unused'), Path(directory))

    def test_test_labels_do_not_change_fitted_parameters(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = []
            for index, test_labels in enumerate([self.labels, 1 - self.labels]):
                predictions = root / f'predictions{index}.npz'
                np.savez(predictions, val_labels=self.labels, val_v1=self.scores,
                         val_v2=self.scores, test_labels=test_labels,
                         test_v1=self.scores, test_v2=self.scores)
                evidence = root / f'evidence{index}.json'
                evidence.write_text(json.dumps({
                    'status': 'reproduced', 'chosen_weight_v1': .3,
                    'source_sha256': {},
                    'predictions_sha256': hashlib.sha256(predictions.read_bytes()).hexdigest(),
                }))
                results.append(run(predictions, evidence, root / f'output{index}', True))
            self.assertEqual(results[0]['temperature'], results[1]['temperature'])
            self.assertEqual(results[0]['thresholds'], results[1]['thresholds'])
            self.assertNotEqual(results[0]['test_candidate']['macro']['auc'],
                                results[1]['test_candidate']['macro']['auc'])

    def test_invalid_hash_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            predictions, evidence = root / 'predictions.npz', root / 'evidence.json'
            np.savez(predictions, val_labels=self.labels)
            evidence.write_text(json.dumps({'status': 'reproduced', 'predictions_sha256': 'wrong'}))
            with self.assertRaises(ValueError):
                run(predictions, evidence, root / 'output')
            self.assertFalse((root / 'output').exists())


if __name__ == '__main__':
    unittest.main()
