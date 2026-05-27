import streamlit as st

_CLASS_COLOR = {
    "No Finding": "#15803D",
    "Cardiomegaly": "#B91C1C",
    "Effusion": "#1D4ED8",
    "Infiltration": "#C2410C",
}

_DEFAULT_METRICS = {
    "No Finding": {"auc": 0.818, "sensitivity": 0.765, "specificity": 0.740},
    "Cardiomegaly": {"auc": 0.931, "sensitivity": 0.857, "specificity": 0.874},
    "Effusion": {"auc": 0.926, "sensitivity": 0.706, "specificity": 0.931},
    "Infiltration": {"auc": 0.786, "sensitivity": 0.167, "specificity": 0.978},
}

_CLASS_NOTES = {
    "No Finding": "Lectura base para descartar hallazgos relevantes.",
    "Cardiomegaly": "Mejor AUC reportado del modelo.",
    "Effusion": "Alta especificidad reportada.",
    "Infiltration": "Umbral bajo para aumentar cobertura en contexto TB.",
}

_THRESH_NOTES = {
    "0": ("No Finding", "Conservador; reduce falsos positivos."),
    "1": ("Cardiomegaly", "Balance entre sensibilidad y especificidad."),
    "2": ("Effusion", "Prioriza especificidad."),
    "3": ("Infiltration", "Aumenta sensibilidad para pesquisa TB."),
}


