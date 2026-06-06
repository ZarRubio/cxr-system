import streamlit as st

COLOR_MAP = {
    "Atelectasis":        {"bg": "#FFF3E0", "border": "#E65100", "text": "#BF360C", "bar": "#E65100"},
    "Cardiomegaly":       {"bg": "#FFEBEE", "border": "#C62828", "text": "#B71C1C", "bar": "#C62828"},
    "Consolidation":      {"bg": "#F3E5F5", "border": "#4A148C", "text": "#4A148C", "bar": "#6A1B9A"},
    "Edema":              {"bg": "#E0F7FA", "border": "#006064", "text": "#004D40", "bar": "#00838F"},
    "Effusion":           {"bg": "#E3F2FD", "border": "#1565C0", "text": "#0D47A1", "bar": "#1565C0"},
    "Emphysema":          {"bg": "#F1F8E9", "border": "#558B2F", "text": "#33691E", "bar": "#558B2F"},
    "Fibrosis":           {"bg": "#EFEBE9", "border": "#6D4C41", "text": "#4E342E", "bar": "#6D4C41"},
    "Hernia":             {"bg": "#ECEFF1", "border": "#37474F", "text": "#263238", "bar": "#455A64"},
    "Infiltration":       {"bg": "#FFF8E1", "border": "#FF6F00", "text": "#E65100", "bar": "#FF6F00"},
    "Mass":               {"bg": "#FCE4EC", "border": "#880E4F", "text": "#880E4F", "bar": "#AD1457"},
    "Nodule":             {"bg": "#F9FBE7", "border": "#827717", "text": "#558B2F", "bar": "#827717"},
    "Pleural_Thickening": {"bg": "#E1F5FE", "border": "#01579B", "text": "#01579B", "bar": "#0277BD"},
    "Pneumonia":          {"bg": "#FBE9E7", "border": "#BF360C", "text": "#BF360C", "bar": "#D84315"},
    "Pneumothorax":       {"bg": "#E8EAF6", "border": "#1A237E", "text": "#1A237E", "bar": "#283593"},
    "No Finding":         {"bg": "#E8F5E9", "border": "#2E7D32", "text": "#1B5E20", "bar": "#2E7D32"},
}

BADGES = {
    "Atelectasis":        "ATELECTASIA",
    "Cardiomegaly":       "CARDIACO",
    "Consolidation":      "CONSOLIDACION",
    "Edema":              "EDEMA",
    "Effusion":           "PLEURAL",
    "Emphysema":          "ENFISEMA",
    "Fibrosis":           "FIBROSIS",
    "Hernia":             "HERNIA",
    "Infiltration":       "INFILTRADO",
    "Mass":               "MASA",
    "Nodule":             "NODULO",
    "Pleural_Thickening": "ENGROS. PLEURAL",
    "Pneumonia":          "NEUMONIA",
    "Pneumothorax":       "NEUMOTORAX",
    "No Finding":         "NORMAL",
}

