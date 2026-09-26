# Protocolo propuesto para reentrenamiento NIH

**Estado: pipeline implementado; entrenamiento completo aun no ejecutado.** Este protocolo es para un experimento nuevo
de tesis. No altera el modelo desplegado ni sustituye su evaluacion historica.
La integridad y procedencia del corpus constan en
[NIH_AUDIT_2026-09-25.md](NIH_AUDIT_2026-09-25.md).

## Datos y particion congelada

- Corpus: `nih_images_complete_20260925.h5`, 112,120 imagenes, SHA-256
  `c57aed9b21ba26447f9d46c532e0b393179c112253ee70e1166d75ec7ff495c8`.
- Etiquetas: `Data_Entry_2017.csv`, SHA-256
  `3c3e24f0b580e4e976499473fa29d7bbee1f6be93aa0b8bc764e1688ca101d37`.
- Split `nih_splits_full_v1_20260925`, semilla 42, separacion por paciente,
  todas las imagenes de cada paciente en un solo grupo. Conteos:
  train 78,534 / 21,563 pacientes; val 17,008 / 4,621; test 16,578 / 4,621.
  Los hashes de los tres CSV estan en la auditoria. El test queda congelado;
  no se usa para escoger arquitectura, epoca, pesos, calibracion ni umbrales.
- Guardar los archivos con IDs e imagenes fuera de Git y registrar su ubicacion
  segura en el entorno de investigacion. Verificar acceso y politica de uso NIH.
- Queda pendiente cotejar las 851 imagenes recuperadas del espejo publico con
  una copia oficial o checksums independientes; documentar cualquier diferencia.

## Control de fuga y comparacion

Los checkpoints v1/v2 existentes **no** son baselines independientes para el test
nuevo: se entrenaron con otro split NIH y su DenseNet partio de pesos
[`densenet121-res224-nih`, entrenados en NIH](https://mlmed.org/torchxrayvision/models.html).
Un experimento que reclame prueba independiente sobre este split debe
partir de un backbone sin exposicion previa a NIH, o documentar y eliminar del
test todas las imagenes/pacientes que pudieron estar en el preentrenamiento.
No comparar directamente su AUC con el 0.8045 historico: cambia la poblacion
de prueba y el protocolo. Si se quieren comparar arquitecturas, entrenarlas
y evaluarlas bajo **el mismo** split nuevo y las mismas reglas.
La cifra de Wang et al. 2017 es contexto bibliografico, no una mejora
controlada del ensemble si la particion y el preprocesamiento son distintos.

## Experimento reproducible

El ejecutor inicial esta en `tools/train_nih_independent.py`. Usa inicializacion
aleatoria (sin pesos preentrenados en NIH), `BCEWithLogitsLoss`, la particion
fijada y el mismo preprocesamiento de `backend/utils/image_utils.py`. Selecciona
checkpoint y umbrales solo en validacion; al terminar, calcula una sola salida
final de test con metricas por clase y bootstrap agrupado por paciente. Los
umbrales Youden son exploratorios y no representan un punto operativo aprobado
por radiologia. El
checkpoint y el reporte deben guardarse fuera de Git.

Ejemplo (ajustar las rutas a los archivos locales):

```powershell
python tools/train_nih_independent.py `
  --hdf5 C:\ruta\segura\nih_images_complete_20260925.h5 `
  --splits-dir C:\ruta\segura\nih_splits_full_v1_20260925 `
  --output-dir C:\ruta\segura\experiments\nih_scratch_seed42
```

El script verifica SHA-256 del HDF5 y de cada CSV, y rechaza salidas existentes.
La CPU disponible en el entorno Codex no sirve para completar eficientemente el
entrenamiento total; el comando de arriba debe ejecutarse en una maquina GPU con
espacio suficiente. Los resultados de una prueba reducida no son evidencia de
rendimiento y no deben confundirse con la evaluacion completa.

1. Versionar en `cxr-research` el codigo, configuracion y dependencias exactas
   (Python, PyTorch, TorchXRayVision y librerias de imagen). Registrar commit,
   semilla, plataforma, hashes de datos/splits y pesos de inicializacion.
2. Fijar el preprocesamiento en codigo y probar igualdad entre entrenamiento,
   evaluacion y futura inferencia del backend. Registrar conversion PNG/DICOM,
   rango de intensidades, crop, resize y normalizacion. No usar augmentacion
   aleatoria en val/test; evitar flips que cambien lateralidad sin justificacion.
3. Entrenar primero una baseline con una sola arquitectura y sin preentrenamiento
   NIH; despues comparar el CNN-ViT y un ensemble solo si la baseline y el
   presupuesto de computo lo permiten. Guardar checkpoints con commit y hashes
   de entrada embebidos; elegir la epoca solo con validacion.
4. Definir antes de abrir test las metricas principales: AUROC y AUPRC macro y
   por clase. Ajustar calibracion, pesos del ensemble y umbrales exclusivamente
   en val. Para hallazgos prioritarios, acordar con el radiologo el objetivo
   de sensibilidad/especificidad y el costo de falsos negativos.
5. Congelar el modelo y ejecutar test una sola vez. Guardar logits/scores por
   imagen, etiquetas y version del modelo en almacenamiento restringido;
   publicar solo resultados agregados. Reportar sensibilidad, especificidad,
   precision, NPV y F1 por clase, ademas de intervalos de confianza obtenidos
   por remuestreo a nivel de paciente.
6. Evaluar por separado proyeccion PA/AP y otros subgrupos disponibles, sin
   presentar diferencias exploratorias como concluyentes. Documentar errores
   de etiqueta, fallos de calidad y las clases con pocos positivos.
7. Evaluar externamente en HNAL solo tras aprobacion institucional, con
   desidentificacion, criterio de referencia del radiologo y muestra definida
   antes de observar resultados. No recalibrar con la cohorte reservada para
   prueba externa; si se adapta el modelo, crear otra cohorte de evaluacion.

## Criterio para integrar en la aplicacion

No reemplazar los seis artefactos del backend hasta tener un manifiesto del
experimento (commit, hashes, split, preprocesamiento, checkpoint, calibracion,
umbrales), evaluacion reproducida y revision clinica. El despliegue debe probar
que las probabilidades de la API coinciden con las del script de evaluacion
para las mismas imagenes. Toda version debe conservar un identificador visible
en `/model-info` y en cada reporte.

Para reportar la tesis, contrastar la documentacion final con
[CLAIM 2024](https://pubs.rsna.org/doi/10.1148/ryai.240300) y
[TRIPOD+AI](https://www.bmj.com/content/385/bmj-2023-078378). Estas guias son de
reporte metodologico, no una certificacion de seguridad clinica.
