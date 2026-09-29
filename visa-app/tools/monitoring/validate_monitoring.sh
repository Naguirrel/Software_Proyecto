#!/usr/bin/env bash
# Pruebas locales con servidor HTTP y metricas simuladas; no generan carga real.
set -euo pipefail

for command_name in bash node curl mktemp grep cp cat kill sed wc dirname mkdir rm rmdir chmod env; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'Falta la herramienta de validacion: %s\n' "$command_name" >&2
    exit 2
  }
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
temp_dir="$(mktemp -d)"
mkdir "$temp_dir/mock"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f -- "$temp_dir/mock/"*
  for file in "$temp_dir/"*; do
    if [[ -f "$file" ]]; then
      rm -f -- "$file"
    fi
  done
  rmdir -- "$temp_dir/mock" "$temp_dir"
}
trap cleanup EXIT

bash -n "$script_dir/monitor_server.sh" "$script_dir/run_monitoring_job.sh" \
  "$script_dir/install_monitoring_cron.sh" "$script_dir/validate_monitoring.sh"
printf 'OK: sintaxis Bash\n'

cat > "$temp_dir/mock/sleep" <<'EOF'
#!/usr/bin/env bash
cp "$TEST_CPU_AFTER" "$MONITOR_PROC_STAT_FILE"
EOF
cat > "$temp_dir/mock/free" <<'EOF'
#!/usr/bin/env bash
cat "$TEST_MEMORY_FILE"
EOF
cat > "$temp_dir/mock/df" <<'EOF'
#!/usr/bin/env bash
cat "$TEST_DISK_FILE"
EOF
cat > "$temp_dir/mock/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$temp_dir/mock/mail" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" > "$TEST_MAIL_FILE"
cat >> "$TEST_MAIL_FILE"
EOF
cat > "$temp_dir/mock/crontab" <<'EOF'
#!/usr/bin/env bash
printf 'crontab fue invocado\n' > "$TEST_CRONTAB_MARKER"
exit 1
EOF
chmod +x "$temp_dir/mock/"*

printf 'cpu 100 0 0 900 0 0 0 0 0 0\n' > "$temp_dir/cpu"
printf 'cpu 120 0 0 980 0 0 0 0 0 0\n' > "$temp_dir/cpu-after"
printf '              total        used        free      shared  buff/cache   available\nMem:            100          30          70           0           0          70\n' > "$temp_dir/memory"
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/mock 100 20 80 20%% /\n' > "$temp_dir/disk"

export MONITOR_PROC_STAT_FILE="$temp_dir/cpu"
export TEST_CPU_AFTER="$temp_dir/cpu-after"
export TEST_MEMORY_FILE="$temp_dir/memory"
export TEST_DISK_FILE="$temp_dir/disk"
export TEST_MAIL_FILE="$temp_dir/mail-sent"
export TEST_CRONTAB_MARKER="$temp_dir/crontab-called"
test_path="$temp_dir/mock:$PATH"

# El servidor elige un puerto libre y escribe el numero cuando ya escucha.
TEST_PORT_FILE="$temp_dir/port" node -e '
const http = require("http");
const fs = require("fs");
const server = http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("OK");
});
server.listen(0, "127.0.0.1", () => fs.writeFileSync(process.env.TEST_PORT_FILE, String(server.address().port)));
' &
server_pid=$!
for _ in {1..50}; do
  [[ -s "$temp_dir/port" ]] && break
  sleep 0.1
done
[[ -s "$temp_dir/port" ]] || { printf 'No arranco el servidor HTTP local.\n' >&2; exit 1; }

active_url="http://127.0.0.1:$(cat "$temp_dir/port")/"
run_monitor() {
  local expected="$1" pattern="$2" result
  shift 2
  printf 'cpu 100 0 0 900 0 0 0 0 0 0\n' > "$temp_dir/cpu"
  if result="$(env PATH="$test_path" "$@" bash "$script_dir/monitor_server.sh")"; then
    code=0
  else
    code=$?
  fi
  if [[ "$code" -ne "$expected" ]] || ! grep -q "$pattern" <<< "$result"; then
    printf 'Fallo: se esperaba salida %s y codigo %s; se obtuvo %s:\n%s\n' "$pattern" "$expected" "$code" "$result" >&2
    exit 1
  fi
}

