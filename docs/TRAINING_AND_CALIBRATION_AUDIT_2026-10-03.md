# Revision retrospectiva de entrenamiento y calibracion

Fecha: 3 de octubre de 2026. Alcance: archivos historicos locales y
predicciones de la reproduccion del 25 de septiembre. No verifica el despliegue
actual ni modifica pesos, thresholds, manifiestos o configuracion de produccion.

## Procedencia de checkpoints

| Artefacto | Metadatos del checkpoint | Evidencia adicional |
| --- | --- | --- |
| v1 / sprint4ml_phase2_best.pt | P2, epoca 6, AUROC val 0.7899119281; 4 bloques | Su SHA-256 coincide con el artefacto local sprint4ml_v1.pt |
| v2 / phase2_best.pt | P2, epoca 12, AUROC val 0.7949751294; 6 bloques | Su SHA-256 coincide con el artefacto local sprint4ml_v2.pt |
| v2 / phase1_best.pt | P1, epoca 14, AUROC val 0.7929926559 | Es un checkpoint intermedio, no sustituye al v2 P2 del ensemble |

`train_ml.log` concatena cinco sesiones. La sesion del 5 de junio registra
en P2/epoca 6 AUROC 0.7899 y mAP 0.1598, seguida de guardado: consistente
con los metadatos del checkpoint v1. `history_s4ml.json` corresponde a la
sesion del 6 de junio y registra mejor AUROC P1 0.7914498387, sin mejora en P2.
El historial mas reciente no describe el checkpoint P2 retenido de la sesion
anterior. No hay hash de guardado en el log para probar la fecha exacta del
archivo; la correspondencia de sesion se sustenta en sus metadatos y valores.

SHA-256 v1: `59f98c72981929fde8e6044a78ff46b8b23c519b8f50cd4ad4c85566bf34224b`.
SHA-256 v2: `d93fa69ba1e348b8b4653502392a1faee6ef3883a1138968bf6ac05531401813`.

El notebook de ensemble selecciona 0.3/0.7 en validacion y evalua en test
sin temperatura. La reproduccion obtiene AUROC macro 0.8044989192 y mAP
0.1521846955 en 4,023 imagenes. Es reproduccion interna retrospectiva,
no prueba clinica independiente ni superioridad frente a un baseline pareado.

## Incompatibilidad encontrada en la calibracion anterior

En `S5_calibration (1).ipynb`, los umbrales se seleccionan sobre el ensemble
sin calibrar, pero la temperatura se ajusta con `p ** (1/T)`. Esto no es
temperature scaling sobre logits. En `S4_validation_tecnica (1).ipynb` se
aplica `sigmoid(logits/T)` a cada componente antes de combinarlos y se
reutilizan los umbrales sin calibrar: ajuste, aplicacion y umbrales no
representan la misma funcion de scores.

Ejemplo: para p=0.5 y T=0.2669, la potencia devuelve aproximadamente 0.0745,
mientras que sigmoid(logit(p)/T) devuelve 0.5. El NLL 0.1397 obtenido con la
potencia no puede compararse como calibracion equivalente al procedimiento
de logits. La media de max(p, 1-p) tampoco demuestra exactitud o calibracion.

Hay ademas impresiones inconsistentes: una sensibilidad de Infiltration
impresa reutiliza la variable de la ultima clase del bucle. Deben utilizarse
los registros por clase y conteos, no esas frases de resumen.

El reporte secundario (AUROC 0.8041, mAP 0.1511, sensibilidad macro 0.5911)
se conserva como historico de otra configuracion. La diferencia de metodos
esta identificada; no se atribuye toda diferencia numerica a una causa unica
sin reproduccion de cada variante.

## Evaluacion corregida, separada de produccion

