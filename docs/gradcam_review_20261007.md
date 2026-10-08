# Revision exploratoria de Grad-CAM - 7 octubre 2026

## Estado del codigo

Se agrego una proteccion de mapas constantes, no finitos, fuera de rango o de
geometria invalida. La API comunica `not_interpretable`; la interfaz conserva la
imagen de entrada sin mostrar un falso mapa ni su control de opacidad. No cambian
pesos, umbrales, preprocesamiento ni correos. Los metodos nuevos permanecen offline.

Las herramientas estan en `tools/gradcam_diagnostics`; sus diez pruebas y Ruff
pasaron localmente. Los cambios anteriores tambien pasaron CI de backend y frontend.

## Diez casos adicionales, cuatro clases

Se fijaron Emphysema, Effusion, Cardiomegaly y Mass antes de ejecutar la prueba.
Cada metodo evalua 40 pares imagen-clase. El control usa un bloque 32x32, desenfoque
gaussiano y veinte posiciones aleatorias. Se considera consistente una caida
positiva mayor que la del bloque de menor atribucion y la media de controles.

| Metodo | Mapas con variacion / 40 | Control satisfactorio / 40 |
| --- | --- | --- |
| GradCAM actual de v2 | 37 | 20 |
| GradCAM del score del ensemble | 36 | 17 |
| HiResCAM del score del ensemble | 40 | 19 |

No hay una mejora general suficiente para reemplazar el metodo actual. Producir
mas mapas variables no demuestra una explicacion mejor: HiResCAM evita los mapas
constantes de esta muestra, pero no supera al actual en el control global.

## Auditoria posterior de etiquetas

Se cruzaron los nombres con train/val/test del protocolo independiente nuevo,
verificando los hashes SHA256 contra su manifest. Las diez imagenes no tienen
etiquetas NIH positivas para las cuatro clases ensayadas. Cuatro pertenecen a train,
cuatro a val y dos a test de ese protocolo nuevo. La muestra fue de conveniencia,
no una evaluacion confirmatoria: las referencias a test describen procedencia,
no autorizan usarlo para ajustar el metodo.

El manifest indica expresamente que los checkpoints historicos no son elegibles
para test independiente con esas particiones nuevas. No confundir pertenencia a
val nueva con ausencia de exposicion del modelo historico. Las etiquetas NIH son
potencialmente ruidosas y no incluyen anotaciones de lesiones en este ensayo.

## Piloto con referencias positivas

Se seleccionaron por etiquetas, antes de observar sus mapas, tres imagenes de dos
pacientes del val nuevo. Se probaron enfisema y derrame con los mismos controles.
Cada clase tiene dos referencias positivas; algunas imagenes comparten paciente.

| Clase | Actual v2 | Ensemble GradCAM | Ensemble HiResCAM |
| --- | --- | --- | --- |
| Emphysema: control satisfactorio / positivos | 1/2 | 1/2 | 0/2 |
| Effusion: control satisfactorio / positivos | 0/2 | 1/2 | 1/2 |

El piloto es demasiado pequeno y correlacionado para concluir superioridad. No
se midio localizacion, sensibilidad, especificidad ni precision diagnostica.
La imagen aportada por el usuario tiene referencia NIH Pneumothorax y pertenece
al train nuevo; tampoco sirve como test independiente de los pesos historicos.

## Siguiente decision

No desplegar una sustitucion de metodo ni declarar 9/10. Primero congelar un
protocolo etiquetado con positivos y negativos por clase, varios pacientes, y
separacion compatible con la procedencia de los pesos. Repetir controles con
diferentes tamanos/rellenos y pruebas de sensibilidad a parametros del modelo.
Para afirmar localizacion se necesitan anotaciones de lesiones y una evaluacion
independiente. Si aparecen dependencias de marcadores o dispositivos, investigarlas
como hipotesis; no ocultarlas visualmente ni forzar el mapa a los pulmones.

Los resultados por imagen, radiografias, metadatos privados, credenciales, URLs de
descarga y checkpoints permanecen locales; no se incluyen en GitHub.