def _metric_card(label: str, value: str, detail: str = "") -> None:
    detail_html = f"<span>{detail}</span>" if detail else ""
    st.markdown(
        f"""
        <div class="metric-panel">
            <p>{label}</p>
            <strong>{value}</strong>
            {detail_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def _metrics_style() -> None:
    st.markdown(
        """
        <style>
            .metric-panel {
                background: #FFFFFF;
                border: 1px solid #DDE5F0;
                border-radius: 8px;
                padding: 14px 16px;
                min-height: 96px;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
            }
            .metric-panel p {
                margin: 0 0 8px 0;
                color: #64748B;
                font-size: 12px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0;
            }
            .metric-panel strong {
                color: #0F172A;
                display: block;
                font-size: 28px;
                line-height: 1.1;
            }
            .metric-panel span {
                color: #64748B;
                display: block;
                font-size: 12px;
                margin-top: 8px;
            }
            .architecture-flow {
                background: #FFFFFF;
                border: 1px solid #DDE5F0;
                border-left: 4px solid #2563EB;
                border-radius: 8px;
                color: #0F172A;
                font-family: Consolas, "Courier New", monospace;
                font-size: 13px;
                line-height: 1.7;
                margin-top: 8px;
                padding: 14px 16px;
                overflow-x: auto;
            }
            .architecture-flow .cnn { color: #1D4ED8; font-weight: 800; }
            .architecture-flow .patches { color: #15803D; font-weight: 800; }
            .architecture-flow .vit { color: #7C3AED; font-weight: 800; }
            .architecture-flow .out { color: #B91C1C; font-weight: 800; }
            .threshold-card {
                background: #FFFFFF;
                border: 1px solid #DDE5F0;
                border-radius: 8px;
                padding: 14px;
                min-height: 138px;
            }
            .threshold-card strong {
                display: block;
                font-size: 27px;
                line-height: 1.1;
                margin-bottom: 4px;
            }
            .threshold-card b {
                color: #0F172A;
                display: block;
                font-size: 13px;
                margin-bottom: 6px;
            }
            .threshold-card span {
                color: #64748B;
                font-size: 12px;
                line-height: 1.4;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_metrics(model_info: dict | None = None) -> None:
    _metrics_style()

    info = model_info or {}
    live_metrics = info.get("metrics") or {}
    auc_macro = info.get("auc_macro", 0.865)

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        _metric_card("AUC Macro", f"{auc_macro:.3f}", "Promedio no ponderado por clase")
    with c2:
        _metric_card("Arquitectura", "CNN-ViT", "DenseNet121 + Transformer")
    with c3:
        _metric_card("Clases", "4", "No Finding, Cardiomegaly, Effusion, Infiltration")
    with c4:
        _metric_card("Entrada", "224 x 224", "Imagen normalizada")

    st.markdown("---")
    st.markdown("#### Area bajo la curva ROC por clase")

    rows = []
    for cls, defaults in _DEFAULT_METRICS.items():
        live = live_metrics.get(cls, {})
        rows.append(
            {
                "cls": cls,
                "auc": live.get("auc", defaults["auc"]),
                "sensitivity": live.get("sensitivity", defaults["sensitivity"]),
                "specificity": live.get("specificity", defaults["specificity"]),
            }
        )
    rows.sort(key=lambda r: r["auc"], reverse=True)

    for row in rows:
        cls = row["cls"]
        auc = row["auc"]
        color = _CLASS_COLOR.get(cls, "#475569")
        pct = max(0, min(100, auc * 100))

        cn, cb, cv = st.columns([2, 5, 1])
        cn.markdown(
            f'<p style="margin:0;padding-top:8px;font-size:14px;font-weight:800;color:{color}">{cls}</p>',
            unsafe_allow_html=True,
        )
        cb.markdown(
            f"""
            <div style="margin-top:10px;background:#E2E8F0;border-radius:999px;height:12px">
                <div style="background:{color};border-radius:999px;height:12px;width:{pct:.1f}%"></div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        cv.markdown(
            f'<p style="margin:0;padding-top:6px;font-size:14px;font-weight:900;color:{color}">{auc:.3f}</p>',
            unsafe_allow_html=True,
        )

    st.markdown("---")
    st.markdown("#### Sensibilidad y especificidad")
    st.caption("Calculadas con umbrales calibrados por clase en el conjunto de validacion.")

    hcols = st.columns([2, 2, 2, 3])
    for h, label in zip(hcols, ["**Clase**", "**Sensibilidad**", "**Especificidad**", "**Nota**"]):
        h.markdown(label)

    for cls, defaults in _DEFAULT_METRICS.items():
        live = live_metrics.get(cls, {})
        sens = live.get("sensitivity", defaults["sensitivity"])
        spec = live.get("specificity", defaults["specificity"])
        color = _CLASS_COLOR.get(cls, "#475569")
        rc = st.columns([2, 2, 2, 3])
        rc[0].markdown(
            f'<span style="color:{color};font-weight:800">{cls}</span>',
            unsafe_allow_html=True,
        )
        rc[1].markdown(f"**{sens * 100:.1f}%**")
        rc[2].markdown(f"**{spec * 100:.1f}%**")
        rc[3].caption(_CLASS_NOTES.get(cls, "Sin nota especifica."))

    st.markdown("---")
    st.markdown("#### Arquitectura del modelo")
    ca, cb_arch = st.columns(2)
    with ca:
        st.markdown(
            """
**Backbone CNN**
- DenseNet121 preentrenado en NIH ChestX-ray14
- Normalizacion torchxrayvision: [-1024, 1024]
- Extrae feature maps 7 x 7 para formar 49 patches
"""
        )
    with cb_arch:
        st.markdown(
            f"""
**Vision Transformer**
- Patches de entrada: 49
- Embedding dim: {info.get("embedding_dim", 512)}
- Heads: {info.get("num_heads", 8)} | Layers: {info.get("num_layers", 4)}
- MLP dim: {info.get("mlp_dim", 1024)} | Dropout: {info.get("dropout", 0.1)}
"""
        )

    st.markdown(
        """
        <div class="architecture-flow">
            CXR (224 x 224) ->
            <span class="cnn">DenseNet121</span> ->
            feature maps 7 x 7 ->
            <span class="patches">49 patches</span> ->
            <span class="vit">ViT (4 bloques, 8 heads)</span> ->
            sigmoid multi-label ->
            <span class="out">4 probabilidades independientes</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("---")
    thresholds = info.get("thresholds") or {}
    if thresholds:
        st.markdown("#### Umbrales de decision por clase")
        st.caption("Cada clase usa un umbral independiente segun su relevancia clinica.")
        tcols = st.columns(4)
        for i, tcol in enumerate(tcols):
            key = str(i)
            label, note = _THRESH_NOTES.get(key, (f"Clase {i}", ""))
            thr = thresholds.get(key, "-")
            color = list(_CLASS_COLOR.values())[i]
            thr_disp = f"{float(thr) * 100:.0f}%" if thr != "-" else "-"
            with tcol:
                st.markdown(
                    f"""
                    <div class="threshold-card">
                        <strong style="color:{color}">{thr_disp}</strong>
                        <b>{label}</b>
                        <span>{note}</span>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    st.markdown("---")
    st.caption(
        "Metricas reportadas sobre el conjunto de validacion del proyecto HNAL 2026. "
        "No constituyen aprobacion clinica regulatoria."
    )
