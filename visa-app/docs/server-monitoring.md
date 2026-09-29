# SCRUM-199: monitoreo y alertas del servidor

Este monitor se ejecuta **en el host Ubuntu de EC2**, fuera de Docker Compose, para medir los recursos reales del servidor. Consulta la aplicacion publica por HTTPS y revisa CPU, memoria y el filesystem que contiene `/`. El cron del usuario que lo instala lo ejecuta cada cinco minutos. No necesita cambios en los contenedores ni credenciales de la aplicacion.

## Estados y umbral

| Estado | Significado | Codigo de salida |
| --- | --- | ---: |
| `OK` | HTTP 2xx/3xx y todos los recursos en el umbral o por debajo | 0 |
| `WARNING` | CPU, memoria o disco **supera** el umbral | 1 |
| `CRITICAL` | La URL no responde, devuelve HTTP 4xx/5xx o falla una medicion | 2 |

El umbral predeterminado es **80%**. El resultado final refleja el estado mas grave. El monitor registra el codigo HTTP y el tiempo de respuesta en segundos, el uso de CPU calculado con dos muestras de `/proc/stat`, la memoria utilizada respecto de la memoria disponible (`free`) y el uso de disco (`df`). El archivo de log queda limitado a 2000 lineas por defecto. Un correo de alerta se intenta enviar por cada revision con estado distinto de `OK` cuando `ALERT_EMAIL` esta configurado.

## Dependencias en AWS

Instalar en la instancia Ubuntu, como administrador:

```bash
sudo apt-get update
sudo apt-get install -y curl coreutils procps mawk util-linux cron
sudo systemctl enable --now cron
```

Estas dependencias aportan `curl`, `df`, `free`, `awk`, `date`, `flock` y `crontab`. Los scripts comprueban las herramientas que usan y muestran un error si falta alguna. `bash` y acceso a `/proc/stat` son necesarios. Para ejecutar `tools/monitoring/validate_monitoring.sh` tambien se necesita Node.js, disponible en el entorno de desarrollo del proyecto; el monitor de produccion no depende de Node.js.

El envio de correo requiere, adicionalmente, una utilidad compatible con `mail` (por ejemplo `mailutils`) **y** un MTA o relay SMTP operativo. Instalar `mailutils` sin configurar la entrega no garantiza que lleguen alertas:

```bash
sudo apt-get install -y mailutils
```

Configure el MTA o relay SMTP segun la politica de la instancia. Guarde cualquier credencial fuera del repositorio, en archivos con permisos restrictivos o en un gestor de secretos. El monitor solo necesita `ALERT_EMAIL`; no almacena ni imprime contraseñas, tokens o el contenido del archivo de configuracion. Si `mail` falta o falla, lo registra como `WARNING` en el log.

## Configuracion en EC2

Ejecute estos comandos desde la copia del repositorio en EC2 con el mismo usuario que instalara el cron. Sustituya `/opt/visa-app` por la ruta absoluta real de esa copia. Los directorios se asignan al usuario actual para que cron pueda leer la configuracion y escribir los logs.

```bash
sudo install -d -m 700 -o "$(id -un)" -g "$(id -gn)" /etc/visaguide
sudo install -d -m 750 -o "$(id -un)" -g "$(id -gn)" /var/log/visaguide
sudo install -m 600 -o "$(id -un)" -g "$(id -gn)" \
  /opt/visa-app/tools/monitoring/monitoring.conf.example \
  /etc/visaguide/monitoring.env
sudoedit /etc/visaguide/monitoring.env
```

En `/etc/visaguide/monitoring.env`, configure por ejemplo:

```bash
MONITOR_URL=https://visa-app.duckdns.org
MONITOR_THRESHOLD=80
MONITOR_DISK_PATH=/
MONITOR_LOG_FILE=/var/log/visaguide/server-monitoring.log
MONITOR_MAX_LOG_LINES=2000
ALERT_EMAIL=
```

`MONITOR_URL` acepta HTTP(S), pero para produccion use HTTPS. No incluya credenciales en la URL. `MONITOR_THRESHOLD` es un entero de 0 a 100; una alerta se emite cuando una medicion lo **supera**, no al igualarlo. `MONITOR_DISK_PATH` permite medir otro filesystem montado si los datos criticos no estan en `/`. `ALERT_EMAIL` puede quedar vacio hasta tener la entrega de correo lista; despues use un destinatario autorizado configurado directamente en EC2. No suba este archivo al repositorio.

## Instalacion del cron

Primero inspeccione la entrada propuesta. `DRY_RUN=1` no consulta ni modifica el crontab:

