import streamlit as st

from components.results import render_results
from utils.api_client import call_predict_api


def render_comparison() -> None:
    """Renders side-by-side analysis of two chest X-rays."""
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### Imagen A")
        file_a = st.file_uploader(
            "Cargar imagen A", type=["png", "jpg", "jpeg", "dcm"], key="cmp_a"
        )

    with col2:
        st.markdown("#### Imagen B")
        file_b = st.file_uploader(
            "Cargar imagen B", type=["png", "jpg", "jpeg", "dcm"], key="cmp_b"
        )

    if file_a and file_b:
        if st.button("Comparar ambas", type="primary"):
            bytes_a = file_a.read()
            bytes_b = file_b.read()

            with st.spinner("Analizando imagen A…"):
                resp_a = call_predict_api(bytes_a, file_a.name)
            with st.spinner("Analizando imagen B…"):
                resp_b = call_predict_api(bytes_b, file_b.name)

            col1, col2 = st.columns(2)
            with col1:
                if not file_a.name.lower().endswith(".dcm"):
                    st.image(bytes_a, width=300)
                render_results(resp_a)

            with col2:
                if not file_b.name.lower().endswith(".dcm"):
                    st.image(bytes_b, width=300)
                render_results(resp_b)
