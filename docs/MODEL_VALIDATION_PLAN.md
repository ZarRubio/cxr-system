# Plan de validacion del modelo CXR

Procedimiento operativo de integridad y procedencia: [MODEL_PROVENANCE_AUDIT.md](MODEL_PROVENANCE_AUDIT.md).
Reproduccion local del test historico: [MODEL_REPRODUCTION_2026-09-25.md](MODEL_REPRODUCTION_2026-09-25.md).

## Conclusion actual

El ensemble es adecuado como prototipo academico, pero la evidencia disponible no permite
declararlo validado para uso clinico. Mejorar la arquitectura o volver a entrenar sin antes
medir errores por clase podria consumir tiempo sin reducir los falsos negativos relevantes.

## Metricas reportadas en artefactos locales

| Evidencia | Valor |
|---|---:|
| AUC macro de validacion v1 | 0.7899 |
| mAP de validacion v1 | 0.1598 |
| AUC macro de validacion v2 | 0.7950 |
| mAP de validacion v2 | 0.1568 |
| AUC macro de prueba del ensemble | 0.8045 |
| Tarea | Multi-label, 14 clases |

Los valores v1/v2 estan guardados dentro de los checkpoints. El AUC del ensemble
proviene de `backend/artifacts/ensemble_config.json` y del respaldo del experimento;
se recalculo localmente sobre el test historico como **0.8044989**, dentro de
1e-4 del reporte. Esta reproduccion no equivale a validacion clinica.

## Evidencia que falta

- Vinculo verificable entre cada checkpoint y el commit, configuracion y hashes del
  corpus/splits realmente usados. El split historico esta documentado y el split
  nuevo cubre 112,120 imagenes, pero solo sirve para futuros entrenamientos.
- Predicciones por estudio **si existen localmente** para los splits historicos;
  faltan intervalos de confianza por paciente y evaluacion externa. No se suben
  a Git por contener datos derivados de NIH.
- Sensibilidad, especificidad, precision, F1, AUPRC y matriz de confusion por clase.
- Intervalos de confianza y analisis por edad, sexo y proyeccion AP/PA.
- Calibracion por clase: Brier score, ECE y curvas de confiabilidad.
- Metodo reproducible usado para seleccionar cada umbral.
- Validacion externa con estudios de una cohorte clínica externa y lectura de referencia.

## Protocolo recomendado

1. Crear un manifiesto pseudonimizado con `study_id`, `patient_hash`, particion y las 14 etiquetas.
2. Verificar que ningun paciente aparezca en mas de una particion.
3. Ejecutar el modelo una vez y conservar `y_true` y los logits por estudio.
4. Calcular AUROC y AUPRC por clase; reportar macro y micro promedios.
5. Calcular sensibilidad, especificidad, precision, NPV y F1 con los umbrales actuales.
6. Ajustar calibracion y umbrales solamente con validacion; no tocar el conjunto de prueba.
7. Congelar modelo, calibracion y umbrales y evaluarlos una sola vez en prueba.
8. Repetir el analisis en una cohorte clínica externa independiente, con intervalos de confianza bootstrap.
9. Revisar por separado falsos negativos de Pneumothorax, Edema, Mass y Pneumonia.

Para una evaluacion NIH independiente con un modelo nuevo, evitar un backbone
preentrenado sobre imagenes NIH que puedan entrar en el conjunto de prueba. Los
checkpoints actuales no deben evaluarse como prueba independiente en el split
nuevo: ya vieron NIH bajo el protocolo historico.

## Cuando reentrenar

Reentrenar si existe una brecha relevante de sensibilidad/AUPRC en clases prioritarias, deriva
entre NIH y una cohorte clínica externa, fuga por paciente o errores sistematicos de proyeccion y calidad. Antes de
cambiar la arquitectura, priorizar limpieza de etiquetas, balance de clases, muestreo por
paciente y aumentos compatibles con radiografia.

Si la discriminacion es aceptable pero los scores estan mal calibrados, conservar el modelo y
aplicar calibracion por clase. Si la calibracion es buena pero el punto operativo no cumple el
objetivo clinico, ajustar umbrales en validacion y documentar el costo en falsos positivos.

## Criterio minimo de cierre

El modelo solo deberia presentarse como validado cuando las metricas puedan reproducirse desde
un conjunto congelado, no exista solapamiento de pacientes, los umbrales esten justificados y
la cohorte clínica externa confirme el rendimiento esperado. La aprobacion final requiere participacion
del radiologo responsable y asesoria estadistica.
