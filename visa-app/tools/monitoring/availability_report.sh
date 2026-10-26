#!/usr/bin/env bash
# Reporte de disponibilidad (RNF-10) a partir del log de monitor_server.sh.
# Cada "Revision del servidor" con su linea "aplicacion" cuenta como una muestra:
# OK = disponible; CRITICAL = no disponible. CPU, memoria y disco no afectan el calculo.
set -euo pipefail

for command_name in awk date; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'ERROR: falta la herramienta requerida: %s\n' "$command_name" >&2
    exit 2
  }
done

log_file="${1:-${MONITOR_LOG_FILE:-/var/log/visaguide/server-monitoring.log}}"
target="${AVAILABILITY_TARGET:-99}"
since="${REPORT_SINCE:-}"
until_date="${REPORT_UNTIL:-}"
interval_minutes="${MONITOR_INTERVAL_MINUTES:-5}"

if [[ ! -r "$log_file" ]]; then
  printf 'ERROR: no se puede leer el log: %s\n' "$log_file" >&2
  exit 2
fi
if ! [[ "$target" =~ ^[0-9]+([.][0-9]+)?$ ]] || ! [[ "$interval_minutes" =~ ^[1-9][0-9]*$ ]]; then
  printf 'ERROR: AVAILABILITY_TARGET o MONITOR_INTERVAL_MINUTES invalido.\n' >&2
  exit 2
fi
for value in "$since" "$until_date"; do
  if [[ -n "$value" && ! "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    printf 'ERROR: REPORT_SINCE y REPORT_UNTIL usan el formato AAAA-MM-DD.\n' >&2
    exit 2
  fi
done

awk -v target="$target" -v since="$since" -v until_date="$until_date" -v interval="$interval_minutes" '
  function close_sample() {
    if (!pending) return
    pending = 0
    if (status == "") { incomplete++; return }
    total++
    if (first == "") first = stamp
    last = stamp
    if (status == "OK") {
      up++
      streak = 0
    } else {
      down++
      streak++
      if (streak == 1) { incidents++; streak_start = stamp }
      if (streak > longest) { longest = streak; longest_start = streak_start; longest_end = stamp }
    }
  }
  /^\[[0-9]/ && /\] Revision del servidor$/ {
    close_sample()
    stamp = substr($0, 2, index($0, "]") - 2)
    day = substr(stamp, 1, 10)
    if ((since != "" && day < since) || (until_date != "" && day > until_date)) next
    pending = 1
    status = ""
    next
  }
  pending && /^OK: aplicacion / { status = "OK"; next }
  pending && /^CRITICAL: aplicacion / { status = "DOWN"; next }
  END {
    close_sample()
    if (total == 0) {
      print "ERROR: el log no contiene revisiones de la aplicacion en el periodo solicitado." > "/dev/stderr"
      exit 2
    }
    availability = 100 * up / total
    printf "Reporte de disponibilidad (RNF-10)\n"
    printf "Periodo cubierto por el log: %s -> %s\n", first, last
    printf "Muestras: %d (cada %d min aprox.)\n", total, interval
    printf "Disponible: %d | No disponible: %d | Incidentes: %d\n", up, down, incidents
    if (incomplete > 0) printf "Revisiones sin linea de aplicacion (ignoradas): %d\n", incomplete
    if (longest > 0) printf "Caida mas larga: %d muestra(s), ~%d min (%s -> %s)\n", longest, longest * interval, longest_start, longest_end
    printf "Disponibilidad: %.2f%% (meta %s%%)\n", availability, target
    if (availability + 0 >= target + 0) {
      print "RESULTADO: CUMPLE"
      exit 0
    }
    print "RESULTADO: NO CUMPLE"
    exit 1
  }
' "$log_file"
