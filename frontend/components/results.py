import streamlit as st

COLOR_MAP = {
    "No Finding": {"bg": "#E8F5E9", "border": "#2E7D32", "text": "#1B5E20", "bar": "#2E7D32"},
    "Cardiomegaly": {"bg": "#FFEBEE", "border": "#C62828", "text": "#B71C1C", "bar": "#C62828"},
    "Effusion": {"bg": "#E3F2FD", "border": "#1565C0", "text": "#0D47A1", "bar": "#1565C0"},
    "Infiltration": {"bg": "#FFF3E0", "border": "#E65100", "text": "#BF360C", "bar": "#E65100"},
}

BADGES = {
    "No Finding": "NORMAL",
    "Cardiomegaly": "CARDIACO",
    "Effusion": "PLEURAL",
    "Infiltration": "PULMONAR",
}

DESCRIPTIONS = {
    "No Finding": (
        "No se detectaron hallazgos patologicos significativos. "
        "Campos pulmonares, silueta cardiaca y mediastino dentro de parametros normales para el modelo."
    ),
    "Cardiomegaly": (
        "Posible aumento de la silueta cardiaca. Puede asociarse a insuficiencia cardiaca "
        "o derrame pericardico. Correlacion clinica recomendada."
    ),
    "Effusion": (
        "Posible derrame pleural con opacidad basal o borramiento del seno costodiafragmatico. "
        "Se recomienda evaluacion radiologica complementaria."
    ),
    "Infiltration": (
        "Posible infiltrado pulmonar compatible con consolidacion, neumonia o proceso inflamatorio. "
        "En contexto HNAL Lima: considerar tamizaje de tuberculosis segun protocolo local."
    ),
}

LABEL_TO_INDEX = {
    "No Finding": "0",
    "Cardiomegaly": "1",
    "Effusion": "2",
    "Infiltration": "3",
}


def _confidence_signal(
    confidence: float,
    uncertainty_std: dict | None,
    predicted: str,
) -> tuple[str, str, str]:
    high_uncertainty = False
    if uncertainty_std and predicted in uncertainty_std:
        high_uncertainty = uncertainty_std[predicted] > 0.10

    if confidence >= 0.75 and not high_uncertainty:
        return "[ALTA]", "Alta confianza", "#16A34A"
    if confidence >= 0.50 and not high_uncertainty:
        return "[MEDIA]", "Confianza moderada", "#D97706"
    return "[BAJA]", "Confianza baja - revisar con radiologo", "#DC2626"


def _threshold_for(class_name: str, thresholds: dict | None) -> float:
    if not thresholds:
        return 0.5
    return float(thresholds.get(class_name, thresholds.get(LABEL_TO_INDEX.get(class_name, ""), 0.5)))


