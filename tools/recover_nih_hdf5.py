"""Restore NIH images into a new HDF5 without modifying the source."""

import argparse
import csv
import hashlib
import io
import json
import shutil
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zipfile import ZipFile

import h5py
import numpy as np
from PIL import Image

CSV_MEMBER = "Tesis_CXR/data/raw/nih/Data_Entry_2017.csv"
IMAGE_PREFIX = "Tesis_CXR/data/raw/nih/images/"
MIRROR_URL = "https://nih-chest-x-rays.s3.us-east-2.amazonaws.com/images_1024x1024/"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def image_fingerprint(hashes: dict[str, str]) -> str:
    payload = "".join(f"{name}:{hashes[name]}\n" for name in sorted(hashes))
    return hashlib.sha256(payload.encode("ascii")).hexdigest()


def metadata_names(archive_path: Path) -> tuple[list[str], str]:
    with ZipFile(archive_path) as archive:
        raw = archive.read(CSV_MEMBER)
    digest = hashlib.sha256(raw).hexdigest()
    rows = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    names = [row["Image Index"] for row in rows]
    if not names or len(names) != len(set(names)):
        raise ValueError("El CSV de NIH esta vacio o contiene nombres duplicados")
    return names, digest


def archive_sources(paths: list[Path], needed: set[str]) -> dict[str, tuple[Path, str]]:
    sources = {}
    for path in paths:
        with ZipFile(path) as archive:
            for member in archive.namelist():
                if not member.startswith(IMAGE_PREFIX) or not member.endswith(".png"):
                    continue
                name = member.removeprefix(IMAGE_PREFIX)
                if "/" in name or name not in needed:
                    continue
                if name in sources:
                    raise ValueError(f"Imagen duplicada en los ZIP: {name}")
                sources[name] = (path, member)
    return sources


def processed_pixels(raw: bytes) -> np.ndarray:
    with Image.open(io.BytesIO(raw)) as image:
        if image.format != "PNG" or image.size != (1024, 1024):
            raise ValueError("La imagen fuente no es un PNG NIH de 1024x1024")
        return np.asarray(
            image.convert("L").resize((256, 256), Image.Resampling.LANCZOS),
            dtype=np.uint8,
        )


def fetch_image(name: str, base_url: str) -> bytes:
    if Path(name).name != name or not name.endswith(".png"):
        raise ValueError("Nombre de imagen invalido")
    url = base_url.rstrip("/") + "/" + name
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                raw = response.read(10 * 1024 * 1024 + 1)
            if len(raw) > 10 * 1024 * 1024:
                raise ValueError("PNG remoto demasiado grande")
            return raw
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("No se pudo descargar la imagen")


def verify_mirror_samples(paths: list[Path], existing: set[str], base_url: str) -> int:
    checked = 0
    for path in paths:
        with ZipFile(path) as archive:
            sample = next(
                (
                    member for member in archive.namelist()
                    if member.startswith(IMAGE_PREFIX)
                    and member.endswith(".png")
                    and Path(member).name in existing
                ),
                None,
            )
            if sample is None:
                continue
            original = archive.read(sample)
            mirror = fetch_image(Path(sample).name, base_url)
            if hashlib.sha256(original).digest() != hashlib.sha256(mirror).digest():
                raise ValueError(f"El espejo no coincide con el respaldo: {path.name}")
            checked += 1
    if checked < 3:
        raise ValueError("Se necesitan al menos tres muestras para verificar el espejo")
    return checked


