# Revision de software e interfaz

Fecha: 23 de septiembre de 2026. Alcance: frontend Next.js, contratos FastAPI,
inferencia, persistencia, reportes, autenticacion y configuracion local.
No se modificaron credenciales ni datos desplegados. No se realizo un despliegue.

## Hallazgos pendientes, por prioridad

### P1. Acceso inicial y proteccion frente a intentos repetidos

`frontend-next/lib/db.ts:51` y `frontend-next/lib/data/firestore-store.ts:38`
mantienen una contrasena de respaldo conocida cuando falta SEED_ADMIN_PASSWORD.
`frontend-next/auth.ts:15` no aplica un limite de intentos en authorize.
Esto no demuestra que las cuentas desplegadas usen ese respaldo, pero una
instalacion nueva puede quedar expuesta. Exigir una clave de inicializacion en
produccion, cambio inicial obligatorio y limitacion persistente de intentos.

### P1. Tamano de cargas no acotado en el proxy

`frontend-next/app/api/predict/route.ts:35` y
`frontend-next/app/api/predict-batch/route.ts:30` bufferizan el cuerpo completo
antes de que el backend valide el tamano. La validacion del navegador se puede
omitir. Un usuario autenticado puede consumir memoria con una solicitud grande.
Aplicar lectura limitada del stream y un limite agregado para lotes, con pruebas
sin Content-Length y de respuesta 413.

### P1. Evidencia insuficiente para afirmar aptitud clinica

`backend/services/model_service.py:100` evalua discordancia sobre una clase de
enfoque, no sobre todos los hallazgos. Sus margenes son reglas heuristicas.
Las cifras de AUC publicadas por el proyecto no constituyen una reproduccion de
la evaluacion ni demuestran calibracion, sensibilidad local o seguridad clinica.
Las reglas de prioridad por clase tampoco establecen gravedad individual.
Antes de alegar precision clinica: particion por paciente, evaluacion retenida,
intervalos de confianza, sensibilidad/especificidad por umbral, calibracion y
revision externa HNAL. Ver MODEL_VALIDATION_PLAN.md. No se reentreno el modelo.

### P2. Inferencia bloqueante

`backend/routers/predict.py:46` ejecuta inferencia sincrona dentro del handler
asincrono; el lote repite el patron en la linea 69. Puede retrasar otras
solicitudes de la misma instancia. Medir concurrencia real y aislar inferencia
en un ejecutor/cola con bloqueo del modelo: Grad-CAM usa hooks compartidos y no
debe paralelizarse sin control.

### P2. Generar un mapa adicional puede duplicar el registro

`frontend-next/components/analyze/GradCamView.tsx:57` vuelve a llamar a predict
cuando el resultado no contiene mapa. Esa ruta crea otro estudio y puede
volver a disparar correo. Hace falta una operacion de explicacion vinculada al
analisis original, con autorizacion e idempotencia. El cambio de opacidad, en
contraste, es completamente local y tiene una prueba de regresion.

### P2. Historial y estadisticas limitados

`frontend-next/app/api/analyses/route.ts:29` limita la consulta a 500 registros.
Filtros y estadisticas posteriores no abarcan necesariamente todo el historial.
La interfaz ahora explicita este alcance; queda pendiente paginacion y agregacion
en servidor. Los registros antiguos tampoco contienen las nuevas advertencias.

### P2. Reportes y trazabilidad adicionales

Las notas escritas para el PDF no se guardan como un informe versionado. El PDF
regenerado desde historial no recupera esas notas ni las imagenes. Se recomienda
guardar autor, fecha, version y estado de revision del informe. La firma dibujada
en el PDF no es una firma digital. Los textos de referencia clinica restantes
requieren revision del asesor; no son observaciones obtenidas de la imagen.

## Correcciones aplicadas

- Navegacion reducida y coherente; comparacion y administracion accesibles en movil.
- Tema claro/oscuro por clase CSS, fondos neutros y contraste de botones primarios.
- Formularios, filtros, historial movil y tablas con desplazamiento local.
- Cuenta y correo de alertas reunidos en un dialogo con foco controlado.
- Progreso ficticio sustituido por espera y tiempo transcurrido real.
- Errores de carga de archivos, autenticacion, usuarios y consulta del modelo visibles.
- Grad-CAM dirigido al hallazgo principal, no al primer elemento de la lista.
- Respuestas de mezcla obsoletas descartadas al cambiar opacidad rapidamente.
- Vista PNG derivada de los pixeles decodificados para DICOM; no se persiste en BD.
- Recursos de imagen liberados y fallback del visor cuando falla la decodificacion.
- Prioridad de lote e historial considera todos los hallazgos positivos.
- Sin umbral superado ya no se presenta como normalidad confirmada.
- PDF sin impresion diagnostica automatica inventada cuando faltan notas.
- Textos predefinidos identificados como tales; eliminadas indicaciones terapeuticas
  automaticas de la interfaz de recomendaciones y afirmaciones de protocolo HNAL.
- Advertencias y consistencia interna conservadas en nuevos registros del historial.
- CSV protegido contra formulas introducidas en campos de texto.

## Verificacion

- Backend: 102 tests aprobados con modelos simulados; 21 avisos de deprecacion pydicom.
- Frontend: 60 tests aprobados, incluidos carrera de opacidad, fallback del visor,
  semantica de No Finding, prioridad secundaria y exportacion CSV.
- TypeScript y compilacion Next.js aprobados con los ajustes visuales finales.
- Navegador Chromium: siete pantallas a 1440 y 390 px, claro y oscuro, con API de
  inferencia simulada y cuenta SQLite temporal. Sin errores JavaScript ni overflow
  horizontal de pagina en esas 28 combinaciones. Se ajustaron despues legibilidad
  de tabla de usuarios, tarjetas del historial y etiquetas de graficos.
- Descarga de PDF probada desde navegador con datos sinteticos de prueba.
- PDF renderizado para inspeccion: corregidos espacio reservado para imagenes y
  pie de pagina, proporcion de imagen y metodologia que afirmaba optimizacion
  de umbrales sin evidencia reproducible. Notas extensas requieren mas pruebas.

No es una certificacion WCAG, un pentest, una prueba de carga, una validacion del
modelo real ni una comprobacion de entrega SMTP. No se uso informacion de pacientes
ni se enviaron correos durante esta revision. La version Streamlit historica no
fue redisenada: el trabajo se realizo sobre la aplicacion Next.js actual.

## Prioridad para la tesis

Primero cerrar acceso y limites de carga; despues documentar un experimento
reproducible del modelo; luego validar flujos con radiologos y registrar evidencia
de aceptacion por historia de usuario. Una mejora visual o tests de software verdes
no prueban eficacia diagnostica ni completitud de todas las HU.