```bash
DRY_RUN=1 MONITOR_ENV_FILE=/etc/visaguide/monitoring.env \
  /opt/visa-app/tools/monitoring/install_monitoring_cron.sh
```

Instale una sola entrada cada cinco minutos y compruebela:

```bash
MONITOR_ENV_FILE=/etc/visaguide/monitoring.env \
  /opt/visa-app/tools/monitoring/install_monitoring_cron.sh
crontab -l | grep visaguide-server-monitoring
```

El instalador actualiza su entrada anterior si se ejecuta de nuevo y conserva las demas entradas del usuario. La linea usa `/bin/bash` y la ruta absoluta al ejecutor. El ejecutor lee la configuracion externa, evita revisiones simultaneas con `flock`, agrega la fecha y hora a cada revision y conserva como maximo `MONITOR_MAX_LOG_LINES` lineas. La cuenta de cron debe tener permisos para crear el log y su archivo `.lock` en el directorio indicado.

## Revision y pruebas seguras

Prueba manual con la configuracion de EC2:

```bash
MONITOR_ENV_FILE=/etc/visaguide/monitoring.env \
  /opt/visa-app/tools/monitoring/run_monitoring_job.sh
tail -n 40 /var/log/visaguide/server-monitoring.log
```

Para ver el resultado directamente sin escribir el log, ejecute el monitor:

```bash
MONITOR_URL=https://visa-app.duckdns.org MONITOR_THRESHOLD=80 \
  /opt/visa-app/tools/monitoring/monitor_server.sh
echo "$?"
```

Simule una URL caida usando un puerto local donde no escucha ningun servicio; esto no detiene la aplicacion ni modifica Docker:

```bash
MONITOR_URL=http://127.0.0.1:1/ \
  /opt/visa-app/tools/monitoring/monitor_server.sh
echo "$?"  # 2: CRITICAL
```

Ejecute la suite de validacion en una copia de desarrollo con Node.js. Levanta un servidor HTTP local temporal y usa metricas simuladas para comprobar URL activa y caida, umbral ajustable, alertas independientes de CPU, memoria y disco, sintaxis Bash, correo simulado, generacion y limite del log y que `DRY_RUN` no llame a `crontab`:

```bash
bash /opt/visa-app/tools/monitoring/validate_monitoring.sh
```

La suite no eleva CPU ni llena memoria o disco. Para verificar un umbral diferente manualmente, use `MONITOR_THRESHOLD=10` en una prueba directa y observe las lineas `WARNING`; la suite usa valores controlados y es la forma determinista de probar cada recurso. No pruebe sobrecargando la instancia de produccion.

## Alternativa externa: UptimeRobot

En el panel de UptimeRobot, cree un monitor nuevo de tipo **HTTP(s)** con URL `https://visa-app.duckdns.org`, nombre identificable como `VisaGuide produccion`, intervalo de cinco minutos y un contacto de alerta verificado asociado a ese monitor. Guarde el monitor y compruebe que aparece como activo y que el contacto esta vinculado. Segun la [guia oficial de creacion](https://help.uptimerobot.com/en/articles/11358364-how-to-create-your-first-monitor-on-uptimerobot-quick-setup-guide), el monitor HTTP(s) marca la web como caida cuando no responde o devuelve un codigo de error; la [documentacion del intervalo](https://help.uptimerobot.com/en/articles/11360876-what-is-a-monitoring-interval-in-uptimerobot) indica cinco minutos para el plan gratuito. Configure y verifique las notificaciones en el servicio, sin colocar credenciales de UptimeRobot en este repositorio.

UptimeRobot observa la disponibilidad desde fuera de EC2. El cron local sigue siendo necesario para CPU, memoria y disco. Una interrupcion total de la instancia puede impedir que el cron local emita correos; el monitor externo cubre ese caso de disponibilidad.

## Capturas de evidencia

- Salida manual `OK` con HTTP, tiempo, CPU, memoria y disco.
- Salida `CRITICAL` de la URL local caida y salida `WARNING` de cada recurso en la suite de validacion.
- Salida completa de `validate_monitoring.sh` y del instalador con `DRY_RUN=1`.
- `crontab -l` con la entrada `*/5` y ruta absoluta, mas `tail` del log con fecha y hora de dos revisiones.
- Si se habilita correo, mensaje de prueba recibido y configuracion del MTA, ocultando destinatarios y cualquier dato sensible.
- Monitor HTTP(s) activo de UptimeRobot y contacto de alerta asociado, ocultando datos personales.
