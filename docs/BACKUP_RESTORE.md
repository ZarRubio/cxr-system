# Copias y recuperacion de Firestore

La aplicacion desplegada guarda usuarios y estudios en Firestore `(default)` del proyecto `project-962d2332-8a63-46b3-92e`. Los archivos de imagen no se guardan en Firestore. El bucket de artefactos del modelo es independiente y no queda cubierto por estas copias. Tampoco incluyen secretos SMTP/Auth ni politicas TTL.

## Activacion y comprobacion

1. La primera subida del workflow **Firestore backup** intenta crear la programacion diaria con retencion de siete dias. Tambien se puede ejecutar manualmente con `action=setup`. Solo crea una programacion si no existe ya una diaria. Requiere permisos de administracion de programaciones de backup para la identidad de GitHub Actions y genera cargos de almacenamiento.
2. Confirmar que el workflow termina correctamente. La programacion no prueba que ya exista una copia: esperar el primer respaldo y ejecutar `action=verify`. La ejecucion semanal comprueba que haya al menos una copia `READY`; un fallo debe investigarse, no ignorarse.
3. Consultar `gcloud firestore backups list --project=project-962d2332-8a63-46b3-92e --format='table(name,database,state,snapshotTime)'` y comprobar fecha, base y estado. El objetivo es un respaldo diario; hasta ver uno listo, la recuperacion no esta verificada.

## Ensayo de recuperacion

1. Seleccionar una copia `READY` del proyecto y anotar su nombre completo `projects/.../locations/.../backups/...`.
2. Con una cuenta autorizada y una ventana de mantenimiento aprobada, restaurar **solo a una base nueva**, por ejemplo:

   ```bash
   gcloud firestore databases restore \
     --project=project-962d2332-8a63-46b3-92e \
     --source-backup='projects/PROJECT_ID/locations/LOCATION_ID/backups/BACKUP_ID' \
     --destination-database='cxr-restore-test'
   ```

3. Verificar conteos y algunos IDs conocidos de `users` y `analyses` mediante una cuenta con acceso restringido. No imprimir contrasenas, notas clinicas ni documentos completos en logs. Documentar fecha de la copia, tiempo de restauracion y diferencias.
4. No apuntar la aplicacion a la base restaurada sin un plan de migracion y validacion independiente. La restauracion crea otra base; no sustituye `(default)` ni recupera datos posteriores a la copia. La prueba de restauracion puede generar cargos adicionales.

Referencias: [Firestore backups](https://cloud.google.com/firestore/docs/backups), [crear programacion](https://cloud.google.com/sdk/gcloud/reference/firestore/backups/schedules/create), [restaurar base](https://cloud.google.com/sdk/gcloud/reference/firestore/databases/restore).
