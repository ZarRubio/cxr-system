import copy
import json
import sys
import unittest
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from evaluation_evidence import (  # noqa: E402
    EXPECTED_SHA256,
    _threshold_report,
    evidence_for_manifest,
    threshold_evidence_for_configuration,
)


class TestEvaluationEvidence(unittest.TestCase):
    def test_returns_reproduced_metrics_for_matching_artifacts(self):
        evidence = evidence_for_manifest({"artifact_sha256": dict(EXPECTED_SHA256)})
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


@pytest.fixture
def configuration():
    report = json.loads((BACKEND / "historical_threshold_evaluation.json").read_text())
    manifest = {"artifact_sha256": copy.deepcopy(report["artifact_sha256"])}
    thresholds = copy.deepcopy(report["thresholds"])
    ensemble = {"temperature": report["temperature"], "weight_v1": .3, "weight_v2": .7,
                "thresholds": copy.deepcopy(thresholds)}
    return report, manifest, thresholds, ensemble


def test_threshold_evidence_matches_configuration(configuration):
    report, manifest, thresholds, ensemble = configuration
    result = threshold_evidence_for_configuration(manifest, thresholds, ensemble)
    assert result == report
    assert result["runtime_preprocessing_equivalence"] == "not_verified"


@pytest.mark.parametrize("name", ["sprint4ml_v1.pt", "sprint4ml_v2.pt", "ensemble_config.json",
                                 "model_config_14.json", "thresholds_14.json", "labels_14.json"])
def test_changed_artifact_hides_threshold_evidence(configuration, name):
    _, manifest, thresholds, ensemble = configuration
    manifest["artifact_sha256"][name] = "different"
    assert threshold_evidence_for_configuration(manifest, thresholds, ensemble) is None


@pytest.mark.parametrize("key,value", [("temperature", .6586), ("temperature", True),
                                      ("weight_v1", .4), ("weight_v2", .6)])
def test_changed_scoring_hides_threshold_evidence(configuration, key, value):
    _, manifest, thresholds, ensemble = configuration
    ensemble[key] = value
    assert threshold_evidence_for_configuration(manifest, thresholds, ensemble) is None


def test_changed_thresholds_hide_evidence(configuration):
    _, manifest, thresholds, ensemble = configuration
    thresholds["Pneumonia"] = .3
    assert threshold_evidence_for_configuration(manifest, thresholds, ensemble) is None


def test_inference_threshold_mismatch_hides_evidence(configuration):
    _, manifest, thresholds, ensemble = configuration
    ensemble["thresholds"]["Pneumonia"] = .3
    assert threshold_evidence_for_configuration(manifest, thresholds, ensemble) is None


def test_unlinked_or_missing_report_hides_evidence(configuration, monkeypatch):
    _, manifest, thresholds, ensemble = configuration
    assert threshold_evidence_for_configuration(None, thresholds, ensemble) is None
    monkeypatch.setattr("evaluation_evidence._threshold_report", lambda: None)
    assert threshold_evidence_for_configuration(manifest, thresholds, ensemble) is None


def test_published_counts_and_rates_are_consistent(configuration):
    report, *_ = configuration
    assert len(report["per_class"]) == 14
    for row in report["per_class"].values():
        assert row["tp"] + row["fp"] + row["tn"] + row["fn"] == 4023
        assert row["sensitivity"] == pytest.approx(row["tp"] / (row["tp"] + row["fn"]))
        assert row["specificity"] == pytest.approx(row["tn"] / (row["tn"] + row["fp"]))
        assert row["precision"] == pytest.approx(row["tp"] / (row["tp"] + row["fp"]))
        assert row["npv"] == pytest.approx(row["tn"] / (row["tn"] + row["fn"]))


def test_incomplete_report_is_unavailable_not_an_api_error(monkeypatch):
    monkeypatch.setattr(Path, "read_text", lambda *args, **kwargs:
                        '{"schema_version": 1, "status": "historical_fixed_thresholds"}')
    assert _threshold_report.__wrapped__() is None
