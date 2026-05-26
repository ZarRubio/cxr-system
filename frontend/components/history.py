import json
from datetime import datetime

import pandas as pd
import streamlit as st

from components.results import render_results


def add_to_history(filename: str, response: dict) -> None:
    """Prepends a new analysis entry to the session history."""
    if "history" not in st.session_state:
        st.session_state["history"] = []

    st.session_state["history"].insert(
        0,
        {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "filename": filename,
            "predicted": response.get("predicted_class", "-"),
            "confidence": response.get("confidence", 0.0),
            "image_hash": response.get("image_hash", ""),
            "response": response,
        },
    )


def render_history(model_info: dict | None = None) -> None:
    """Renders the session analysis history as collapsible cards."""
    history = st.session_state.get("history", [])

    if not history:
        st.info("Aun no hay analisis en esta sesion.")
        return

    st.markdown(f"**{len(history)} analisis en esta sesion**")

    export_rows = [
        {
            "timestamp": item["timestamp"],
            "filename": item["filename"],
            "predicted": item["predicted"],
            "confidence": item["confidence"],
            "image_hash": item.get("image_hash", ""),
        }
        for item in history
    ]
    csv_bytes = pd.DataFrame(export_rows).to_csv(index=False).encode("utf-8")
    json_bytes = json.dumps(export_rows, ensure_ascii=False, indent=2).encode("utf-8")
    col_csv, col_json = st.columns(2)
    with col_csv:
        st.download_button("Descargar CSV", csv_bytes, "cxr_history.csv", "text/csv")
    with col_json:
        st.download_button("Descargar JSON", json_bytes, "cxr_history.json", "application/json")

    for item in history:
        label = (
            f"{item['timestamp']} - {item['filename']} "
            f"-> {item['predicted']} ({item['confidence'] * 100:.0f}%)"
        )
        with st.expander(label):
            render_results(item["response"], model_info)
