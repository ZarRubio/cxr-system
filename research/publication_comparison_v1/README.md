# Comparación controlada DenseNet121 vs. CNN–ViT (publication_comparison_v1)

Artefactos de la comparación controlada descrita en el manuscrito enviado al *Journal of Biomedical Informatics*
(Rubio Calixto y Castro Veramendi): seis corridas (2 arquitecturas × 3 semillas: 42, 123 y 2026) sobre NIH ChestX-ray14
con partición por paciente.

> **Aviso.** Estos checkpoints son los de la comparación de investigación. **No** son los checkpoints del sistema
> desplegado (`backend/artifacts/sprint4ml_v1.pt` y `sprint4ml_v2.pt`). Las puntuaciones son salidas sigmoides sin
> calibrar y no son probabilidades clínicas. El sistema es de apoyo a la decisión y requiere revisión radiológica.

## Contenido

| Ruta | Descripción |
| --- | --- |
| `runs/<arquitectura>_seed<semilla>/history.json` | Historial por época (pérdida de entrenamiento y métricas de validación) |
| `runs/.../test_report.json` | Métricas de prueba, umbrales, hashes e IC 95 % por bootstrap por paciente (500 réplicas) |
| `runs/.../test_predictions.npz` | Predicciones sobre el conjunto de prueba (permiten recalcular métricas y bootstrap) |
| `runs/.../config.json`, `environment.json` | Configuración y entorno de ejecución de cada corrida |
| `notebooks/nih_publication_comparison_colab.ipynb` | Cuaderno de entrenamiento y comparación (Google Colab) |
| `notebooks/Auditoria_Test_Tres_Semillas_OE4_08Oct2026.ipynb` | Cuaderno de auditoría de la prueba con tres semillas |
| `SHA256SUMS.txt` | SHA-256 de `runs/` y `notebooks/` |
| `WEIGHTS_SHA256SUMS.txt` | SHA-256 de los pesos `best.pt`, publicados como adjuntos del release |

## Pesos (`best.pt`)

Los seis pesos (61 MB el CNN–ViT y 27 MB el DenseNet121) no están en el historial de Git: se publican como adjuntos
del release `comparison-jbi-v1`, con el nombre `<arquitectura>_seed<semilla>_best.pt`. Para verificarlos:

```bash
sha256sum -c WEIGHTS_SHA256SUMS.txt   # desde la carpeta donde se descargaron los .pt
```

## Verificación de integridad

Los hashes de los pesos y de las predicciones coinciden con `best_checkpoint_sha256` y `prediction_sha256` de cada
`test_report.json`.

```bash
cd research/publication_comparison_v1
sha256sum -c SHA256SUMS.txt
```

## Alcance y límites

- Los datos de NIH ChestX-ray14 no se redistribuyen; se obtienen de la fuente original, bajo su licencia.
- Las 500 réplicas individuales del bootstrap no se guardaron; solo los intervalos de confianza. Se pueden recalcular
  a partir de `test_predictions.npz`.
- Los cuadernos conservan las rutas de Google Drive/Colab con las que se ejecutaron (`/content/drive/MyDrive/cxr-thesis`).
- El entorno de la comparación (Python, PyTorch, CUDA, GPU) está en `environment.json`; el entorno de la aplicación
  desplegada es otro.
