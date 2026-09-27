#!/usr/bin/env bash

set -Eeuo pipefail

info() {
  printf '[backup-cron] %s\n' "$1"
}

error() {
  printf '[backup-cron][error] %s\n' "$1" >&2
}

quote_cron_value() {
  local value="$1"
  value="${value//\'/\'\\\'\'}"
  printf "'%s'" "$value"
}

main() {
  local script_dir project_root job_script backup_dir log_file log_dir env_file schedule marker
  local cron_line existing_cron temp_cron

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  project_root="$(cd "$script_dir/../.." && pwd -P)"
  job_script="$script_dir/run_backup_job.sh"

  backup_dir="${BACKUP_DIR:-$project_root/backups/postgres}"
  log_file="${BACKUP_LOG_FILE:-$project_root/logs/backups/postgres-backup.log}"
  log_dir="$(dirname "$log_file")"
  env_file="${ENV_FILE:-}"
  schedule="${BACKUP_CRON_SCHEDULE:-0 3 * * *}"
  marker="# visaguide-postgres-backup"

  cron_line="$schedule "

  if [ -n "$env_file" ]; then
    cron_line+="ENV_FILE=$(quote_cron_value "$env_file") "
  fi

  cron_line+="BACKUP_DIR=$(quote_cron_value "$backup_dir") "
  cron_line+="RETENTION_DAYS=$(quote_cron_value "${RETENTION_DAYS:-7}") "
  cron_line+="$(quote_cron_value "$job_script") >> $(quote_cron_value "$log_file") 2>&1 $marker"

  info "Cron diario configurado para las 3:00 AM."
  info "Script: $job_script"
  info "Backups: $backup_dir"
  info "Log: $log_file"

  if [ "${DRY_RUN:-0}" = "1" ]; then
    printf '%s\n' "$cron_line"
    return 0
  fi

  if ! command -v crontab >/dev/null 2>&1; then
    error "crontab no esta instalado o no esta disponible en PATH."
    exit 1
  fi

  mkdir -p "$backup_dir" "$log_dir"

  temp_cron="$(mktemp)"
  existing_cron="$(mktemp)"
  trap 'rm -f "$temp_cron" "$existing_cron"' EXIT

  crontab -l > "$existing_cron" 2>/dev/null || true
  grep -v "$marker" "$existing_cron" > "$temp_cron" || true
  printf '%s\n' "$cron_line" >> "$temp_cron"
  crontab "$temp_cron"

  info "Cron instalado o actualizado correctamente."
}

main "$@"
