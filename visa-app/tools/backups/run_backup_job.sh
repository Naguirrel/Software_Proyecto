#!/usr/bin/env bash

set -Eeuo pipefail

info() {
  printf '[backup-job] %s\n' "$1"
}

main() {
  local script_dir

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

  info "Ejecutando backup diario de PostgreSQL."
  "$script_dir/backup_postgres.sh"

  info "Aplicando politica de retencion de backups."
  "$script_dir/rotate_backups.sh"

  info "Proceso de backup diario finalizado correctamente."
}

main "$@"
