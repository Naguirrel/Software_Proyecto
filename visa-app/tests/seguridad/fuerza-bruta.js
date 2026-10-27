// Prueba de seguridad (RNF-13): ataque de fuerza bruta concurrente contra una sola cuenta.
// Solo contra la app local; la cuenta objetivo debe ser de prueba.
// Uso (desde visa-app/):
//   k6 run -e TARGET_EMAIL=... -e TARGET_PASSWORD=... tests/seguridad/fuerza-bruta.js
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { normalizeBaseUrl } from '../load-test-utils.js';

const BASE_URL = normalizeBaseUrl(__ENV.BASE_URL || 'http://localhost:8080/api', false);
const TARGET_EMAIL = __ENV.TARGET_EMAIL;
const TARGET_PASSWORD = __ENV.TARGET_PASSWORD;
if (!TARGET_EMAIL || !TARGET_PASSWORD) {
  throw new Error('Define TARGET_EMAIL y TARGET_PASSWORD de una cuenta de prueba local.');
}

const ATTACKERS = Number(__ENV.ATTACKERS || 20);
const ATTEMPTS_PER_ATTACKER = Number(__ENV.ATTEMPTS || 10);

const passwordRejected = new Counter('intentos_rechazados_401');
const accountLocked = new Counter('respuestas_bloqueo_423');
// El rate limiting de /login (SP10-04) corta el ataque antes del bloqueo de cuenta.
const rateLimited = new Counter('respuestas_rate_limit_429');
const unexpected = new Counter('respuestas_inesperadas');
const breached = new Counter('accesos_exitosos');

export const options = {
  scenarios: {
    fuerza_bruta: {
      executor: 'per-vu-iterations',
      vus: ATTACKERS,
      iterations: ATTEMPTS_PER_ATTACKER,
      maxDuration: '2m',
    },
  },
  thresholds: {
    accesos_exitosos: ['count==0'],
    respuestas_inesperadas: ['count==0'],
  },
};

const json = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  const guess = 'clave-adivinada-' + __VU + '-' + __ITER;
  const res = http.post(BASE_URL + '/login', JSON.stringify({ correo: TARGET_EMAIL, contrasena: guess }), json);
  if (res.status === 401) passwordRejected.add(1);
  else if (res.status === 423) accountLocked.add(1);
  else if (res.status === 429) rateLimited.add(1);
  else if (res.status === 200) breached.add(1);
  else unexpected.add(1);
  check(res, { 'nunca concede acceso con una contraseña adivinada': (r) => r.status !== 200 });
}

// Al final, la contraseña correcta también debe ser rechazada mientras dure el bloqueo
// (423) o mientras el rate limiting siga activo para esta IP (429).
export function teardown() {
  const res = http.post(BASE_URL + '/login', JSON.stringify({ correo: TARGET_EMAIL, contrasena: TARGET_PASSWORD }), json);
  check(res, { 'la contraseña correcta queda rechazada (423 o 429)': (r) => r.status === 423 || r.status === 429 });
  console.log('Login con la contraseña correcta tras el ataque: HTTP ' + res.status);
}

export function handleSummary(data) {
  const value = (name) => data.metrics[name]?.values?.count ?? 0;
  const resumen = {
    prueba: 'fuerza-bruta-rnf13',
    atacantes: ATTACKERS,
    intentosTotales: ATTACKERS * ATTEMPTS_PER_ATTACKER,
    rechazados401: value('intentos_rechazados_401'),
    bloqueados423: value('respuestas_bloqueo_423'),
    limitados429: value('respuestas_rate_limit_429'),
    accesosExitosos: value('accesos_exitosos'),
    inesperadas: value('respuestas_inesperadas'),
    checks: data.metrics.checks?.values ?? null,
    p95ms: data.metrics.http_req_duration?.values?.['p(95)'] ?? null,
  };
  return {
    stdout: JSON.stringify(resumen, null, 2) + '\n',
    'tests/results/sp9-fuerza-bruta-summary.json': JSON.stringify(resumen, null, 2),
  };
}
