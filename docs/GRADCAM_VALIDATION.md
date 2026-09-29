# Grad-CAM: visualizacion y evaluacion

## Contrato compatible

- `gradcam_image`: superposicion fija existente, para PDF y clientes antiguos.
- `gradcam_heatmap`: PNG RGB del mapa puro, sin radiografia. El visor lo combina una sola vez con `image_preview`.
- Un estudio antiguo sin mapa puro conserva su superposicion fija, sin un control de opacidad enganoso.
- La inferencia sigue siendo del ensemble; la explicacion sigue siendo solo de v2.
- No se recortan activaciones a pulmones ni se modifican scores, umbrales o checkpoints.

## Evaluacion offline pendiente con el checkpoint real

La correccion visual no demuestra que el modelo use anatomia relevante. Las pruebas automaticas usan datos sinteticos, no constituyen validacion clinica.

1. Fijar checkpoint y su hash, clase, preprocesamiento, metodo CAM y un conjunto de validacion antes de comparar. No seleccionar solo ejemplos visualmente favorables ni ajustar con test.
2. Obtener el CAM escalar de `pytorch_grad_cam` y el tensor exacto usados por v2. No recuperar valores desde la imagen RGB coloreada.
3. Ejecutar `services.cam_fidelity.evaluate_occlusion(model_v2, tensor, scalar_cam, class_index)` para cada caso. Ejecutar fuera del servicio de produccion.
4. Comparar la caida del logit al ocultar el 10% de mayor atribucion, el 10% menor y 20 controles aleatorios del mismo tamano (semilla 42). El reemplazo es la media por canal de la imagen. Conservar tambien casos con caidas negativas.
5. Agregar resultados por clase y paciente. Inspeccionar mapas junto a imagen original, incluyendo bordes, texto y dispositivos. Evaluar otras fracciones y reemplazos como analisis de sensibilidad predefinido: la oclusion introduce artefactos fuera de distribucion.
6. Medir localizacion solo si hay anotaciones de referencia adecuadas. La oclusion no demuestra que una activacion sea una lesion, ni que el modelo sea clinicamente valido.

Un mapa rojo indica una atribucion relativa normalizada por imagen, no gravedad, probabilidad ni evidencia comparable entre estudios. Los mapas planos no permiten ordenar regiones y la utilidad offline los rechaza.
