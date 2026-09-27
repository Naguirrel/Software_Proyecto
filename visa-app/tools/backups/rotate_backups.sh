#!/usr/bin/env bash

set -Eeuo pipefail

info() {
  printf '[backup-rotation] %s\n' "$1"
}

error() {
  printf '[backup-rotation][error] %s\n' "$1" >&2
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
      BACKUP_DIR|BACKUP_PREFIX|RETENTION_DAYS|DB_NAME)
        if [ -z "${!key+x}" ]; then
          export "$key=$value"
        fi
        ;;
    esac
  done < "$env_file"
}

main() {
  local script_dir project_root backup_dir backup_prefix retention_days backup_dir_real
  local deleted_count=0

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  project_root="$(cd "$script_dir/../.." && pwd -P)"

  load_env_file

  backup_dir="${BACKUP_DIR:-$project_root/backups/postgres}"
  backup_prefix="${BACKUP_PREFIX:-${DB_NAME:-visa_db}}"
  retention_days="${RETENTION_DAYS:-7}"

  if [[ ! "$retention_days" =~ ^[0-9]+$ ]]; then
    error "RETENTION_DAYS debe ser un numero entero no negativo."
    exit 1
  fi

  mkdir -p "$backup_dir"
  backup_dir_real="$(cd "$backup_dir" && pwd -P)"

  if [ -z "$backup_dir_real" ] || [ "$backup_dir_real" = "/" ]; then
    error "La carpeta de backups no es segura para rotacion: $backup_dir_real"
    exit 1
  fi

  info "Conservando backups recientes en: $backup_dir_real"
  info "Eliminando archivos ${backup_prefix}_*.dump con mas de $retention_days dias."

  while IFS= read -r -d '' file; do
    rm -f -- "$file"
    deleted_count=$((deleted_count + 1))
  done < <(find "$backup_dir_real" -maxdepth 1 -type f -name "${backup_prefix}_*.dump" -mtime +"$retention_days" -print0)

  info "Backups antiguos eliminados: $deleted_count"
}

main "$@"