DESCRIPTIONS = {
    "Atelectasis": (
        "Colapso pulmonar parcial o total de uno o mas lobulos. "
        "Frecuente en postoperados, pacientes encamados o con obstruccion bronquial."
    ),
    "Cardiomegaly": (
        "Posible aumento de la silueta cardiaca (ICT > 0.5). "
        "Puede asociarse a insuficiencia cardiaca o derrame pericardico. Correlacion clinica recomendada."
    ),
    "Consolidation": (
        "Ocupacion alveolar por liquido o tejido. "
        "Considerar neumonia bacteriana; correlacionar con fiebre y clinica."
    ),
    "Edema": (
        "Edema pulmonar. Evaluar insuficiencia cardiaca o causas no cardiogenicas. "
        "Patron tipico: opacidades perihiliares bilaterales."
    ),
    "Effusion": (
        "Posible derrame pleural con opacidad basal o borramiento del seno costodiafragmatico. "
        "Se recomienda proyeccion lateral o ecografia complementaria."
    ),
    "Emphysema": (
        "Hiperinsuflacion y destruccion alveolar. "
        "Correlacionar con espirometria y antecedentes tabaquicos o de exposicion."
    ),
    "Fibrosis": (
        "Patron fibrotico pulmonar. Considerar fibrosis intersticial. "
        "Correlacionar con antecedentes y TCAR de alta resolucion."
    ),
    "Hernia": (
        "Posible hernia diafragmatica. "
        "Confirmar con tomografia computada; evaluar contenido herniado."
    ),
    "Infiltration": (
        "Posible infiltrado pulmonar compatible con consolidacion, neumonia o proceso inflamatorio. "
        "En contexto HNAL Lima: considerar tamizaje de tuberculosis segun protocolo local."
    ),
    "Mass": (
        "Lesion mayor de 3 cm detectada. "
        "Requiere estudio tomografico urgente para caracterizacion y estadificacion."
    ),
    "Nodule": (
        "Lesion focal menor de 3 cm. "
        "Seguimiento segun protocolo de nodulo pulmonar; considerar TC para caracterizacion."
    ),
    "Pleural_Thickening": (
        "Engrosamiento pleural. "
        "Correlacionar con antecedentes de exposicion, derrame previo o infeccion."
    ),
    "Pneumonia": (
        "Compatible con consolidacion neumofica. Correlacion clinica recomendada. "
        "En contexto HNAL Lima: descartar tuberculosis segun protocolo local."
    ),
    "Pneumothorax": (
        "Posible neumotorax: ausencia de trama vascular en periferia del campo pulmonar. "
        "Verificar linea pleural en radiografia en espiracion. Urgencia si es a tension."
    ),
    "No Finding": (
        "No se detectaron hallazgos patologicos significativos. "
        "Campos pulmonares, silueta cardiaca y mediastino dentro de parametros normales para el modelo."
    ),
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
        return 0.3
    return float(thresholds.get(class_name, 0.3))


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


def render_no_finding_card() -> None:
    colors = COLOR_MAP["No Finding"]
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
            ">NORMAL</div>
            <div style="
                font-size: 24px;
                font-weight: 700;
                color: {colors['text']};
                margin-bottom: 8px;
            ">No Finding</div>
            <div style="font-size:14px;color:#374151;">{DESCRIPTIONS['No Finding']}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_finding_compact(class_name: str, response: dict) -> None:
    prob = response["probabilities"].get(class_name, 0)
    colors = COLOR_MAP.get(class_name, COLOR_MAP["No Finding"])
    badge = BADGES.get(class_name, "HALLAZGO")
    desc = DESCRIPTIONS.get(class_name, "")

    st.markdown(
        f"""
        <div style="
            background: {colors['bg']};
            border-left: 4px solid {colors['border']};
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 10px;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="
                        display:inline-block;
                        padding:2px 6px;
                        border-radius:3px;
                        background:{colors['border']};
                        color:white;
                        font-size:10px;
                        font-weight:800;
                        margin-right:8px;
                    ">{badge}</span>
                    <span style="font-size:16px;font-weight:700;color:{colors['text']};">{class_name}</span>
                </div>
                <span style="font-size:20px;font-weight:800;color:{colors['border']};">{prob * 100:.1f}%</span>
            </div>
            <div style="font-size:13px;color:#374151;margin-top:6px;">{desc}</div>
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
                f'<p style="margin:0;padding-top:8px;font-size:13px;'
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
                f'<p style="margin:0;padding-top:8px;font-size:13px;'
                f'font-weight:700;color:{color}">{pct:.1f}%</p>',
                unsafe_allow_html=True,
            )


def render_additional_findings(response: dict, thresholds: dict | None = None) -> None:
    predicted = response["predicted_class"]
    positive = response.get("positive_findings", [])
    additional = [f for f in positive if f != predicted]

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


def render_multilabel_findings(response: dict) -> None:
    positive = response.get("positive_findings", [])

    if not positive:
        render_no_finding_card()
        return

    if len(positive) == 1:
        render_main_finding(response)
        return

    # Multiples hallazgos
    st.warning(f"Multiples hallazgos detectados: **{len(positive)} patologias**")
    for finding in positive:
        render_finding_compact(finding, response)


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

    render_multilabel_findings(response)
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
    mv = response.get("model_version", "ensemble-v1v2-14classes")
    st.caption(f"Modelo: {mv} | Tiempo: {response['processing_time_ms']:.0f} ms")
    st.caption(f"_{response.get('disclaimer', '')}_")
