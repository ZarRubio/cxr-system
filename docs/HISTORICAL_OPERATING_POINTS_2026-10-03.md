# Puntos de operacion del test NIH historico

Fecha: 3 de octubre de 2026. Evaluacion retrospectiva de 4,023 imagenes,
una por paciente. Se reutilizaron las predicciones verificadas del ensemble
0.3 v1 + 0.7 v2, T=1; no se ajustaron parametros ni umbrales con test.
No se modificaron los pesos ni la configuracion de inferencia.

## Resultados con los umbrales existentes

Sensibilidad = VP/(VP+FN); especificidad = VN/(VN+FP); VPP = VP/(VP+FP).
Los porcentajes siguientes estan redondeados a una decimal. El JSON conserva
los valores completos, VPN, F1 y los denominadores. No incluye intervalos.

| Hallazgo | Umbral | Sensibilidad | Especificidad | VPP | VP | FN | FP | VN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Atelectasis | 30% | 76.7% | 59.3% | 11.4% | 197 | 60 | 1533 | 2233 |
| Cardiomegaly | 30% | 95.2% | 74.5% | 9.1% | 100 | 5 | 998 | 2920 |
| Consolidation | 30% | 82.1% | 73.7% | 4.2% | 46 | 10 | 1044 | 2923 |
| Edema | 30% | 78.3% | 86.3% | 3.2% | 18 | 5 | 550 | 3450 |
| Effusion | 30% | 83.0% | 80.2% | 20.3% | 191 | 39 | 752 | 3041 |
| Emphysema | 30% | 85.7% | 70.8% | 3.5% | 42 | 7 | 1159 | 2815 |
| Fibrosis | 30% | 91.8% | 41.4% | 2.8% | 67 | 6 | 2313 | 1637 |
| Hernia | 30% | 60.0% | 91.6% | 1.8% | 6 | 4 | 336 | 3677 |
| Infiltration | 25% | 96.6% | 13.4% | 14.2% | 504 | 18 | 3033 | 468 |
| Mass | 30% | 80.7% | 60.6% | 7.1% | 117 | 28 | 1528 | 2350 |
| Nodule | 30% | 89.5% | 22.8% | 5.5% | 171 | 20 | 2959 | 873 |
| Pleural_Thickening | 30% | 87.5% | 50.2% | 3.8% | 77 | 11 | 1959 | 1976 |
| Pneumonia | 25% | 84.0% | 48.4% | 1.0% | 21 | 4 | 2064 | 1934 |
| Pneumothorax | 30% | 73.1% | 71.6% | 4.2% | 49 | 18 | 1122 | 2834 |

## Vinculo y alcance en la aplicacion

`backend/historical_threshold_evaluation.json` contiene solo resultados agregados,
hashes y descripcion del protocolo; no contiene radiografias ni filas por paciente.
`tools/evaluate_historical_thresholds.py` genera ese archivo comprobando el reporte
de reproduccion, los hashes de predicciones, checkpoints, configuraciones, labels
y umbrales. Rechaza sobreescritura, otro split, otra temperatura o pesos distintos.
La decision reproduce `round(float(score), 6) >= threshold`, como la API actual.

`/model-info` publica `threshold_evaluation` solo si los seis hashes de artefactos,
los umbrales cargados en la API y el ensemble, T=1 y los pesos coinciden con el
reporte. Si cambian, el estado es `unavailable`. La interfaz verifica ademas el
umbral de cada fila; nunca reutiliza sensibilidad de otro punto de operacion.

Estos resultados corresponden al preprocesamiento historico de TorchXRayVision:
normalizacion, recorte central y XRayResizer(224). La API usa normalizacion y
redimensionado completo OpenCV; **su equivalencia no esta verificada**. La tabla
identifica ese limite y no se presenta como validacion del despliegue ni como
estimacion de exactitud para cualquier archivo JPG/DICOM.

La sensibilidad alta de Infiltration y Pneumonia no demuestra utilidad clinica:
su especificidad/VPP y conteos muestran una carga importante de falsos positivos.
Los umbrales existentes no quedan aprobados por calcular esta tabla. Las posibles
mejoras deben seleccionarse en validacion, considerando sensibilidad y PPV,
y evaluarse bajo un protocolo congelado, sin optimizar sobre este test inspeccionado.

## Reproduccion

```powershell
python tools/evaluate_historical_thresholds.py --predictions <predictions.npz> --evidence-report <report.json> --artifacts-dir backend/artifacts --output <archivo-nuevo.json>
```

Instalar `tools/requirements.txt` en el entorno de evaluacion. La herramienta
no carga el modelo ni necesita acceso a imagenes para calcular esta tabla.
El reporte original de calibracion usa otros umbrales y sigue siendo un ensayo
distinto; sus cifras no sustituyen las de esta evaluacion.