run_monitor 0 'OK: aplicacion HTTP=200' MONITOR_URL="$active_url" MONITOR_THRESHOLD=80
printf 'OK: URL activa\n'
run_monitor 2 'CRITICAL: aplicacion sin respuesta' MONITOR_URL=http://127.0.0.1:1/ MONITOR_THRESHOLD=80
printf 'OK: URL caida\n'
run_monitor 1 'WARNING: memoria=' MONITOR_URL="$active_url" MONITOR_THRESHOLD=25
printf 'OK: umbral configurable\n'

printf 'cpu 195 0 0 905 0 0 0 0 0 0\n' > "$temp_dir/cpu-after"
run_monitor 1 'WARNING: CPU=95.0%' MONITOR_URL="$active_url" MONITOR_THRESHOLD=80
printf 'OK: alerta CPU\n'
printf 'cpu 120 0 0 980 0 0 0 0 0 0\n' > "$temp_dir/cpu-after"
printf '              total        used        free      shared  buff/cache   available\nMem:            100          90          10           0           0          10\n' > "$temp_dir/memory"
run_monitor 1 'WARNING: memoria=90.0%' MONITOR_URL="$active_url" MONITOR_THRESHOLD=80
printf 'OK: alerta memoria\n'
printf '              total        used        free      shared  buff/cache   available\nMem:            100          30          70           0           0          70\n' > "$temp_dir/memory"
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/mock 100 90 10 90%% /\n' > "$temp_dir/disk"
run_monitor 1 'WARNING: disco=90%' MONITOR_URL="$active_url" MONITOR_THRESHOLD=80
printf 'OK: alerta disco\n'
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/mock 100 20 80 20%% /\n' > "$temp_dir/disk"

cat > "$temp_dir/config" <<EOF
MONITOR_URL=$active_url
MONITOR_THRESHOLD=80
MONITOR_LOG_FILE=$temp_dir/monitor.log
MONITOR_MAX_LOG_LINES=100
ALERT_EMAIL=alerts@example.invalid
EOF
printf 'cpu 100 0 0 900 0 0 0 0 0 0\n' > "$temp_dir/cpu"
env PATH="$test_path" MONITOR_ENV_FILE="$temp_dir/config" bash "$script_dir/run_monitoring_job.sh"
grep -q 'OK: aplicacion HTTP=200' "$temp_dir/monitor.log"
grep -q 'Revision del servidor' "$temp_dir/monitor.log"
[[ ! -f "$temp_dir/mail-sent" ]]
printf 'OK: log generado con fecha y resultado\n'

for _ in {1..150}; do printf 'linea anterior\n'; done >> "$temp_dir/monitor.log"
printf 'cpu 100 0 0 900 0 0 0 0 0 0\n' > "$temp_dir/cpu"
env PATH="$test_path" MONITOR_ENV_FILE="$temp_dir/config" bash "$script_dir/run_monitoring_job.sh"
[[ "$(wc -l < "$temp_dir/monitor.log")" -le 100 ]]
printf 'OK: log limitado a 100 lineas\n'

sed -i 's|MONITOR_URL=.*|MONITOR_URL=http://127.0.0.1:1/|' "$temp_dir/config"
printf 'cpu 100 0 0 900 0 0 0 0 0 0\n' > "$temp_dir/cpu"
if env PATH="$test_path" MONITOR_ENV_FILE="$temp_dir/config" bash "$script_dir/run_monitoring_job.sh"; then
  printf 'El trabajo debio devolver error para URL caida.\n' >&2
  exit 1
fi
grep -q 'CRITICAL: aplicacion sin respuesta' "$temp_dir/mail-sent"
printf 'OK: alerta por correo simulado\n'

env PATH="$test_path" DRY_RUN=1 MONITOR_ENV_FILE="$temp_dir/config" \
  bash "$script_dir/install_monitoring_cron.sh" > "$temp_dir/dry-run"
grep -q '^\*/5 \* \* \* \*' "$temp_dir/dry-run"
[[ ! -e "$temp_dir/crontab-called" ]]
printf 'OK: DRY_RUN no modifico el crontab\n'
