import streamlit as st

from components.comparison import render_comparison
from components.gradcam_view import render_gradcam
from components.history import add_to_history, render_history
from components.results import render_results
from components.uploader import render_uploader
from utils.api_client import call_predict_api

st.set_page_config(
    page_title="CXR Classifier — HNAL",
    page_icon="🫁",
    layout="wide",
)

with st.sidebar:
    st.title("CXR Classifier")
    st.caption("Sistema de apoyo diagnóstico — HNAL 2026")
    st.info("Modelo: CNN-ViT | 4 clases\nDenseNet121 + Vision Transformer")
    st.markdown("---")
    st.markdown(
        "**Clases:**\n"
        "- No Finding\n"
        "- Cardiomegaly\n"
        "- Effusion\n"
        "- Infiltration"
    )

tab1, tab2, tab3 = st.tabs(["🔍 Análisis", "📋 Historial", "⚖️ Comparación"])

with tab1:
    st.markdown("## Análisis de Radiografía")

    file_bytes, filename = render_uploader()

    if file_bytes and filename:
        st.markdown("---")
        if st.button("Analizar radiografía", type="primary", use_container_width=True):
            with st.spinner("Procesando imagen…"):
                response = call_predict_api(file_bytes, filename)

            if "error" not in response:
                add_to_history(filename, response)

            col_results, col_gradcam = st.columns([1, 1])
            with col_results:
                render_results(response)
            with col_gradcam:
                render_gradcam(response, file_bytes)

with tab2:
    st.markdown("## Historial de Análisis")
    render_history()

with tab3:
    st.markdown("## Comparación de Radiografías")
    render_comparison()

st.divider()
st.caption("⚠️ Uso académico. No reemplaza el criterio del radiólogo.")
