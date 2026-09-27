#!/usr/bin/env bash

set -Eeuo pipefail

info() {
  printf '[backup] %s\n' "$1"
}

error() {
  printf '[backup][error] %s\n' "$1" >&2
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
      DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME|BACKUP_DIR|BACKUP_PREFIX)
        if [ -z "${!key+x}" ]; then
          export "$key=$value"
        fi
        ;;
    esac
  done < "$env_file"
}

main() {
  local script_dir project_root timestamp temp_file backup_file

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  project_root="$(cd "$script_dir/../.." && pwd -P)"

  load_env_file

  local db_name="${DB_NAME:-visa_db}"
  local db_host="${DB_HOST:-127.0.0.1}"
  local db_port="${DB_PORT:-5433}"
  local db_user="${DB_USER:-postgres}"
  local backup_dir="${BACKUP_DIR:-$project_root/backups/postgres}"
  local backup_prefix="${BACKUP_PREFIX:-$db_name}"

  if ! command -v pg_dump >/dev/null 2>&1; then
    error "pg_dump no esta instalado o no esta disponible en PATH."
    exit 1
  fi

  mkdir -p "$backup_dir"

  timestamp="$(date +%Y%m%d_%H%M%S)"
  backup_file="$backup_dir/${backup_prefix}_${timestamp}.dump"
  temp_file="${backup_file}.incomplete"

  cleanup_temp_file() {
    if [ -f "$temp_file" ]; then
      rm -f "$temp_file"
    fi
  }

  trap cleanup_temp_file EXIT

  info "Iniciando backup de PostgreSQL para la base $db_name."
  info "Destino: $backup_file"

  if [ -n "${DB_PASSWORD:-}" ]; then
    export PGPASSWORD="$DB_PASSWORD"
  fi

  if ! pg_dump \
    --host="$db_host" \
    --port="$db_port" \
    --username="$db_user" \
    --dbname="$db_name" \
    --format=custom \
    --file="$temp_file"; then
    error "pg_dump no pudo completar el backup."
    exit 1
  fi

  if [ ! -s "$temp_file" ]; then
    error "El backup se creo vacio o no se pudo verificar."
    exit 1
  fi

  mv "$temp_file" "$backup_file"
  trap - EXIT

  info "Backup creado correctamente: $backup_file"
}

main "$@"
