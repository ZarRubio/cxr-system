from datetime import datetime

import streamlit as st

from components.results import render_results


def add_to_history(filename: str, response: dict) -> None:
    """Prepends a new analysis entry to the session history."""
    if "history" not in st.session_state:
        st.session_state["history"] = []

    st.session_state["history"].insert(
        0,
        {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "filename": filename,
            "predicted": response.get("predicted_class", "—"),
            "confidence": response.get("confidence", 0.0),
            "response": response,
        },
    )


def render_history() -> None:
    """Renders the session analysis history as collapsible cards."""
    history = st.session_state.get("history", [])

    if not history:
        st.info("Aún no hay análisis en esta sesión.")
        return

    st.markdown(f"**{len(history)} análisis en esta sesión**")

    for item in history:
        label = (
            f"{item['timestamp']} — {item['filename']} "
            f"→ {item['predicted']} ({item['confidence'] * 100:.0f}%)"
        )
        with st.expander(label):
            render_results(item["response"])
