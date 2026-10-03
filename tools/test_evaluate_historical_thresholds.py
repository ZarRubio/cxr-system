import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from evaluate_historical_thresholds import CLASSES, operating_metrics, run


class FixedThresholdTests(unittest.TestCase):
    def test_thresholds_and_rounded_boundary_match_inference(self):
        labels = np.tile([[1], [0], [0], [1]], (1, 14))
        scores = np.tile([[.2999996], [.2999994], [.9], [.1]], (1, 14))
        rows = operating_metrics(labels, scores, dict.fromkeys(CLASSES, .3))
        for row in rows.values():
            self.assertEqual((row['tp'], row['fp'], row['tn'], row['fn']), (1, 1, 1, 1))
            self.assertEqual(row['sensitivity'], .5)
            self.assertEqual(row['specificity'], .5)
            self.assertEqual(row['precision'], .5)

    def test_undefined_denominators_remain_null(self):
        labels, scores = np.zeros((4, 14)), np.zeros((4, 14))
        rows = operating_metrics(labels, scores, dict.fromkeys(CLASSES, .3))
        for row in rows.values():
            self.assertIsNone(row['sensitivity'])
            self.assertIsNone(row['precision'])
            self.assertEqual(row['specificity'], 1)

    def test_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.json'
            path.write_text('original')
            with self.assertRaises(FileExistsError):
                run(Path('unused'), Path('unused'), Path('unused'), path)
            self.assertEqual(path.read_text(), 'original')

    def test_rejects_unverified_predictions_before_evaluation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            predictions, evidence = root / 'p.npz', root / 'e.json'
            np.savez(predictions, test_labels=np.zeros((4, 14)))
            evidence.write_text(json.dumps({'status': 'reproduced', 'predictions_sha256': 'wrong'}))
            with self.assertRaises(ValueError):
                run(predictions, evidence, root, root / 'output.json')


if __name__ == '__main__':
    unittest.main()
