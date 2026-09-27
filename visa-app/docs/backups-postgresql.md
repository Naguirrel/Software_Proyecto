# Backups automaticos de PostgreSQL

Esta guia cubre la configuracion de backups para la base `visa_db` de VisaGuide. La instalacion actual del proyecto usa Docker Compose con PostgreSQL 15 en el servicio `db`; dentro de la red de Docker se accede por `db:5432` y desde el host se expone como `127.0.0.1:5433`.

## Archivos generados

- Script de backup: `tools/backups/backup_postgres.sh`.
- Wrapper diario para cron: `tools/backups/run_backup_job.sh`.
- Script de rotacion: `tools/backups/rotate_backups.sh`.
- Instalador de cron: `tools/backups/install_backup_cron.sh`.
- Ejemplo de variables: `tools/backups/backup.env.example`.
- Prueba segura: `tools/backups/validate_backup_scripts.sh`.

Cada backup se crea en formato custom de PostgreSQL con extension `.dump`, por ejemplo:

```bash
visa_db_20260927_030000.dump
```

La carpeta predeterminada dentro del proyecto es `backups/postgres`, ignorada por Git. En AWS se recomienda una carpeta dedicada fuera del repositorio, por ejemplo `/var/backups/visaguide/postgres`.

## Variables de entorno

Copie el ejemplo fuera del repositorio y protejalo con permisos restrictivos:

```bash
sudo mkdir -p /etc/visaguide
sudo cp tools/backups/backup.env.example /etc/visaguide/backup.env
sudo chmod 600 /etc/visaguide/backup.env
```

Edite `/etc/visaguide/backup.env` con valores reales del servidor:

```bash
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=replace_with_database_password
DB_NAME=visa_db
BACKUP_DIR=/var/backups/visaguide/postgres
BACKUP_PREFIX=visa_db
RETENTION_DAYS=7
```

No guarde credenciales reales en Git. Si el job corre dentro de la red de Docker, use `DB_HOST=db` y `DB_PORT=5432`; si corre desde el host AWS contra el puerto publicado por Compose, use `DB_HOST=127.0.0.1` y `DB_PORT=5433`.

## Instalacion del cron job

El backup debe correr todos los dias a las 3:00 AM. Desde la raiz del proyecto en el servidor AWS, ejecute:

```bash
ENV_FILE=/etc/visaguide/backup.env \
BACKUP_DIR=/var/backups/visaguide/postgres \
BACKUP_LOG_FILE=/var/log/visaguide/postgres-backup.log \
RETENTION_DAYS=7 \
tools/backups/install_backup_cron.sh
```

El instalador agrega o reemplaza una entrada marcada como `# visaguide-postgres-backup`. Para ver la linea antes de instalarla:

```bash
DRY_RUN=1 \
ENV_FILE=/etc/visaguide/backup.env \
BACKUP_DIR=/var/backups/visaguide/postgres \
BACKUP_LOG_FILE=/var/log/visaguide/postgres-backup.log \
RETENTION_DAYS=7 \
tools/backups/install_backup_cron.sh
```

La linea instalada usa rutas absolutas al script y al log. Si `/var/backups` o `/var/log/visaguide` requieren permisos elevados, cree las carpetas antes y asigne propietario al usuario que ejecuta cron.

## Revision de logs

Consulte el log configurado:

```bash
tail -n 100 /var/log/visaguide/postgres-backup.log
```

Los scripts no imprimen `DB_PASSWORD`. Si un backup falla, revise:

- Que `pg_dump` este instalado en el servidor.
- Que el archivo `ENV_FILE` exista y tenga permisos de lectura para el usuario de cron.
- Que `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` sean correctos.
- Que haya espacio disponible en disco.
- Que la carpeta de backups exista o pueda ser creada.
- Que PostgreSQL este disponible y acepte conexiones desde el entorno donde corre cron.

No elimine backups recientes para liberar espacio hasta haber confirmado que existe al menos un respaldo valido.

## Verificar backups y retencion

Verifique que existe al menos un backup:

```bash
ls -lh /var/backups/visaguide/postgres/visa_db_*.dump
```

Verifique que no queden backups con mas de 7 dias:

```bash
find /var/backups/visaguide/postgres -maxdepth 1 -type f -name 'visa_db_*.dump' -mtime +7 -print
```

Ese comando no deberia imprimir archivos despues de una ejecucion correcta de rotacion.

## Restauracion con pg_restore

Primero pruebe siempre en una base temporal. No restaure sobre produccion sin ventana de mantenimiento y sin crear un backup previo.

Crear una base temporal:

```bash
createdb \
  --host=127.0.0.1 \
  --port=5433 \
  --username=postgres \
  visa_db_restore
```

Restaurar un backup:

```bash
pg_restore \
  --host=127.0.0.1 \
  --port=5433 \
  --username=postgres \
  --dbname=visa_db_restore \
  --clean \
  --if-exists \
  --no-owner \
  /var/backups/visaguide/postgres/visa_db_YYYYMMDD_HHMMSS.dump
```

Comprobar que la restauracion fue exitosa:

```bash
psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=visa_db_restore -c '\dt'
psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=visa_db_restore -c 'SELECT COUNT(*) FROM usuario;'
```

## Restauracion de emergencia

1. Active una ventana de mantenimiento y detenga temporalmente la aplicacion si el restore afectara `visa_db`.
2. Genere un backup previo al restore con `tools/backups/backup_postgres.sh`.
3. Restaure primero en `visa_db_restore` y valide tablas/datos basicos.
4. Si la validacion es correcta, restaure sobre `visa_db` con `pg_restore --clean --if-exists --no-owner`.
5. Reinicie la aplicacion y valide login, dashboard y pantallas criticas.
6. Guarde el log del incidente y el nombre exacto del backup usado.

## Validacion segura

La prueba incluida no se conecta a PostgreSQL real. Usa un `pg_dump` simulado en un directorio temporal y comprueba que:

- Se crea la carpeta de destino.
- Se crea un archivo `.dump`.
- La retencion elimina archivos antiguos.
- Los archivos recientes se conservan.

Ejecute:

```bash
tools/backups/validate_backup_scripts.sh
```

En Windows puede ejecutarse con Git Bash:

```bash
"C:\Program Files\Git\bin\bash.exe" -lc "./tools/backups/validate_backup_scripts.sh"
```

## Mejora opcional

Subir backups a S3 o Cloudflare R2 queda como mejora opcional futura. Esta tarea no configura S3/R2 ni credenciales de almacenamiento externo.
