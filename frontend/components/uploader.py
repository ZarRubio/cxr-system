import streamlit as st


def render_uploader() -> tuple[bytes | None, str | None]:
    """Renders the file uploader widget. Returns (file_bytes, filename) or (None, None)."""
    uploaded = st.file_uploader(
        "Cargar radiografía",
        type=["png", "jpg", "jpeg", "dcm"],
        help="Formatos soportados: PNG, JPG o DICOM (.dcm)",
    )

    if uploaded is None:
        return None, None

    file_bytes = uploaded.read()

    col1, col2 = st.columns([1, 2])
    with col1:
        if uploaded.name.lower().endswith(".dcm"):
            st.info("Archivo DICOM cargado correctamente.")
        else:
            st.image(file_bytes, caption="Imagen cargada", width=250)
    with col2:
        st.metric("Formato", uploaded.type or uploaded.name.split(".")[-1].upper())
        st.metric("Tamaño", f"{len(file_bytes) / 1024:.1f} KB")

    return file_bytes, uploaded.name
