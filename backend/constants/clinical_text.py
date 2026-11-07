"""
Textos que acompañan cada predicción: aviso general, notas por clase y explicaciones del mapa Grad-CAM.
Contexto: investigación académica en radiografía de tórax. Los textos describen la etiqueta del
conjunto NIH y piden confirmación profesional; no indican diagnósticos, tratamientos ni protocolos.
"""

DISCLAIMER = (
    "Uso académico. Este sistema no reemplaza el criterio clínico del radiólogo. "
    "Proyecto de investigación académica en radiografía de tórax."
)

CLASS_DISCLAIMERS = {
    "Infiltration": (
        " Infiltration es una etiqueta amplia que tuvo baja especificidad en la evaluación interna; "
        "confirme el hallazgo en la imagen original."
    ),
    "Pneumonia": (
        " Para Pneumonia, el valor predictivo positivo de la evaluación interna fue muy bajo; "
        "la imagen por sí sola no permite confirmar una neumonía."
    ),
}

_CONFIRM = "Confirmar en la imagen original y según el criterio del profesional responsable."

CLASS_EXPLANATIONS = {
    "Atelectasis": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a pérdida de volumen pulmonar.",
        "visual": "Revise si el mapa se concentra en zonas de menor volumen o hacia las bases.",
        "clinical": _CONFIRM,
    },
    "Cardiomegaly": {
        "summary": "El modelo puede estar respondiendo a un aumento aparente de la silueta cardíaca.",
        "visual": "Revise si el mapa se concentra sobre el mediastino y el contorno cardíaco.",
        "clinical": "La proyección AP puede sobrestimar el tamaño cardíaco. " + _CONFIRM,
    },
    "Consolidation": {
        "summary": "El modelo puede estar respondiendo a patrones de ocupación alveolar.",
        "visual": "Revise si el mapa resalta áreas de aumento de densidad homogéneo.",
        "clinical": _CONFIRM,
    },
    "Edema": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a edema pulmonar.",
        "visual": "Revise si el mapa resalta regiones perihiliares o basales bilaterales.",
        "clinical": _CONFIRM,
    },
    "Effusion": {
        "summary": "El modelo puede estar respondiendo a opacidades basales o al borramiento del ángulo costofrénico.",
        "visual": "Revise si el mapa resalta las bases pulmonares o los senos costodiafragmáticos.",
        "clinical": _CONFIRM,
    },
    "Emphysema": {
        "summary": "El modelo puede estar respondiendo a patrones de hiperinsuflación.",
        "visual": "Revise si el mapa resalta campos pulmonares con mayor translucidez.",
        "clinical": _CONFIRM,
    },
    "Fibrosis": {
        "summary": "El modelo puede estar respondiendo a patrones fibróticos pulmonares.",
        "visual": "Revise si el mapa muestra un patrón reticular o zonas de distorsión arquitectural.",
        "clinical": _CONFIRM,
    },
    "Hernia": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a hernia diafragmática.",
        "visual": "Revise si el mapa resalta la región diafragmática o la base pulmonar.",
        "clinical": "Es una de las categorías con menos casos en los datos. " + _CONFIRM,
    },
    "Infiltration": {
        "summary": "El modelo puede estar respondiendo a opacidades pulmonares de distinto origen.",
        "visual": "Revise si el mapa se concentra en campos pulmonares con aumento de densidad.",
        "clinical": "Etiqueta amplia con baja especificidad en la evaluación interna. " + _CONFIRM,
    },
    "Mass": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a la categoría Mass del entrenamiento.",
        "visual": "Revise si el mapa resalta una lesión focal.",
        "clinical": "El clasificador no mide lesiones ni confirma su naturaleza. " + _CONFIRM,
    },
    "Nodule": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a la categoría Nodule del entrenamiento.",
        "visual": "Revise si el mapa resalta una lesión nodular focal.",
        "clinical": "El clasificador no mide lesiones ni establece una conducta de seguimiento. " + _CONFIRM,
    },
    "Pleural_Thickening": {
        "summary": "El modelo puede estar respondiendo a patrones de engrosamiento pleural.",
        "visual": "Revise si el mapa resalta la interfaz pleural.",
        "clinical": _CONFIRM,
    },
    "Pneumonia": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a la etiqueta Pneumonia de los informes NIH.",
        "visual": "Revise si el mapa resalta un área de consolidación.",
        "clinical": "Su valor predictivo positivo en la evaluación interna fue muy bajo. " + _CONFIRM,
    },
    "Pneumothorax": {
        "summary": "El modelo puede estar respondiendo a patrones asociados a aire en el espacio pleural.",
        "visual": "Revise si el mapa resalta la periferia del campo pulmonar.",
        "clinical": _CONFIRM,
    },
    "No Finding": {
        "summary": "Ninguna clase superó su umbral de hallazgo.",
        "visual": "El mapa de calor puede mostrar atención difusa o regiones anatómicas normales.",
        "clinical": "No confirma normalidad ni excluye enfermedad; la revisión del radiólogo sigue siendo necesaria.",
    },
}