def restore(
    source_hdf5: Path,
    metadata_zip: Path,
    raw_zips: list[Path],
    output: Path,
    expected_source_sha256: str,
    mirror_url: str = MIRROR_URL,
    workers: int = 8,
    expected_total: int = 112120,
) -> dict:
    output = output.resolve()
    partial = output.with_name(output.name + ".partial")
    report_path = output.with_name(output.name + ".audit.json")
    if any(path.exists() for path in (output, partial, report_path)):
        raise FileExistsError("La salida o un archivo temporal ya existe; no se sobrescribira")
    if source_hdf5.resolve() == output or not 1 <= workers <= 16:
        raise ValueError("Ruta de salida o numero de workers invalido")

    names, metadata_hash = metadata_names(metadata_zip)
    if len(names) != expected_total:
        raise ValueError(f"Se esperaban {expected_total} filas de NIH, hay {len(names)}")
    source_hash = sha256_file(source_hdf5)
    if source_hash.lower() != expected_source_sha256.lower():
        raise ValueError("El SHA-256 del HDF5 fuente no coincide")

    with h5py.File(source_hdf5, "r") as original:
        if "images" not in original:
            raise ValueError("El HDF5 fuente no tiene grupo images")
        existing = set(original["images"].keys())
        prior_image_names_count = len(original["image_names"]) if "image_names" in original else 0
    expected = set(names)
    if existing - expected:
        raise ValueError("El HDF5 fuente contiene imagenes fuera del CSV")
    missing = expected - existing
    sources = archive_sources(raw_zips, missing)
    remote_names = sorted(missing - set(sources))
    sample_count = verify_mirror_samples(raw_zips, existing, mirror_url) if remote_names else 0
    print(
        f"Fuente: {len(existing)} | ZIP: {len(sources)} | espejo: {len(remote_names)} | "
        f"muestras identicas: {sample_count}",
        flush=True,
    )

    def download_and_resize(name: str) -> tuple[str, np.ndarray, str]:
        raw = fetch_image(name, mirror_url)
        return name, processed_pixels(raw), hashlib.sha256(raw).hexdigest()

    remote_pixels = {}
    remote_hashes = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for index, (name, pixels, digest) in enumerate(pool.map(download_and_resize, remote_names), 1):
            remote_pixels[name] = pixels
            remote_hashes[name] = digest
            if index % 100 == 0 or index == len(remote_names):
                print(f"Espejo verificado: {index}/{len(remote_names)}", flush=True)

    by_archive = defaultdict(list)
    for name, (path, member) in sources.items():
        by_archive[path].append((name, member))

    try:
        shutil.copy2(source_hdf5, partial)
        archive_hashes = {}
        with h5py.File(partial, "a") as recovered:
            group = recovered["images"]
            added = 0
            for path in raw_zips:
                if path not in by_archive:
                    continue
                with ZipFile(path) as archive:
                    for name, member in by_archive[path]:
                        raw = archive.read(member)
                        archive_hashes[name] = hashlib.sha256(raw).hexdigest()
                        pixels = processed_pixels(raw)
                        group.create_dataset(name, data=pixels, compression="gzip", compression_opts=4)
                        added += 1
                print(f"ZIP incorporado: {path.name} | total agregado: {added}", flush=True)
            for name, pixels in remote_pixels.items():
                group.create_dataset(name, data=pixels, compression="gzip", compression_opts=4)
            if "image_names" in recovered:
                del recovered["image_names"]
            recovered.create_dataset(
                "image_names", data=np.asarray(names, dtype=object),
                dtype=h5py.string_dtype(encoding="utf-8"),
            )
            recovered.flush()

        with h5py.File(partial, "r") as recovered:
            if set(recovered["images"].keys()) != expected:
                raise ValueError("La copia recuperada no cubre el CSV completo")
            if len(recovered["image_names"]) != len(names):
                raise ValueError("image_names no coincide con el CSV")
            for name in missing:
                pixels = recovered["images"][name][()]
                if pixels.shape != (256, 256) or pixels.dtype != np.uint8:
                    raise ValueError("Pixel data incorrecta en la copia recuperada")

        output_hash = sha256_file(partial)
        partial.rename(output)
        report = {
            "status": "integrity_pass_not_clinical_validation",
            "metadata_sha256": metadata_hash,
            "source_hdf5_sha256": source_hash,
            "recovered_hdf5_sha256": output_hash,
            "source_images": len(existing),
            "recovered_from_zips": len(sources),
            "recovered_from_public_mirror": len(remote_names),
            "zip_png_fingerprint": image_fingerprint(archive_hashes),
            "mirror_png_fingerprint": image_fingerprint(remote_hashes),
            "mirror_samples_byte_identical": sample_count,
            "final_images": len(expected),
            "prior_image_names_count": prior_image_names_count,
            "final_image_names_count": len(names),
            "mirror_url": mirror_url,
        }
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return report
    except Exception:
        if partial.exists():
            partial.unlink()
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-hdf5", type=Path, required=True)
    parser.add_argument("--metadata-zip", type=Path, required=True)
    parser.add_argument("--raw-zips", type=Path, nargs="+", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-source-sha256", required=True)
    parser.add_argument("--mirror-url", default=MIRROR_URL)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    report = restore(
        args.source_hdf5, args.metadata_zip, args.raw_zips, args.output,
        args.expected_source_sha256, args.mirror_url, args.workers,
    )
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
