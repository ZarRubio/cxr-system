import unittest

import numpy as np
import pandas as pd

from reproduce_legacy_ensemble import CLASSES, labels_matrix, metrics


class TestLegacyEvaluation(unittest.TestCase):
    def test_multilabel_and_no_finding(self):
        frame = pd.DataFrame({
            "Finding Labels": ["Cardiomegaly|Effusion", "No Finding"],
        })
        labels = labels_matrix(frame)
        self.assertEqual(labels.shape, (2, 14))
        self.assertEqual(int(labels[0].sum()), 2)
        self.assertEqual(int(labels[0, CLASSES.index("Cardiomegaly")]), 1)
        self.assertEqual(int(labels[0, CLASSES.index("Effusion")]), 1)
        self.assertEqual(int(labels[1].sum()), 0)

    def test_rejects_unknown_or_contradictory_labels(self):
        for value in ("Unknown", "No Finding|Mass"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                labels_matrix(pd.DataFrame({"Finding Labels": [value]}))

    def test_metrics_are_per_class_and_macro(self):
        actual = np.tile(np.array([[0], [1], [0], [1]], dtype=np.uint8), (1, 14))
        scores = np.tile(np.array([[0.1], [0.9], [0.2], [0.8]], dtype=np.float32), (1, 14))
        report = metrics(actual, scores)
        self.assertEqual(report["n_images"], 4)
        self.assertEqual(report["auc_macro"], 1.0)
        self.assertEqual(report["map"], 1.0)
        self.assertEqual(len(report["per_class"]), 14)


if __name__ == "__main__":
    unittest.main()
