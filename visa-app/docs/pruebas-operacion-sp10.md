# SP10-26: pruebas de operación

Pruebas de los requisitos de operación de VisaGuide en el Sprint 10:

- **RNF-23, respaldo restaurable:** un backup de PostgreSQL debe poder restaurarse completo en una base nueva.
- **RNF-10, disponibilidad:** la aplicación debe estar disponible al menos el 99% del tiempo.

## Herramientas

| Script | Qué hace |
|---|---|
| `tools/backups/backup_postgres.sh` | Genera el backup `.dump` (ya existía; lo usa el cron diario). |
| `tools/backups/verify_restore.sh` | Restaura un backup en una base temporal, compara tablas y filas con la base de origen, mide el tiempo y elimina la base temporal. |
| `tools/monitoring/monitor_server.sh` | Revisa la aplicación y los recursos cada 5 minutos (ya existía; lo usa el cron). |
| `tools/monitoring/availability_report.sh` | Calcula el % de disponibilidad a partir del log del monitoreo. |

El uso detallado está en `docs/backups-postgresql.md` y `docs/server-monitoring.md`.

## RNF-23: restauración de backup

**Criterio de aceptación:** `verify_restore.sh` termina con `RESULTADO: OK`, es decir, `pg_restore` restaura el backup sin errores y la base restaurada contiene todas las tablas de la base de origen.

**Resultado: no ejecutada en este sprint.** La prueba necesita un PostgreSQL con `pg_dump` y `pg_restore`, y en el equipo de pruebas Docker Desktop no pudo arrancar: su motor de WSL falla al iniciar (error `0xc00000fd`). Se intentó actualizando WSL a la versión 3.0.3, limpiando los archivos de socket que dejaban las caídas y desactivando el antivirus, sin éxito. El script quedó escrito con validaciones de seguridad (nunca restaura sobre la base de origen y elimina la base temporal al terminar), y su sintaxis se comprobó, pero no se ha ejecutado contra una base real.

El procedimiento manual de restauración y el cron de backups diarios están documentados desde el Sprint 8 en `docs/backups-postgresql.md`. La prueba queda pendiente para un equipo con Docker funcionando o para el servidor.

## RNF-10: disponibilidad

**Criterio de aceptación:** `availability_report.sh` reporta una disponibilidad de al menos 99% en el periodo medido.

El cálculo se validó con un log de prueba de 200 revisiones con una caída de 10 minutos: resultó 99,00%, cumple con meta de 99% y no cumple con meta de 99,5%. También se validaron el filtro por fechas y el error cuando no hay datos. Estas pruebas están en `tools/monitoring/validate_monitoring.sh`.

La medición sobre el log real se hace en el servidor de producción como parte de su operación, fuera de esta tarea.

**Limitación:** el log del monitoreo guarda como máximo 2000 líneas (`MONITOR_MAX_LOG_LINES`). Cada revisión ocupa unas seis, así que solo cubre poco más de un día. Para medir semanas hay que aumentar ese límite (25000 líneas cubren unos 14 días) o usar el historial de UptimeRobot si está configurado.

## Uso en el servidor

Los dos scripts sirven también en EC2, desde la copia del repositorio y con el mismo usuario de los cron. Ninguno modifica la base de producción: la restauración usa una base temporal que se elimina al terminar.

```bash
ENV_FILE=/etc/visaguide/backup.env /opt/visa-app/tools/backups/verify_restore.sh
```

```bash
/opt/visa-app/tools/monitoring/availability_report.sh /var/log/visaguide/server-monitoring.log
```
