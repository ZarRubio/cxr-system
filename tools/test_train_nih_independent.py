import unittest

import numpy as np

from train_nih_independent import class_metrics, patient_bootstrap, select_thresholds


class TestIndependentNihTrainingMetrics(unittest.TestCase):
    def setUp(self):
        self.labels = np.tile(np.array([[0], [0], [1], [1]], dtype=np.uint8), (1, 14))
        self.scores = np.tile(np.array([[0.1], [0.2], [0.8], [0.9]], dtype=np.float32), (1, 14))

    def test_validation_selects_threshold_and_reports_operating_metrics(self):
        thresholds = select_thresholds(self.labels, self.scores)
        report = class_metrics(self.labels, self.scores, thresholds)
        self.assertEqual(len(thresholds), 14)
        self.assertEqual(report[0]["auc"], 1.0)
        self.assertEqual(report[0]["ap"], 1.0)
        self.assertEqual(report[0]["sensitivity"], 1.0)
        self.assertEqual(report[0]["specificity"], 1.0)

    def test_bootstrap_samples_patients_and_returns_intervals(self):
        thresholds = select_thresholds(self.labels, self.scores)
        patients = np.array(["p1", "p2", "p3", "p4"])
        result = patient_bootstrap(self.labels, self.scores, patients, thresholds, 20, 7)
        self.assertEqual(result["unit"], "patient")
        self.assertEqual(result["requested_replicates"], 20)
        self.assertGreater(result["replicates"], 0)
        self.assertLessEqual(result["replicates"], 20)
        self.assertEqual(result["macro"]["auc"], [1.0, 1.0])
        self.assertEqual(result["per_class"]["0"]["ap"], [1.0, 1.0])


if __name__ == "__main__":
    unittest.main()
