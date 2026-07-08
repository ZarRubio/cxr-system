"""
Textos clinicos que acompanan cada prediccion: disclaimer general,
advertencias por clase y explicaciones del mapa Grad-CAM.
Contexto: Hospital Nacional Arzobispo Loayza (HNAL), Lima, Peru.
"""

DISCLAIMER = (
    "Uso academico. Este sistema no reemplaza el criterio clinico del radiologo. "
    "Desarrollado para el Hospital Nacional Arzobispo Loayza (HNAL), Lima, Peru."
)

CLASS_DISCLAIMERS = {
    "Infiltration": (
        " Para Infiltration, considerar correlacion clinica y tamizaje de TB segun "
        "protocolo local HNAL."
    ),
    "Pneumonia": (
        " Para Pneumonia, en contexto HNAL Lima, descartar tuberculosis segun protocolo local."
    ),
}

CLASS_EXPLANATIONS = {
    "Atelectasis": {
        "summary": "El modelo puede estar respondiendo a colapso parcial o total de uno o mas lobulos.",
        "visual": "Revise si el mapa se concentra en zonas de menor densidad o hacia las bases.",
        "clinical": "Correlacionar con clinica; frecuente en postoperados o pacientes encamados.",
    },
    "Cardiomegaly": {
        "summary": "El modelo puede estar respondiendo a aumento aparente de la silueta cardiaca.",
        "visual": "Revise si el mapa se concentra sobre mediastino y contorno cardiaco.",
        "clinical": "Correlacionar con proyeccion, indice cardiotoracico y datos clinicos.",
    },
    "Consolidation": {
        "summary": "El modelo puede estar respondiendo a ocupacion alveolar por liquido o tejido.",
        "visual": "Revise si el mapa resalta areas de aumento de densidad homogeneo.",
        "clinical": "Considerar neumonia bacteriana; correlacionar con fiebre y clinica.",
    },
    "Edema": {
        "summary": "El modelo puede estar respondiendo a patron de edema pulmonar bilateral.",
        "visual": "Revise si el mapa resalta regiones perihiliares o basales bilaterales.",
        "clinical": "Evaluar insuficiencia cardiaca o causas no cardiogenicas.",
    },
    "Effusion": {
        "summary": "El modelo puede estar respondiendo a opacidades basales o borramiento del angulo costofrenico.",
        "visual": "Revise si el mapa resalta bases pulmonares o senos costodiafragmaticos.",
        "clinical": "Puede requerir proyeccion lateral, ecografia o correlacion con sintomas.",
    },
    "Emphysema": {
        "summary": "El modelo puede estar respondiendo a hiperinsuflacion y destruccion alveolar.",
        "visual": "Revise si el mapa resalta campos pulmonares con mayor translucidez.",
        "clinical": "Correlacionar con espirometria y antecedentes tabaquicos.",
    },
    "Fibrosis": {
        "summary": "El modelo puede estar respondiendo a patron fibrotico pulmonar.",
        "visual": "Revise si el mapa muestra patron reticular o zonas de distorsion arquitectural.",
        "clinical": "Considerar fibrosis intersticial; correlacionar con antecedentes y TCAR.",
    },
    "Hernia": {
        "summary": "El modelo puede estar respondiendo a hernia diafragmatica.",
        "visual": "Revise si el mapa resalta region diafragmatica o base pulmonar.",
        "clinical": "Confirmar con TC; evaluar contenido herniado.",
    },
    "Infiltration": {
        "summary": "El modelo puede estar respondiendo a opacidades pulmonares compatibles con infiltrado.",
        "visual": "Revise si el mapa se concentra en campos pulmonares con aumento de densidad.",
        "clinical": "En contexto HNAL, correlacionar con sospecha de neumonia o tuberculosis.",
    },
    "Mass": {
        "summary": "El modelo puede estar respondiendo a lesion pulmonar mayor de 3 cm.",
        "visual": "Revise si el mapa resalta lesion focal de gran tamano.",
        "clinical": "Requiere estudio tomografico urgente para caracterizacion.",
    },
    "Nodule": {
        "summary": "El modelo puede estar respondiendo a lesion focal menor de 3 cm.",
        "visual": "Revise si el mapa resalta lesion nodular focal.",
        "clinical": "Seguimiento segun protocolo de nodulo pulmonar; considerar TC.",
    },
    "Pleural_Thickening": {
        "summary": "El modelo puede estar respondiendo a engrosamiento de la pleura.",
        "visual": "Revise si el mapa resalta la interfaz pleural.",
        "clinical": "Correlacionar con antecedentes de exposicion o derrame previo.",
    },
    "Pneumonia": {
        "summary": "El modelo puede estar respondiendo a consolidacion neumofica.",
        "visual": "Revise si el mapa resalta area de consolidacion lobar o segmentaria.",
        "clinical": "En contexto HNAL Lima, considerar tamizaje de tuberculosis.",
    },
    "Pneumothorax": {
        "summary": "El modelo puede estar respondiendo a linea pleural y ausencia de trama vascular.",
        "visual": "Revise si el mapa resalta la periferia del campo pulmonar afectado.",
        "clinical": "Verificar linea pleural en radiografia en espiracion; urgencia si es a tension.",
    },
    "No Finding": {
        "summary": "No se observaron patrones suficientes para superar los umbrales de hallazgo.",
        "visual": "El mapa de calor puede mostrar atencion difusa o regiones anatomicas normales.",
        "clinical": "Interpretar como apoyo academico; no descarta patologia si la clinica sugiere lo contrario.",
    },
}
