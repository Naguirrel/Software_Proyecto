#!/usr/bin/env bash
# Prueba de restauracion (RNF-23): restaura un backup .dump en una base temporal,
# compara tablas y filas con la base de origen y elimina la base temporal.
# Nunca restaura sobre la base de origen.

set -Eeuo pipefail

info() {
  printf '[restore-check] %s\n' "$1"
}

error() {
  printf '[restore-check][error] %s\n' "$1" >&2
}

load_env_file() {
  local env_file="${ENV_FILE:-}"

  if [ -z "$env_file" ]; then
    return 0
  fi

  if [ ! -f "$env_file" ]; then
    error "No existe el archivo de variables: $env_file"
    exit 1
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"

    case "$line" in
      ''|\#*)
        continue
        ;;
    esac

    if [[ "$line" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    case "$key" in
      DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME|BACKUP_DIR|BACKUP_PREFIX|BACKUP_FILE|RESTORE_DB_NAME)
        if [ -z "${!key+x}" ]; then
          export "$key=$value"
        fi
        ;;
    esac
  done < "$env_file"
}

# Imprime "tabla filas" por cada tabla del esquema public, ordenadas.
table_counts() {
  local database="$1"
  local tables table

  tables="$(psql "${psql_args[@]}" --dbname="$database" --tuples-only --no-align --command \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")"

  for table in $tables; do
    printf '%s %s\n' "$table" "$(psql "${psql_args[@]}" --dbname="$database" --tuples-only --no-align \
      --command "SELECT COUNT(*) FROM public.\"$table\"")"
  done
}

main() {
  local script_dir project_root

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  project_root="$(cd "$script_dir/../.." && pwd -P)"

  load_env_file

  local db_name="${DB_NAME:-visa_db}"
  local db_host="${DB_HOST:-127.0.0.1}"
  local db_port="${DB_PORT:-5433}"
  local db_user="${DB_USER:-postgres}"
  local backup_dir="${BACKUP_DIR:-$project_root/backups/postgres}"
  local backup_prefix="${BACKUP_PREFIX:-$db_name}"
  local restore_db="${RESTORE_DB_NAME:-${db_name}_restore_check}"
  local backup_file="${BACKUP_FILE:-}"

  for command_name in pg_restore psql createdb dropdb date stat; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      error "$command_name no esta instalado o no esta disponible en PATH."
      exit 1
    fi
  done

  if [ "$restore_db" = "$db_name" ]; then
    error "RESTORE_DB_NAME no puede ser la base de origen ($db_name)."
    exit 1
  fi

  if [[ ! "$restore_db" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    error "RESTORE_DB_NAME solo admite letras, numeros y guion bajo."
    exit 1
  fi

  if [ -z "$backup_file" ]; then
    backup_file="$(find "$backup_dir" -maxdepth 1 -type f -name "${backup_prefix}_*.dump" 2>/dev/null | sort | tail -n 1)"
  fi

  if [ -z "$backup_file" ] || [ ! -s "$backup_file" ]; then
    error "No se encontro un backup .dump para restaurar (BACKUP_FILE o $backup_dir)."
    exit 1
  fi

  if [ -n "${DB_PASSWORD:-}" ]; then
    export PGPASSWORD="$DB_PASSWORD"
  fi

  psql_args=(--host="$db_host" --port="$db_port" --username="$db_user" --set=ON_ERROR_STOP=1 --quiet)
  local conn_args=(--host="$db_host" --port="$db_port" --username="$db_user")

  local backup_epoch now_epoch
  backup_epoch="$(stat -c %Y "$backup_file")"
  now_epoch="$(date +%s)"

  info "Backup: $backup_file"
  info "Tamano: $(stat -c %s "$backup_file") bytes; antiguedad: $(( (now_epoch - backup_epoch) / 3600 )) h"

  if ! pg_restore --list "$backup_file" >/dev/null; then
    error "El archivo no es un backup valido de pg_restore."
    exit 1
  fi
  info "Archivo valido: pg_restore puede leer su indice."

  cleanup_restore_db() {
    if [ "${KEEP_RESTORE_DB:-0}" != "1" ]; then
      dropdb "${conn_args[@]}" --if-exists "$restore_db" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup_restore_db EXIT

  dropdb "${conn_args[@]}" --if-exists "$restore_db"
  createdb "${conn_args[@]}" "$restore_db"
  info "Base temporal creada: $restore_db"

  local start_epoch end_epoch
  start_epoch="$(date +%s)"
  if ! pg_restore "${conn_args[@]}" --dbname="$restore_db" --no-owner --no-privileges --exit-on-error "$backup_file"; then
    error "pg_restore fallo al restaurar en $restore_db."
    exit 1
  fi
  end_epoch="$(date +%s)"
  info "Restauracion completada en $(( end_epoch - start_epoch )) s."

  local source_counts restored_counts
  source_counts="$(table_counts "$db_name")"
  restored_counts="$(table_counts "$restore_db")"

  local source_tables restored_tables
  source_tables="$(printf '%s\n' "$source_counts" | awk 'NF { print $1 }')"
  restored_tables="$(printf '%s\n' "$restored_counts" | awk 'NF { print $1 }')"

  if [ -z "$restored_tables" ]; then
    error "La base restaurada no tiene tablas."
    exit 1
  fi

  printf '\n%-32s %12s %12s\n' "TABLA" "ORIGEN" "RESTAURADA"
  local differences=0 missing=0 table source_rows restored_rows
  for table in $(printf '%s\n%s\n' "$source_tables" "$restored_tables" | sort -u); do
    source_rows="$(printf '%s\n' "$source_counts" | awk -v t="$table" '$1 == t { print $2 }')"
    restored_rows="$(printf '%s\n' "$restored_counts" | awk -v t="$table" '$1 == t { print $2 }')"
    printf '%-32s %12s %12s\n' "$table" "${source_rows:--}" "${restored_rows:--}"
    if [ -z "$restored_rows" ]; then
      missing=$((missing + 1))
    elif [ "$source_rows" != "$restored_rows" ]; then
      differences=$((differences + 1))
    fi
  done
  printf '\n'

  info "Tablas en origen: $(printf '%s\n' "$source_tables" | grep -c .); restauradas: $(printf '%s\n' "$restored_tables" | grep -c .)"

  if [ "$missing" -gt 0 ]; then
    error "$missing tabla(s) de la base de origen no existen en la restauracion."
    exit 1
  fi

  if [ "$differences" -gt 0 ]; then
    info "AVISO: $differences tabla(s) con distinta cantidad de filas; es esperable si la base cambio despues del backup."
  fi

  info "RESULTADO: OK. El backup se restauro y contiene todas las tablas de la base de origen."
}

main "$@"