`tools/calibrate_legacy_ensemble.py` comprueba el hash de las predicciones,
combina scores con el peso fijado, ajusta T solo en validacion y aplica
`sigmoid(logit(p_ensemble)/T)` de forma consistente. Selecciona umbrales
sobre esos mismos scores, sin redondearlos ni recortarlos. Test es opt-in;
no ajusta parametros. Nunca sobrescribe una carpeta de salida existente.

Predicciones SHA-256:
`b3e52a6898a3ba17535e697a4d4c157c7e6826d901f67eb4ba588c90fa24b456`.

T ajustada: **0.6586242093**; limites de busqueda 0.1 a 10. No esta en el borde.

| Medida | Raw | Candidato corregido |
| --- | --- | --- |
| NLL validacion | 0.38053575 | 0.36226636 |
| Brier validacion | 0.12006171 | 0.11555880 |
| NLL test retrospectivo | 0.37961909 | 0.36154932 |
| Brier test retrospectivo | 0.11965566 | 0.11520466 |
| AUROC macro test | 0.80449892 | 0.80449892 |
| mAP test | 0.15218470 | 0.15218470 |

La transformacion monotona conserva el ranking y, al transformar tambien
los umbrales, las decisiones en este ensayo. Sensibilidad macro test 0.70478735,
especificidad 0.73753366, precision 0.08855682 y F1 0.14472991 son iguales
antes y despues. Esto mejora NLL/Brier, **no aumenta precision diagnostica**.

Para mantener una comparacion metodologica con el criterio historico se
utilizaron objetivos de sensibilidad en validacion: Infiltration 0.70,
Pneumonia 0.65, Effusion y Edema 0.60; el resto usa Youden J. Son criterios
experimentales, no metas clinicas aprobadas. No garantizan esas sensibilidades
en test o en otra poblacion. El PPV test de Pneumonia es 0.01193 y el de
Infiltration 0.16689; requieren comunicar la carga de falsos positivos.

El candidato esta marcado `offline_candidate_not_for_deployment` y no es
compatible directamente con la temperatura por componente del backend.
Una temperatura global no corrige todos los sesgos por clase. Faltan intervalos,
curvas de calibracion, evaluacion externa y una migracion de bundle revisada.

## Uso y siguientes decisiones

La evaluacion adicional con los umbrales existentes de 0.25/0.30 se documenta en
[HISTORICAL_OPERATING_POINTS_2026-10-03.md](HISTORICAL_OPERATING_POINTS_2026-10-03.md).
Es otra configuracion de puntos de operacion, sin temperatura corregida ni
umbrales optimizados; sus resultados no se mezclan con el candidato anterior.

Instalar `tools/requirements.txt` en un entorno de evaluacion; PyTorch no es
necesario para esta herramienta porque usa predicciones guardadas.

```powershell
python tools/calibrate_legacy_ensemble.py --predictions <predictions.npz> --evidence-report <report.json> --output-dir <carpeta-nueva>
```

Agregar `--evaluate-test` solo para una evaluacion retrospectiva con parametros
ya fijados. Guardar el reporte por separado, no copiar T al backend actual.
Las pruebas cubren identidad, ranking, umbrales consistentes, entradas invalidas,
hash, ausencia de sobreescritura e independencia del ajuste frente a labels de test.

Verificacion local del 3 de octubre: 7 pruebas nuevas de calibracion y
18 pruebas de la suite de herramientas aprobadas (incluye esas 7). La dependencia
de estratificacion faltante se instalo en una carpeta aislada de evaluacion,
sin cambiar el entorno de produccion. No se reejecuto la suite completa de la API
ni del frontend: no hay cambios en esos componentes en esta tanda.

Cerrar la comparacion DenseNet121/CNN-ViT de semillas 42, 123 y 2026 con
configuraciones equivalentes, checkpoints y particiones identificadas.
Reportar diferencias pareadas e intervalos por paciente. Cualquier nueva loss,
resolucion o datos adicionales debe constituir otro experimento seleccionado
en validacion, sin presentar el test ya inspeccionado como confirmatorio nuevo.
