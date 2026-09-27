# Auditoria de datos y procedencia del modelo

## Estado actual

La primera revision del respaldo local encontro diferencias de cobertura. Se creo
una copia HDF5 recuperada y un split nuevo, ambos auditados; ver
[NIH_AUDIT_2026-09-25.md](NIH_AUDIT_2026-09-25.md). La integridad de la copia
recuperada paso, pero la procedencia del entrenamiento y la validez clinica siguen
en CHECK REQUIRED. El AUC del test historico se reprodujo localmente dentro de
1e-4; ver [MODEL_REPRODUCTION_2026-09-25.md](MODEL_REPRODUCTION_2026-09-25.md).

- El ensemble usa dos checkpoints y cuatro archivos JSON. El AUC de prueba
  0.8045 se recalculo con los checkpoints locales y el test historico: 0.8044989.
  Los objetos del bucket y el despliegue actual todavia no se cotejaron por hash.
- El repositorio de la aplicacion no contiene el CSV completo de NIH, el HDF5 ni las
  predicciones por estudio. La copia recuperada contiene 112,120 imagenes; los
  checkpoints historicos se entrenaron con el protocolo anterior de 102,120.
- Los SHA-256 de los dos checkpoints locales coinciden con los del respaldo del
  experimento, pero aun no se han cotejado con los objetos del bucket ni vinculado
  a un commit preciso de `cxr-research`. No se debe rellenar `research_commit`
  hasta comprobar esa relacion.
- El split nuevo de 112,120 imagenes es solo para entrenamiento futuro: los pesos
  actuales no se pueden evaluar sobre el como prueba independiente.

## Artefactos usados por cada despliegue

El workflow descarga los seis archivos del bucket y ejecuta
`backend/model_manifest.py` antes de construir la imagen. El manifiesto registra el
SHA-256 de cada archivo, un fingerprint conjunto y el commit de `cxr-system`. Al
arrancar, el backend vuelve a calcular los hashes; si falta el manifiesto o alguno
no coincide, el ensemble no se carga y `/health` pasa a `degraded`. El fingerprint
se puede consultar en `/model-info` con la API key.

Para comprobar los artefactos **locales**, desde la raiz de `cxr-system`:

```bash
python backend/model_manifest.py --artifacts-dir backend/artifacts
```

Este comando crea un manifiesto local ignorado por Git. No demuestra por si solo
que los archivos locales coincidan con el bucket o con los del despliegue actual.
Una vez publicado un nuevo despliegue con este mecanismo, comparar el fingerprint
de `/model-info` con el generado a partir de una copia descargada del mismo bucket.
El SHA-256 identifica archivos; no certifica la validez clinica del modelo.

## Repeticion de la auditoria NIH

Usar el script de `cxr-research` fijado en el commit
`c11f59d84cc4e181f40082daea0388f38f0875c0`. En el entorno donde estan
el CSV NIH completo y el HDF5, ejecutar desde la raiz de ese repositorio:

```bash
python scripts/audit_nih_data.py \
  --metadata data/raw/nih/Data_Entry_2017.csv \
  --hdf5 data/raw/nih/nih_images.h5 \
  --views frontal \
  --verify-pixels
```

Sustituir las rutas por las reales. `--views frontal` exige cobertura PA/AP; usar
`--views all` solo si el HDF5 debe contener tambien las otras vistas. La lectura
completa de pixeles puede tardar bastante, pero detecta bloques comprimidos danados.

Solo si los splits deben cubrir **todas** las imagenes del alcance elegido, repetir
con `--splits data/processed_s4ml` (o el directorio real). El script falla si hay
imagenes omitidas; por eso no se debe usar esa comprobacion de cobertura total
para un experimento basado deliberadamente en un subconjunto. En ese caso,
documentar el criterio de seleccion y verificar por separado la ausencia de
solapamiento de pacientes entre train, val y test.

Conservar un reporte agregado con fecha, commit del script, conteos, resultado
PASS/CHECK REQUIRED y SHA-256 del CSV/HDF5/splits. No publicar imagenes, IDs de
pacientes ni rutas privadas. Un PASS de integridad no valida etiquetas, rendimiento
ni generalizacion clinica.

## Condicion para vincular la investigacion

Antes de atribuir un checkpoint a un experimento, conservar una tabla verificable
con: commit de `cxr-research`, hashes de datos y splits, configuracion de
entrenamiento, SHA-256 del checkpoint, reporte de evaluacion y metodo de seleccion
de umbrales. Solo entonces actualizar el manifiesto de procedencia y las metricas
mostradas por la aplicacion. La validacion externa independiente sigue siendo independiente.