def render_main_finding(response: dict) -> None:
    predicted = response["predicted_class"]
    confidence = response["confidence"]
    uncertainty_std = response.get("uncertainty_std")

    colors = COLOR_MAP.get(predicted, COLOR_MAP["No Finding"])
    badge = BADGES.get(predicted, "HALLAZGO")
    desc = DESCRIPTIONS.get(predicted, "")
    signal_badge, signal_label, signal_color = _confidence_signal(
        confidence, uncertainty_std, predicted
    )

    st.markdown(
        f"""
        <div style="
            background: {colors['bg']};
            border-left: 6px solid {colors['border']};
            border-radius: 8px;
            padding: 20px 24px;
            margin-bottom: 16px;
        ">
            <div style="
                display:inline-block;
                padding:3px 8px;
                border-radius:4px;
                background:{colors['border']};
                color:white;
                font-size:11px;
                font-weight:800;
                margin-bottom:10px;
            ">{badge}</div>
            <div style="
                font-size: 24px;
                font-weight: 700;
                color: {colors['text']};
                margin-bottom: 4px;
            ">{predicted}</div>
            <div style="
                font-size: 34px;
                font-weight: 800;
                color: {colors['border']};
                margin-bottom: 6px;
            ">{confidence * 100:.1f}% confianza</div>
            <div style="
                display:inline-flex;
                align-items:center;
                gap:6px;
                background:rgba(0,0,0,0.06);
                border-radius:20px;
                padding:4px 12px;
                margin-bottom:12px;
                font-size:13px;
                font-weight:600;
                color:{signal_color};
            ">{signal_badge} {signal_label}</div>
            <div style="font-size:14px;color:#374151;">{desc}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_probability_bars(response: dict, thresholds: dict | None = None) -> None:
    probs = response["probabilities"]

    st.markdown("#### Probabilidades por clase")
    sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)

    for class_name, prob in sorted_probs:
        colors = COLOR_MAP.get(class_name, {"bar": "#9E9E9E"})
        color = colors["bar"]
        thr = _threshold_for(class_name, thresholds)
        pct = prob * 100
        threshold_pct = thr * 100

        col1, col2, col3 = st.columns([2, 5, 1])
        with col1:
            st.markdown(
                f'<p style="margin:0;padding-top:8px;font-size:14px;'
                f'font-weight:600;color:{color}">{class_name}</p>',
                unsafe_allow_html=True,
            )
        with col2:
            st.markdown(
                f"""
                <div style="position:relative;margin-top:10px">
                    <div style="background:#E5E7EB;border-radius:4px;height:10px;width:100%;">
                        <div style="
                            background:{color};
                            border-radius:4px;
                            height:10px;
                            width:{pct:.1f}%;
                        "></div>
                    </div>
                    <div style="
                        position:absolute;
                        left:{threshold_pct:.1f}%;
                        top:-4px;
                        width:2px;
                        height:18px;
                        background:#111827;
                        opacity:0.55;
                    " title="Threshold: {threshold_pct:.0f}%"></div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with col3:
            st.markdown(
                f'<p style="margin:0;padding-top:8px;font-size:14px;'
                f'font-weight:700;color:{color}">{pct:.1f}%</p>',
                unsafe_allow_html=True,
            )


def render_additional_findings(response: dict, thresholds: dict | None = None) -> None:
    predicted = response["predicted_class"]
    positive = response.get("positive_findings", [])
    additional = [finding for finding in positive if finding != predicted]

    if not additional:
        return

    st.markdown("---")
    st.markdown("#### Hallazgos secundarios sobre umbral")
    st.info(
        "El modelo detecto senales adicionales compatibles con "
        f"**{', '.join(additional)}**. Esto no implica diagnostico; requiere revision medica."
    )

    for finding in additional:
        prob = response["probabilities"].get(finding, 0)
        thr = _threshold_for(finding, thresholds)
        color = COLOR_MAP.get(finding, {}).get("bar", "#9E9E9E")

        col1, col2 = st.columns([2, 1])
        with col1:
            st.markdown(
                f'<span style="color:{color};font-weight:bold">- {finding}</span>',
                unsafe_allow_html=True,
            )
            st.caption(f"Probabilidad: {prob * 100:.1f}% | Umbral: {thr * 100:.0f}%")
        with col2:
            st.metric(
                label=f"Probabilidad de {finding}",
                value=f"{prob * 100:.1f}%",
                delta=f"+{(prob - thr) * 100:.1f} pp",
                label_visibility="collapsed",
            )


def render_explainability(response: dict, show_technical: bool = False) -> None:
    explanation = response.get("explanation") or {}
    if not explanation:
        return

    st.markdown("#### Por que el modelo pudo decidir esto")
    st.markdown(
        f"""
        <div style="
            background:#FFFFFF;
            border:1px solid #E2E8F0;
            border-radius:8px;
            padding:14px 16px;
            margin-bottom:12px;
            color:#334155;
            font-size:14px;
        ">
            <b>Lectura del modelo:</b> {explanation.get('summary', '')}<br>
            <b>En el mapa de calor:</b> {explanation.get('visual', '')}<br>
            <b>Nota clinica:</b> {explanation.get('clinical', '')}
        </div>
        """,
        unsafe_allow_html=True,
    )

    if show_technical:
        st.caption(
            "Grad-CAM/Score-CAM indican regiones influyentes para la prediccion; "
            "no son segmentaciones anatomicas ni localizaciones diagnosticas exactas."
        )


def render_results(
    response: dict,
    model_info: dict | None = None,
    show_technical: bool = False,
) -> None:
    if "error" in response:
        st.error(f"Error: {response['error']}")
        return

    thresholds = (model_info or {}).get("thresholds")
    if show_technical and response.get("cached"):
        st.info("Resultado recuperado desde cache de inferencia.")
    for warning in response.get("image_warnings", []):
        st.warning(warning)

    render_main_finding(response)
    render_explainability(response, show_technical=show_technical)
    render_probability_bars(response, thresholds)

    if show_technical and response.get("uncertainty_std"):
        st.markdown("#### Incertidumbre predictiva")
        st.caption("Desviacion estandar estimada con MC Dropout; valores altos sugieren menor estabilidad.")
        for label, std in response["uncertainty_std"].items():
            st.caption(f"{label}: +/- {std * 100:.1f} pp")

    render_additional_findings(response, thresholds)

    image_hash = response.get("image_hash")
    if show_technical and image_hash:
        st.caption(f"Hash SHA256: `{image_hash[:12]}...`")
    st.caption(f"Tiempo de procesamiento: {response['processing_time_ms']:.0f} ms")
    st.caption(f"_{response.get('disclaimer', '')}_")
