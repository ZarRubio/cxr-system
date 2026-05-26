import streamlit as st

CLASS_COLORS = {
    "No Finding": "#4CAF50",
    "Cardiomegaly": "#F44336",
    "Effusion": "#2196F3",
    "Infiltration": "#FF9800",
}


def render_results(response: dict) -> None:
    """Renders the prediction result: main finding, threshold alerts, probability bars."""
    if "error" in response:
        st.error(f"Error: {response['error']}")
        return

    predicted = response["predicted_class"]
    confidence = response["confidence"]
    color = CLASS_COLORS.get(predicted, "#9E9E9E")

    st.markdown("### Hallazgo principal")
    st.markdown(
        f'<div style="background:{color};padding:16px;border-radius:8px;'
        f'color:white;font-size:24px;font-weight:bold;text-align:center">'
        f"{predicted} — {confidence * 100:.1f}%</div>",
        unsafe_allow_html=True,
    )

    st.markdown("")

    positive = response.get("positive_findings", [])
    if positive:
        st.warning(f"Hallazgos sobre threshold: {', '.join(positive)}")
    else:
        st.success("Ningún hallazgo supera el umbral de detección.")

    st.markdown("#### Probabilidades por clase")
    for class_name, prob in response["probabilities"].items():
        st.markdown(f"**{class_name}**")
        st.progress(float(prob), text=f"{prob * 100:.1f}%")

    st.caption(f"Tiempo de procesamiento: {response['processing_time_ms']:.0f} ms")
    st.caption(f"_{response.get('disclaimer', '')}_")
