import io
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

import h5py
import numpy as np
from PIL import Image

from recover_nih_hdf5 import IMAGE_PREFIX, CSV_MEMBER, restore, sha256_file


class TestNIHRecovery(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / "source.h5"
        self.backup = self.root / "backup.zip"
        self.output = self.root / "complete.h5"
        with h5py.File(self.source, "w") as h5:
            images = h5.create_group("images")
            for name in ("a.png", "b.png"):
                images.create_dataset(name, data=np.zeros((256, 256), dtype=np.uint8))
            h5.create_dataset(
                "image_names", data=np.asarray(["a.png"], dtype=object),
                dtype=h5py.string_dtype(encoding="utf-8"),
            )
        picture = io.BytesIO()
        Image.new("L", (1024, 1024), color=75).save(picture, format="PNG")
        with ZipFile(self.backup, "w") as archive:
            archive.writestr(CSV_MEMBER, "Image Index\na.png\nb.png\nc.png\n")
            archive.writestr(IMAGE_PREFIX + "c.png", picture.getvalue())

    def test_recovers_copy_and_repairs_image_names(self):
        original_hash = sha256_file(self.source)
        report = restore(
            self.source, self.backup, [self.backup], self.output,
            original_hash, expected_total=3,
        )

        self.assertEqual(sha256_file(self.source), original_hash)
        self.assertEqual(report["final_images"], 3)
        self.assertEqual(report["recovered_from_zips"], 1)
        self.assertEqual(report["recovered_from_public_mirror"], 0)
        self.assertEqual(report["prior_image_names_count"], 1)
        with h5py.File(self.output, "r") as h5:
            self.assertEqual(set(h5["images"]), {"a.png", "b.png", "c.png"})
            self.assertEqual(len(h5["image_names"]), 3)
            self.assertTrue(np.all(h5["images"]["c.png"][()] == 75))
        report_path = self.root / "complete.h5.audit.json"
        self.assertEqual(json.loads(report_path.read_text())["final_images"], 3)

    def test_rejects_wrong_source_hash(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            restore(self.source, self.backup, [self.backup], self.output, "0" * 64, expected_total=3)
        self.assertFalse(self.output.exists())

    def test_never_overwrites_existing_output(self):
        self.output.write_bytes(b"existing")
        with self.assertRaises(FileExistsError):
            restore(
                self.source, self.backup, [self.backup], self.output,
                sha256_file(self.source), expected_total=3,
            )
        self.assertEqual(self.output.read_bytes(), b"existing")


if __name__ == "__main__":
    unittest.main()
