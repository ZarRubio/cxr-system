# Reproduccion local de la evaluacion historica

**Resultado: AUC macro reproducido dentro de 1e-4; validacion clinica pendiente.**
Se ejecutaron los dos checkpoints locales sobre los 4,023 estudios de validacion
y 4,023 de prueba del protocolo S4ML original (una imagen por paciente en ambos).
No se uso el split nuevo de 112,120 imagenes para esta evaluacion.

## Fuentes y metodo

- HDF5 historico: SHA-256 `7afc343f3a29c82585d4856f00091aeac15e670422ee61aa1fe7df376ed309d6`.
- `val.csv`: SHA-256 `3f9d69b0e1ed72392b5d1a3977dcfd07a5136d30b878db5ec6cb7b9abccca3b5`.
- `test.csv`: SHA-256 `6bc9c420dcc222b26aa29435ff84cc513bd800d94b0a40c89f0fc6637425b459`.
- Checkpoints v1/v2: SHA-256 `59f98c72981929fde8e6044a78ff46b8b23c519b8f50cd4ad4c85566bf34224b`
  y `d93fa69ba1e348b8b4653502392a1faee6ef3883a1138968bf6ac05531401813`.
- Cuaderno S4ML del respaldo: SHA-256 `48a61bcb739313d801b7d1927c1f24685218d8aaec7eb1bdf1bf74b40261fd86`.
  Se verifico que la parte ejecutable de `backend/models/cnn_vit.py` tiene el
  mismo AST que el modelo archivado; solo difiere su bloque de demostracion.
- Preprocesamiento de evaluacion original: normalizacion XRV de uint8 a
  [-1024, 1024], center crop y resize a 224. Inferencia sigmoid por modelo;
  pesos candidatos v1 0.3, 0.4, 0.5, 0.6, 0.7 elegidos en validacion; prueba
  evaluada una vez con el peso seleccionado. La carga estricta de todos los
  parametros del checkpoint permitio evitar una nueva descarga de pesos.
- Entorno local: PyTorch 2.12.0+cpu, NumPy 2.4.6, pandas 3.0.3,
  TorchXRayVision 1.4.0, scikit-learn 1.8.0, h5py 3.16.0.

Script: `tools/reproduce_legacy_ensemble.py`. Los archivos `report.json` y
`predictions.npz` quedaron fuera de Git, en el directorio local
`legacy_ensemble_reproduction_20260925`. Las matrices siguen el orden de filas
de los CSV fijados por hash y no contienen imagenes. SHA-256 del NPZ:
`b3e52a6898a3ba17535e697a4d4c157c7e6826d901f67eb4ba588c90fa24b456`.
Una segunda lectura independiente del NPZ recalculo AUC y mAP con el mismo
resultado.

Para repetirlo, instalar `tools/requirements.txt` y
`backend/requirements.txt`, y ejecutar el script con `--archive` (ZIP 001 del
respaldo), `--hdf5` (HDF5 historico), `--artifacts-dir backend/artifacts` y
`--output-dir` (directorio nuevo fuera de Git). `--help` muestra los parametros
de lote e hilos. El script verifica los hashes antes de inferir y rechaza
sobrescribir una salida existente.

## Resultados

| Metrica | Archivada | Recalculada | Diferencia |
|---|---:|---:|---:|
| Peso v1 / v2 | 0.3 / 0.7 | 0.3 / 0.7 | 0 |
| AUC macro test | 0.80450617 | 0.80449892 | -0.00000725 |
| mAP test | 0.15214135 | 0.15218470 | +0.00004335 |

La combinacion 0.3/0.7 obtuvo AUC macro de validacion `0.79903178` y fue la
mejor de las cinco combinaciones probadas. El `0.7950` que figura en algunos
metadatos de la aplicacion corresponde al mejor checkpoint **v2 individual**,
no a esta combinacion.

| Clase | Positivos test | AUROC | AUPRC |
|---|---:|---:|---:|
| Atelectasis | 257 | 0.7595 | 0.1850 |
| Cardiomegaly | 105 | 0.9350 | 0.3544 |
| Consolidation | 56 | 0.8231 | 0.0822 |
| Edema | 23 | 0.9258 | 0.1107 |
| Effusion | 230 | 0.8890 | 0.3902 |
| Emphysema | 49 | 0.8419 | 0.0959 |
| Fibrosis | 73 | 0.8031 | 0.0887 |
| Hernia | 10 | 0.8791 | 0.0480 |
| Infiltration | 522 | 0.6361 | 0.2148 |
| Mass | 145 | 0.8087 | 0.2031 |
| Nodule | 191 | 0.6809 | 0.1332 |
| Pleural_Thickening | 88 | 0.7832 | 0.1038 |
| Pneumonia | 25 | 0.7120 | 0.0126 |
| Pneumothorax | 67 | 0.7856 | 0.1079 |

El mayor desvio de AUROC por clase frente al JSON historico fue 0.000125
(Hernia, 10 positivos). El cuaderno de Colab no fijaba la version de
TorchXRayVision; los cambios numericos de entorno son una explicacion posible,
no demostrada. No se ha reproducido byte a byte el entorno de Colab.

## Interpretacion y trabajo pendiente

Esta prueba confirma que la cifra agregada es recuperable desde los pesos y el
test historico. **No** demuestra que los objetos del bucket o el despliegue actual
tengan estos mismos hashes, ni corrige la exposicion previa a NIH del backbone,
la calidad de las etiquetas, el bajo numero de positivos en algunas clases o
la falta de validacion externa HNAL. Los scores no son probabilidades clinicas
calibradas. La comparacion con Wang 2017 no es controlada si los conjuntos de
prueba o preprocesamientos difieren.

`/model-info` y la pantalla de evidencia muestran estas metricas historicas
solo cuando los hashes de ambos checkpoints y de sus configuraciones coinciden
con los evaluados. En otra version los valores quedan vacios en lugar de
atribuirle resultados ajenos. Esto no sustituye el cotejo independiente del
bucket ni demuestra que el pipeline de la API replica el del cuaderno.
En desarrollo, si no hay manifiesto guardado, el backend calcula esos hashes
al arrancar; `/health.model_manifest_verified` sigue indicando `false` hasta
que exista un manifiesto guardado y verificado.

Antes de afirmar utilidad clinica faltan intervalos de confianza por paciente,
sensibilidad/especificidad y valor predictivo a umbrales predefinidos, analisis
de errores y una cohorte externa con lectura de referencia. Para un experimento
NIH independiente seguir el [protocolo nuevo](RETRAINING_PROTOCOL_2026-09-25.md)
sin reciclar el test ni el AUC historicos.
