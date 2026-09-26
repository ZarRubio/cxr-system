import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import h5py
import numpy as np
import pandas as pd

from create_nih_splits import CLASSES, create_splits


class TestCreateNIHSplits(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.hdf5 = self.root / "images.h5"
        self.output = self.root / "splits"
        self.frame = pd.DataFrame({
            "Image Index": [f"image_{index}.png" for index in range(6)],
            "Patient ID": [str(index) for index in range(6)],
            "Finding Labels": ["|".join(CLASSES)] * 6,
            "View Position": ["PA"] * 6,
            "is_no_finding": [0] * 6,
            **{label: [1] * 6 for label in CLASSES},
        })
        with h5py.File(self.hdf5, "w") as h5:
            group = h5.create_group("images")
            for name in self.frame["Image Index"]:
                group.create_dataset(name, data=np.zeros((2, 2), dtype=np.uint8))
            h5.create_dataset(
                "image_names", data=self.frame["Image Index"].to_numpy(dtype=object),
                dtype=h5py.string_dtype(encoding="utf-8"),
            )

    def create(self):
        patients = {"train": {"0", "1"}, "val": {"2", "3"}, "test": {"4", "5"}}
        with patch("create_nih_splits.read_metadata", return_value=(self.frame, "metadata-hash")), \
                patch("create_nih_splits.assign_patients", return_value=patients):
            return create_splits(self.root / "unused.zip", self.hdf5, self.output)

    def test_creates_complete_patient_disjoint_splits(self):
        manifest = self.create()
        self.assertEqual(manifest["image_counts"], {"train": 2, "val": 2, "test": 2})
        self.assertFalse(manifest["legacy_checkpoints_eligible_for_independent_test"])
        self.assertEqual(sum(manifest["patient_counts"].values()), 6)
        for name in ("train", "val", "test"):
            self.assertEqual(len(pd.read_csv(self.output / f"{name}.csv")), 2)
            self.assertEqual(len(manifest["class_positives"][name]), 14)

    def test_rejects_incorrect_image_index(self):
        with h5py.File(self.hdf5, "a") as h5:
            del h5["image_names"]
            h5.create_dataset(
                "image_names", data=np.asarray(["wrong.png"] * 6, dtype=object),
                dtype=h5py.string_dtype(encoding="utf-8"),
            )
        with self.assertRaisesRegex(ValueError, "image_names difiere"):
            self.create()
        self.assertFalse(self.output.exists())

    def test_never_overwrites_existing_splits(self):
        self.output.mkdir()
        with self.assertRaises(FileExistsError):
            self.create()


if __name__ == "__main__":
    unittest.main()
