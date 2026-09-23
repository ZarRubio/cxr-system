# Plan de validacion del modelo CXR

## Conclusion actual

El ensemble es adecuado como prototipo academico, pero la evidencia disponible no permite
declararlo validado para uso clinico. Mejorar la arquitectura o volver a entrenar sin antes
medir errores por clase podria consumir tiempo sin reducir los falsos negativos relevantes.

## Evidencia verificable en el repositorio

| Evidencia | Valor |
|---|---:|
| AUC macro de validacion v1 | 0.7899 |
| mAP de validacion v1 | 0.1598 |
| AUC macro de validacion v2 | 0.7950 |
| mAP de validacion v2 | 0.1568 |
| AUC macro de prueba del ensemble | 0.8045 |
| Tarea | Multi-label, 14 clases |

Los valores v1/v2 estan guardados dentro de los checkpoints. El AUC del ensemble proviene de
`backend/artifacts/ensemble_config.json`.

## Evidencia que falta

- Manifiesto reproducible de entrenamiento, validacion y prueba con separacion por paciente.
- Etiquetas y scores de cada estudio para recalcular las metricas.
- Sensibilidad, especificidad, precision, F1, AUPRC y matriz de confusion por clase.
- Intervalos de confianza y analisis por edad, sexo y proyeccion AP/PA.
- Calibracion por clase: Brier score, ECE y curvas de confiabilidad.
- Metodo reproducible usado para seleccionar cada umbral.
- Validacion externa con estudios del HNAL y lectura de referencia.

## Protocolo recomendado

1. Crear un manifiesto pseudonimizado con `study_id`, `patient_hash`, particion y las 14 etiquetas.
2. Verificar que ningun paciente aparezca en mas de una particion.
3. Ejecutar el modelo una vez y conservar `y_true` y los logits por estudio.
4. Calcular AUROC y AUPRC por clase; reportar macro y micro promedios.
5. Calcular sensibilidad, especificidad, precision, NPV y F1 con los umbrales actuales.
6. Ajustar calibracion y umbrales solamente con validacion; no tocar el conjunto de prueba.
7. Congelar modelo, calibracion y umbrales y evaluarlos una sola vez en prueba.
8. Repetir el analisis en una cohorte externa HNAL, con intervalos de confianza bootstrap.
9. Revisar por separado falsos negativos de Pneumothorax, Edema, Mass y Pneumonia.

## Cuando reentrenar

Reentrenar si existe una brecha relevante de sensibilidad/AUPRC en clases prioritarias, deriva
entre NIH y HNAL, fuga por paciente o errores sistematicos de proyeccion y calidad. Antes de
cambiar la arquitectura, priorizar limpieza de etiquetas, balance de clases, muestreo por
paciente y aumentos compatibles con radiografia.

Si la discriminacion es aceptable pero los scores estan mal calibrados, conservar el modelo y
aplicar calibracion por clase. Si la calibracion es buena pero el punto operativo no cumple el
objetivo clinico, ajustar umbrales en validacion y documentar el costo en falsos positivos.

## Criterio minimo de cierre

El modelo solo deberia presentarse como validado cuando las metricas puedan reproducirse desde
un conjunto congelado, no exista solapamiento de pacientes, los umbrales esten justificados y
la cohorte HNAL confirme el rendimiento esperado. La aprobacion final requiere participacion
del radiologo responsable y asesoria estadistica.
