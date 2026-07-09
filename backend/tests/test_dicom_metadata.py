"""Tests de extraccion de metadatos no identificantes del DICOM."""
import io

import pydicom
from pydicom.dataset import FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

from services.dicom_service import _parse_age, extract_study_metadata


def _make_dicom(**tags) -> bytes:
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = pydicom.uid.SecondaryCaptureImageStorage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

    ds = pydicom.Dataset()
    ds.file_meta = file_meta
    ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    for key, value in tags.items():
        setattr(ds, key, value)

    buf = io.BytesIO()
    pydicom.dcmwrite(buf, ds, enforce_file_format=True)
    return buf.getvalue()


class TestParseAge:
    def test_formato_dicom_anos(self):
        assert _parse_age("045Y") == 45

    def test_meses_a_anos(self):
        assert _parse_age("030M") == 2

    def test_dias_menor_de_un_ano(self):
        assert _parse_age("200D") == 0

    def test_invalidos(self):
        assert _parse_age(None) is None
        assert _parse_age("") is None
        assert _parse_age("abc") is None
        assert _parse_age("999Y") is None


class TestExtractStudyMetadata:
    def test_extrae_edad_sexo_proyeccion_y_hash(self):
        uid = generate_uid()
        data = _make_dicom(
            PatientAge="062Y",
            PatientSex="F",
            ViewPosition="PA",
            StudyInstanceUID=uid,
            PatientName="DEBE^IGNORARSE",
            PatientID="PHI-12345",
        )
        meta = extract_study_metadata(data)
        assert meta == {
            "patient_age": 62,
            "patient_sex": "F",
            "view_position": "PA",
            "study_hash": meta["study_hash"],
        }
        assert len(meta["study_hash"]) == 10
        # El hash no debe contener el UID original ni PHI
        assert uid not in str(meta)
        assert "PHI-12345" not in str(meta)
        assert "IGNORARSE" not in str(meta)

    def test_hash_estable_por_estudio(self):
        uid = generate_uid()
        m1 = extract_study_metadata(_make_dicom(StudyInstanceUID=uid, PatientSex="M"))
        m2 = extract_study_metadata(_make_dicom(StudyInstanceUID=uid, PatientSex="M"))
        assert m1["study_hash"] == m2["study_hash"]

    def test_sexo_y_proyeccion_invalidos_se_descartan(self):
        meta = extract_study_metadata(
            _make_dicom(PatientSex="X", ViewPosition="OBLICUA", PatientAge="040Y")
        )
        assert meta["patient_sex"] is None
        assert meta["view_position"] is None
        assert meta["patient_age"] == 40

    def test_sin_metadatos_devuelve_none(self):
        assert extract_study_metadata(_make_dicom()) is None

    def test_bytes_no_dicom_devuelve_none(self):
        assert extract_study_metadata(b"esto no es un dicom") is None
