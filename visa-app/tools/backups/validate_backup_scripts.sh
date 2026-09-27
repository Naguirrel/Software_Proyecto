#!/usr/bin/env bash

set -Eeuo pipefail

info() {
  printf '[backup-validation] %s\n' "$1"
}

fail() {
  printf '[backup-validation][error] %s\n' "$1" >&2
  exit 1
}

assert_file_exists() {
  local path="$1"
  local message="$2"

  if [ ! -f "$path" ]; then
    fail "$message"
  fi
}

assert_file_absent() {
  local path="$1"
  local message="$2"

  if [ -e "$path" ]; then
    fail "$message"
  fi
}

main() {
  local script_dir work_dir fake_bin backup_dir old_backup recent_backup backup_count

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  work_dir="$(mktemp -d)"
  fake_bin="$work_dir/bin"
  backup_dir="$work_dir/backups"

  trap "rm -rf '$work_dir'" EXIT

  mkdir -p "$fake_bin"

  cat > "$fake_bin/pg_dump" <<'FAKE_PG_DUMP'
#!/usr/bin/env bash
set -Eeuo pipefail

output_file=""

for arg in "$@"; do
  case "$arg" in
    --file=*)
      output_file="${arg#--file=}"
      ;;
  esac
done

if [ -z "$output_file" ]; then
  exit 2
fi

printf 'fake custom-format backup for validation\n' > "$output_file"
FAKE_PG_DUMP

  chmod +x "$fake_bin/pg_dump"

  info "Validando creacion de carpeta y archivo de backup."
  PATH="$fake_bin:$PATH" \
    BACKUP_DIR="$backup_dir" \
    DB_HOST=127.0.0.1 \
    DB_PORT=5433 \
    DB_USER=postgres \
    DB_NAME=visa_db \
    "$script_dir/backup_postgres.sh" >/dev/null

  if [ ! -d "$backup_dir" ]; then
    fail "La carpeta de backups no fue creada."
  fi

  backup_count="$(find "$backup_dir" -maxdepth 1 -type f -name 'visa_db_*.dump' | wc -l | tr -d ' ')"

  if [ "$backup_count" != "1" ]; then
    fail "Se esperaba exactamente un backup creado; encontrados: $backup_count"
  fi

  info "Validando politica de retencion de 7 dias."
  old_backup="$backup_dir/visa_db_20000101_000000.dump"
  recent_backup="$backup_dir/visa_db_recent.dump"

  printf 'old backup\n' > "$old_backup"
  printf 'recent backup\n' > "$recent_backup"
  touch -d '9 days ago' "$old_backup"
  touch -d '1 day ago' "$recent_backup"

  BACKUP_DIR="$backup_dir" RETENTION_DAYS=7 DB_NAME=visa_db "$script_dir/rotate_backups.sh" >/dev/null

  assert_file_absent "$old_backup" "La rotacion no elimino el backup antiguo."
  assert_file_exists "$recent_backup" "La rotacion elimino indebidamente un backup reciente."

  backup_count="$(find "$backup_dir" -maxdepth 1 -type f -name 'visa_db_*.dump' | wc -l | tr -d ' ')"

  if [ "$backup_count" != "2" ]; then
    fail "La retencion dejo una cantidad inesperada de backups: $backup_count"
  fi

  info "Validacion completada correctamente."
}

main "$@"
