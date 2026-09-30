# Seguridad, recuperacion de acceso y validacion

## Cambios implementados

- Login limitado por cuenta e IP, con contadores persistentes en SQLite o Firestore.
- Sin contrasena administrativa predeterminada. Una base vacia requiere
  `SEED_ADMIN_PASSWORD` de al menos 12 caracteres; las cuentas existentes no se modifican.
- Recuperacion desde `/login` hacia `/recover`, mediante codigo de seis digitos.
  Caducidad: 10 minutos. Maximo: cinco comprobaciones por codigo.
  Un codigo no se almacena en claro: se persiste HMAC-SHA256 con `AUTH_SECRET`.
- La confirmacion consume el codigo y cambia el hash de contrasena en una unica
  transaccion. Revisa que la cuenta siga activa, con el mismo correo y contrasena previa.
  Las sesiones anteriores dejan de acceder a rutas protegidas.
- Solicitud de recuperacion con respuesta generica, cooldown por correo e IP.
  El envio SMTP se ejecuta despues de responder; una aceptacion SMTP no prueba
  la llegada a la bandeja del destinatario.
- Correo obligatorio al crear y editar cuentas. Correos duplicados heredados no
  permiten recuperacion automatica: el administrador debe resolverlos primero.
- Limite efectivo al leer el cuerpo HTTP: 15 MB por imagen, 30 MB por lote.
  La inferencia se serializa fuera del event loop para proteger los hooks de CAM.
- Historial paginado con cursor de fecha e ID; filtros recorren registros antiguos.
  Exportaciones y estadisticas siguen los cursores, con un limite explicito de trabajo.
- Reintento manual de alertas atascadas en `sending` durante al menos 10 minutos.
  Maximo tres intentos por destinatario. Verificar posible entrega antes de reenviar.
- Alertas de IA y prioridad profesional diferenciadas. No hay determinacion
  automatica de gravedad del paciente a partir de una clase del modelo.
- Estudios nuevos registran la huella del bundle de artefactos, version de
  preprocesamiento y umbrales utilizados. El PDF incluye esos umbrales y la revision.
- `/ready` devuelve 503 si el modelo no esta disponible; el despliegue lo comprueba.
  Cambios exclusivos de frontend no reconstruyen el contenedor del modelo.

## Configuracion y compatibilidad

Se reutilizan `SMTP_USER`, `SMTP_PASSWORD`, `AUTH_URL` y `AUTH_SECRET`.
`AUTH_SECRET` requiere al menos 32 caracteres para la recuperacion. No escribir
secretos en archivos versionados ni en logs. Configurar las mismas variables en
local para probar correo real; los secretos de GitHub no se copian automaticamente.

La primera publicacion de estos cambios cerrara las sesiones anteriores una vez.
Los usuarios conservaran sus cuentas y podran iniciar sesion nuevamente.
Los estudios antiguos no reciben huellas ni umbrales inventados. Un mapa antiguo
solo puede regenerarse con el bundle exacto que produjo el estudio; si no existe
esa evidencia, se requiere un analisis nuevo.

Firestore utiliza `security_state` y `user_identity`, ademas de `users` y `analyses`.
Habilitar TTL para `security_state.ttl` en la consola Firestore. La caducidad de
codigos se comprueba en la aplicacion incluso si el borrado TTL se demora.
Los cursores requieren el indice de historial existente por usuario y fecha,
con orden descendente del documento en caso de empate.

## Pruebas antes de publicar

1. Ejecutar tests, ESLint, TypeScript, build y Ruff.
2. Probar login y recuperacion con una cuenta de prueba y correo real configurado.
3. Verificar codigo incorrecto, caducado, agotado y reutilizado; comprobar que una
   sesion abierta antes del cambio pierde acceso despues de actualizar la contrasena.
4. Analizar una imagen de prueba, confirmar guardado, reabrir historial, registrar
   lectura independiente y descargar PDF. No usar datos de pacientes en capturas publicas.
5. Simular rechazo SMTP e interrupcion, verificar estado persistente y reintento manual.
6. Tras publicar, comprobar `/ready`, `/login`, `/recover` e inferencia autenticada.

## Trabajo que no equivale a una correccion de software

No se cambiaron pesos, arquitectura entrenada, particiones ni umbrales del modelo.
Las pruebas funcionales no establecen precision clinica ni completan por si solas
el Objetivo 4 o el full paper. Sigue pendiente:

1. Completar recuperacion y auditoria de imagenes originales y trazabilidad de particiones.
2. Congelar el protocolo de baseline DenseNet121 y CNN-ViT para las tres semillas.
3. Comparar 224 frente a 384 pixeles bajo condiciones equivalentes, primero en validacion.
4. Evaluar una modificacion por vez y replicar solo mejoras prometedoras.
5. Fijar umbrales con validacion; cerrar test con metricas por clase e intervalos por paciente.
6. Evaluar fidelidad de Grad-CAM con controles de oclusion y, si existen anotaciones,
   localizacion cuantitativa. No escoger mapas por apariencia.
7. Incorporar resultados, limitaciones y evidencias funcionales al Objetivo 4 y articulo.

Una cola de correo con trabajador independiente y confirmacion de entrega real
es una fase distinta: este cambio recupera intentos interrumpidos de manera manual
y segura, sin reenvios automaticos que puedan duplicar alertas.
