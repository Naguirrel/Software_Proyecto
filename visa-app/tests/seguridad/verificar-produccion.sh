#!/usr/bin/env bash
# SP10-21: verificación no intrusiva de los hallazgos S-01..S-10 en producción.
# Solo peticiones sin sesión; no crea cuentas ni datos.
set -u
SITE="https://visa-app.duckdns.org"
API="$SITE/api"
C=(curl -s --ssl-no-revoke --max-time 20)

check() { # nombre esperado obtenido
  local estado="FALLA"; [[ "$3" == $2 ]] && estado="OK"
  printf '%-5s %-62s esperado %-7s obtenido %s\n' "$estado" "$1" "$2" "$3"
}
code() { "${C[@]}" -o /dev/null -w '%{http_code}' "$@"; }

echo "== S-01 IDOR: perfil y tramite sin token (antes: 200)"
body='{"correo":"victima@example.invalid"}'
for r in "POST /usuario-perfil" "PUT /usuario-perfil" "POST /estado-tramite" "PUT /tramite" "POST /guardar-perfil"; do
  set -- $r
  check "$1 $2 sin token" "401" "$(code -X "$1" -H 'Content-Type: application/json' -d "$body" "$API$2")"
done
check "GET /documentos/1 sin token" "401" "$(code "$API/documentos/1")"
check "GET /interview-sessions/1 sin token" "401" "$(code "$API/interview-sessions/1")"
check "GET /validar-sesion con token falsificado" "401" "$(code -H 'Authorization: Bearer eyJzdWIiOjF9.firma-falsa' "$API/validar-sesion")"

echo "== S-02 y S-10: entradas malformadas (antes: 500 con detalles de PostgreSQL)"
for r in "/forgot-password|{\"correo\":123}" "/reenviar-verificacion|{\"correo\":[\"x\"]}" "/login|{\"correo\":{\"a\":1},\"contrasena\":5}"; do
  path="${r%%|*}"; data="${r#*|}"
  out="$("${C[@]}" -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d "$data" "$API$path")"
  status="${out##*$'\n'}"; resp="${out%$'\n'*}"
  check "POST $path con tipos invalidos" "4[0-9][0-9]" "$status"
  if grep -qiE 'syntax|postgres|character varying|stack|at .*\.js' <<< "$resp"; then echo "      FALLA: la respuesta filtra detalles internos: $resp"; else echo "      cuerpo: $resp"; fi
done
out="$("${C[@]}" -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"correo": "x",' "$API/login")"
check "POST /login con JSON roto" "400" "${out##*$'\n'}"
echo "      cuerpo: ${out%$'\n'*}"

echo "== S-03, S-04, S-07, S-08, S-09: cabeceras"
for url in "$SITE/" "$API/"; do
  echo "-- $url"
  "${C[@]}" -I "$url" | tr -d '\r' | grep -iE '^(HTTP|server|x-powered-by|strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin-[a-z-]+):' | sed 's/^/      /'
done
check "HTTP redirige a HTTPS" "301" "$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' http://visa-app.duckdns.org/)"

echo "== Rate limiting de /login (antes: no existia). Correo inexistente: no bloquea ninguna cuenta"
codes=""
for i in $(seq 1 11); do
  codes="$codes $(code -X POST -H 'Content-Type: application/json' -d '{"correo":"sp10-21-limite@example.invalid","contrasena":"NoExiste123"}' "$API/login")"
done
echo "      respuestas:$codes"
check "intento 11 rechazado por el limite" "429" "${codes##* }"
