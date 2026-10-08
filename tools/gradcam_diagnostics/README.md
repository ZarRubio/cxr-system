# Auditoria exploratoria de Grad-CAM

Estas herramientas comparan explicaciones sin modificar pesos, umbrales o el
preprocesamiento del servicio. No seleccionan automaticamente un metodo de
produccion ni miden precision diagnostica. Usan las dependencias del backend.

## Ejecucion

Colocar las imagenes PNG en una carpeta local `muestra/images`. Elegir una salida
nueva: el programa rechaza carpetas existentes para preservar evidencias.

```powershell
python tools/gradcam_diagnostics/compare_cam_methods.py --repo . --sample muestra --output resultados_cam --targets Emphysema Effusion Cardiomegaly Mass --extended
python tools/gradcam_diagnostics/summarize_multiclass_cam.py resultados_cam
python -m pytest tools/gradcam_diagnostics/test_cam_diagnostics.py tools/gradcam_diagnostics/test_gradcam_block_controls.py -q
```

Para cruzar etiquetas sin cambiar los controles, el informe admite
`--labels etiquetas.private.json`: una lista JSON con `image` y columnas por
clase, usando 0/1 o "0"/"1". Conserva todos los casos y agrega el denominador
positivo por clase; 0/0 significa que no hay casos positivos, no precision cero.
El informe calcula el numero real de imagenes y prefijos de paciente.
Las etiquetas NIH son referencias potencialmente ruidosas, no anotaciones de lesiones.
Una particion nueva no convierte pesos historicos en un modelo con test independiente.

`--extended` compara el GradCAM actual de v2 con GradCAM y HiResCAM del score
ponderado del ensemble. Sin esta opcion compara cinco variantes de capa/metodo.
La configuracion, clases y hashes se guardan antes de evaluar las imagenes.

El ensemble se explica diferenciando su salida ponderada de sigmoides. Las
contribuciones firmadas de ambas ramas se suman antes de ReLU y normalizacion.
No se promedian mapas coloreados ni mapas normalizados por separado.

## Interpretacion

- Un mapa constante, no finito o sin variacion espacial no es una explicacion util.
- GradCAM puede producir un mapa cero con gradientes no nulos: ReLU elimina
  contribuciones negativas. No invertir el signo ni usar valor absoluto para
  fabricar zonas positivas.
- La prueba exploratoria oculta bloques 32x32 con desenfoque gaussiano y veinte
  controles aleatorios, semilla 42. Su criterio es una caida positiva mayor que
  la del bloque de menor atribucion y la media de los controles aleatorios.
- Los campos heredados `logit_drop` y `baseline_logit` estan en unidades de la
  salida explicada. Para el ensemble son scores; para v2 son logits. Revisar
  `output_units` y no comparar magnitudes entre esas salidas.
- Un control satisfactorio no demuestra localizacion correcta ni diagnostico.
  Mantener todos los casos en el denominador, incluidos mapas no interpretables.

Para seleccionar un metodo se requiere validacion etiquetada separada por paciente,
con clases y criterios fijados antes de evaluar, varios tamanos y rellenos de
oclusion, y posteriormente una evaluacion independiente con anotaciones de lesiones.
No ajustar la muestra ni escoger mapas hasta obtener una cifra objetivo como 9/10.

Las salidas contienen imagenes y evidencias privadas. No subirlas ni subir los
checkpoints, credenciales o enlaces autenticados de descarga al repositorio.

## Cohorte balanceada fija

`prepare_cam_cohort.py` utiliza solo `val.csv`, verifica su hash contra el manifest
y fija diez positivos/diez negativos por clase, con pacientes distintos en toda
la muestra. No selecciona segun scores o mapas; admite exclusion de pacientes ya
inspeccionados. `materialize_cam_cohort.py` verifica la seleccion y copia PNG de
resolucion original sin cambiar pixeles. Falla si faltan imagenes, hay duplicados
o solo estan disponibles PNG reducidos; no sustituye casos.

```text
python tools/gradcam_diagnostics/prepare_cam_cohort.py --val SPLITS/val.csv --manifest SPLITS/manifest.json --output COHORTE_NUEVA
python tools/gradcam_diagnostics/materialize_cam_cohort.py --cohort COHORTE_NUEVA --images-root ORIGINALES --output MUESTRA_NUEVA
python tools/gradcam_diagnostics/compare_cam_methods.py --repo . --sample MUESTRA_NUEVA --cohort MUESTRA_NUEVA/selection.private.csv --output RESULTADOS_NUEVOS --targets Emphysema Effusion Cardiomegaly Mass --extended --robust-controls --device auto
python tools/gradcam_diagnostics/summarize_multiclass_cam.py RESULTADOS_NUEVOS --labels MUESTRA_NUEVA/labels.private.json
```

`--cohort` evalua solo los pares imagen-clase fijados, no un cruce de todas las
imagenes y clases. `--robust-controls` prueba tamanos 32/64 y rellenos media/desenfoque;
el informe exige que TODAS las condiciones pasen. `--device auto` usa CUDA cuando
esta disponible y registra el dispositivo. Comparar todos los metodos bajo la
misma configuracion; no mezclar ejecuciones CPU/GPU como si fueran una sola.

La cohorte es exploratoria para los pesos historicos: val nuevo no implica que
estos pesos nunca hayan visto a sus pacientes. No incluye anotaciones de lesiones
ni convierte controles de oclusion en medidas de localizacion o diagnostico.
