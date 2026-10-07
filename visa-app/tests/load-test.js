import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  buildLoadOptions, buildLoginFailureDiagnostic, extractAuth, normalizeBaseUrl,
  parseTestProfile, parseUsers, selectUser,
} from './load-test-utils.js';

const TEST_PROFILE = parseTestProfile(__ENV.TEST_PROFILE);
const MAX_VUS = TEST_PROFILE === 'smoke' ? 1 : 200;
const BASE_URL = normalizeBaseUrl(
  __ENV.BASE_URL || 'http://localhost:8080/api',
  __ENV.ALLOW_REMOTE_LOAD_TEST === 'true'
);
const SUMMARY_PATH = __ENV.SUMMARY_PATH ||
  './tests/results/scrum-204-' + TEST_PROFILE + '-summary.json';

// Solo rutas JSON relativas al directorio desde el cual se invoca k6.
if (!/^(?:\.\/)?tests\/results\/[\w.-]+\.json$/.test(SUMMARY_PATH) ||
    SUMMARY_PATH.includes('..')) {
  throw new Error('SUMMARY_PATH debe apuntar a un JSON dentro de tests/results.');
}
if (!__ENV.USERS_FILE && (!__ENV.TEST_EMAIL || !__ENV.TEST_PASSWORD)) {
  throw new Error('Proporciona USERS_FILE o TEST_EMAIL y TEST_PASSWORD antes de iniciar la carga.');
}

const users = __ENV.USERS_FILE
  ? new SharedArray('scrum-204-users', () => parseUsers(open(__ENV.USERS_FILE)))
  : parseUsers(JSON.stringify([{ correo: __ENV.TEST_EMAIL, contrasena: __ENV.TEST_PASSWORD }]));

// Cada VU tiene su propia VM; la sesión se conserva entre sus iteraciones.
let session = null;
const expected200 = http.expectedStatuses(200);

const endpoints = ['login', 'session', 'ds160', 'documents'];
const endpointMetrics = {};
for (const name of endpoints) {
  endpointMetrics[name] = {
    duration: new Trend(name + '_duration', true),
    errors: new Rate(name + '_error_rate'),
    checks: new Rate(name + '_check_rate'),
    requests: new Counter(name + '_requests'),
  };
}

export const options = buildLoadOptions(TEST_PROFILE);

function jsonBody(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function record(name, response, valid) {
  const metric = endpointMetrics[name];
  metric.duration.add(response.timings.duration);
  metric.errors.add(!valid);
  metric.checks.add(valid);
  metric.requests.add(1);
  check(response, { [name + ' responde correctamente']: () => valid }, { endpoint: name });
  return valid;
}

function requestOptions(name, token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    tags: { endpoint: name },
    responseCallback: expected200,
  };
}

function think() {
  sleep(1 + Math.random() * 2);
}

export function setup() {
  console.log('Perfil de la prueba: ' + TEST_PROFILE);
  console.log('Destino de la prueba: ' + BASE_URL);
  console.log('Cuentas disponibles: ' + users.length +
    '; VUs que reutilizarán cuenta: ' + Math.max(0, MAX_VUS - users.length) + '.');
}

export default function () {
  if (!session) {
    const user = selectUser(users, exec.vu.idInTest);
    const login = http.post(
      BASE_URL + '/login',
      JSON.stringify({ correo: user.correo, contrasena: user.contrasena }),
      requestOptions('login')
    );
    let auth = null;
    if (login.status === 200) {
      try {
        auth = extractAuth(jsonBody(login));
      } catch (_error) {
        // No imprimir cuerpos de respuesta ni secretos.
      }
    }
    if (!record('login', login, Boolean(auth))) {
      console.error('Login fallido: ' + JSON.stringify(buildLoginFailureDiagnostic(
        BASE_URL + '/login',
        login,
        [user.correo, user.contrasena]
      )));
      exec.test.abort('El login de un VU falló; la carga autenticada no sería válida.');
      return;
    }
    session = auth;
  }

  const validated = http.get(BASE_URL + '/validar-sesion', requestOptions('session', session.token));
  const validatedBody = validated.status === 200 ? jsonBody(validated) : null;
  const validSession = validated.status === 200 && validatedBody?.valid === true &&
    Number(validatedBody?.user?.id_usuario) === session.id;
  record('session', validated, validSession);
  if (validated.status === 401 || validated.status === 403) {
    exec.test.abort('La sesión autenticada fue rechazada; se interrumpe la prueba.');
    return;
  }
  think();

  const ds160 = http.post(BASE_URL + '/ds160/load', '{}', requestOptions('ds160', session.token));
  const ds160Body = ds160.status === 200 ? jsonBody(ds160) : null;
  record('ds160', ds160, ds160.status === 200 && ds160Body !== null &&
    Object.prototype.hasOwnProperty.call(ds160Body, 'datos'));
  if (ds160.status === 401 || ds160.status === 403) {
    exec.test.abort('El acceso autenticado al DS-160 fue rechazado; se interrumpe la prueba.');
    return;
  }
  think();

  const documents = http.post(
    BASE_URL + '/documentos/listar',
    JSON.stringify({ usuario_id: session.id }),
    requestOptions('documents', session.token)
  );
  const documentsBody = documents.status === 200 ? jsonBody(documents) : null;
  record('documents', documents, documents.status === 200 && Array.isArray(documentsBody));
  if (documents.status === 401 || documents.status === 403) {
    exec.test.abort('El acceso autenticado a documentos fue rechazado; se interrumpe la prueba.');
    return;
  }
  think();
}

export function handleSummary(data) {
  const names = [
    'http_req_duration', 'http_req_failed', 'http_reqs', 'iterations', 'vus', 'vus_max', 'checks',
    ...endpoints.flatMap((name) => [
      name + '_duration', name + '_error_rate', name + '_check_rate', name + '_requests',
    ]),
  ];
  const metrics = {};
  for (const name of names) {
    if (data.metrics && data.metrics[name]) metrics[name] = data.metrics[name];
  }
  const summary = {
    task: 'SCRUM-204',
    profile: TEST_PROFILE,
    generatedAt: new Date().toISOString(),
    destination: BASE_URL,
    configuredVUs: MAX_VUS,
    configuredHold: TEST_PROFILE === 'smoke' ? '30s' : '5m',
    observedMaxVUs: data.metrics?.vus?.values?.max ?? null,
    accountsAvailable: users.length,
    accountsReused: users.length < MAX_VUS,
    vusReusingAccounts: Math.max(0, MAX_VUS - users.length),
    criteria: {
      failedRequestRate: TEST_PROFILE === 'smoke' ? '0%' : '<5%',
      globalP95: '<2000ms',
      successfulChecks: TEST_PROFILE === 'smoke' ? '100%' : '>95%',
      criticalAvailability: 'evaluación manual',
    },
    metrics,
  };
  return { [SUMMARY_PATH]: JSON.stringify(summary, null, 2) };
}
