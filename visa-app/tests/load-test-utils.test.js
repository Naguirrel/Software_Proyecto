import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLoadOptions, buildLoginFailureDiagnostic, extractAuth, normalizeBaseUrl,
  parseTestProfile, parseUsers, selectUser,
} from './load-test-utils.js';

test('rechaza un perfil ausente antes de configurar la carga', () => {
  assert.throws(() => parseTestProfile(undefined), /TEST_PROFILE es obligatorio/);
  assert.throws(() => buildLoadOptions(undefined), /TEST_PROFILE es obligatorio/);
});

test('rechaza perfiles distintos de smoke y full', () => {
  for (const invalid of ['', 'SMOKE', 'full ', '200']) {
    assert.throws(() => parseTestProfile(invalid), /smoke o full/);
  }
});

test('configura smoke con un VU durante aproximadamente 30 segundos', () => {
  const options = buildLoadOptions('smoke');
  assert.deepEqual(options.scenarios.authenticated_users, {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    gracefulStop: '10s',
  });
  assert.deepEqual(options.thresholds, {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate==1'],
  });
});

test('conserva las siete etapas y los thresholds aprobados de full', () => {
  const options = buildLoadOptions('full');
  assert.equal(options.scenarios.authenticated_users.executor, 'ramping-vus');
  assert.equal(options.scenarios.authenticated_users.startVUs, 0);
  assert.deepEqual(options.scenarios.authenticated_users.stages, [
    { duration: '1m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 150 },
    { duration: '1m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ]);
  assert.deepEqual(options.thresholds, {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  });
});

test('normaliza el destino local y bloquea remotos por defecto', () => {
  assert.equal(normalizeBaseUrl('http://localhost:8080/api/'), 'http://localhost:8080/api');
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3000/api'), 'http://127.0.0.1:3000/api');
  assert.throws(() => normalizeBaseUrl('https://example.invalid/api'), /Carga remota bloqueada/);
  assert.throws(() => normalizeBaseUrl('http://localhost.evil.invalid/api'), /Carga remota bloqueada/);
  assert.throws(() => normalizeBaseUrl('http://localhost@evil.invalid/api'), /BASE_URL/);
  assert.throws(() => normalizeBaseUrl('http://localhost:99999/api'), /puerto inválido/);
  assert.throws(() => normalizeBaseUrl('http://localhost:8080/api?token=x'), /BASE_URL/);
  assert.equal(
    normalizeBaseUrl('https://example.invalid/api', true),
    'https://example.invalid/api'
  );
  assert.throws(() => normalizeBaseUrl('http://example.invalid/api', true), /HTTPS/);
});

test('valida las cuentas sin reflejar credenciales en errores', () => {
  const users = parseUsers('[{"correo":" a@example.invalid ","contrasena":"clave"}]');
  assert.deepEqual(users, [{ correo: 'a@example.invalid', contrasena: 'clave' }]);
  assert.throws(() => parseUsers('no es JSON'), /arreglo JSON válido/);
  assert.throws(() => parseUsers('[]'), /al menos una cuenta/);
  assert.throws(() => parseUsers('[{"correo":"a@example.invalid"}]'), /requiere correo y contrasena/);
  assert.throws(() => parseUsers('[{"correo":"no-es-correo","contrasena":"x"}]'), /requiere correo y contrasena/);
  assert.throws(
    () => parseUsers('[{"correo":"a@example.invalid","contrasena":"a"},{"correo":"A@example.invalid","contrasena":"b"}]'),
    /correo duplicado/
  );
});

test('asigna cuentas determinísticamente y reutiliza al superar su cantidad', () => {
  const users = [
    { correo: 'uno@example.invalid', contrasena: 'a' },
    { correo: 'dos@example.invalid', contrasena: 'b' },
  ];
  assert.equal(selectUser(users, 1), users[0]);
  assert.equal(selectUser(users, 2), users[1]);
  assert.equal(selectUser(users, 3), users[0]);
  assert.equal(selectUser(users, 200), users[1]);
  assert.throws(() => selectUser(users, 0), /No es posible/);
});

test('usa token e ID del contrato real de login', () => {
  assert.deepEqual(
    extractAuth({ token: 'token-de-prueba', usuario: { id_usuario: 42 } }),
    { token: 'token-de-prueba', id: 42 }
  );
  assert.throws(() => extractAuth({ token: 'token-de-prueba', usuario: {} }), /login no devolvió/);
});

test('diagnostica solo URL, estado, tipo y error JSON del login', () => {
  const diagnostic = buildLoginFailureDiagnostic(
    'http://localhost:8080/api/login',
    {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': 'secreto' },
      body: 'cuerpo completo confidencial',
      json: () => ({ error: 'El correo o la contraseña son incorrectos', token: 'secreto' }),
    }
  );
  assert.deepEqual(diagnostic, {
    url: 'http://localhost:8080/api/login',
    status: 401,
    contentType: 'application/json; charset=utf-8',
    serverError: 'El correo o la contraseña son incorrectos',
  });
  assert.ok(!JSON.stringify(diagnostic).includes('cuerpo completo'));
  assert.ok(!JSON.stringify(diagnostic).includes('Set-Cookie'));
});

test('redacta valores sensibles y no imprime cuerpos no JSON', () => {
  const diagnostic = buildLoginFailureDiagnostic(
    'http://localhost:8080/api/login',
    {
      status: 500,
      headers: { 'content-type': 'application/problem+json' },
      json: () => ({
        error: 'correo persona@example.invalid clave-secreta token=abc123 cookie=sesion123',
      }),
    },
    ['persona@example.invalid', 'clave-secreta']
  );
  const output = JSON.stringify(diagnostic);
  assert.ok(!output.includes('persona@example.invalid'));
  assert.ok(!output.includes('clave-secreta'));
  assert.ok(!output.includes('abc123'));
  assert.ok(!output.includes('sesion123'));

  const html = buildLoginFailureDiagnostic(
    'http://localhost:8080/api/login',
    { status: 502, headers: { 'Content-Type': 'text/html' }, json: () => { throw new Error('no leer'); } }
  );
  assert.equal(html.serverError, null);
});
