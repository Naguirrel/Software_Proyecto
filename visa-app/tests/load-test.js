import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuración de las pruebas
export const options = {
  stages: [
    // Prueba de carga gradual
    { duration: '30s', target: 10 },  // Subir a 10 usuarios en 30s
    { duration: '1m', target: 10 },   // Mantener 10 usuarios por 1 min
    { duration: '30s', target: 25 },  // Subir a 25 usuarios
    { duration: '1m', target: 25 },   // Mantener 25 usuarios por 1 min
    { duration: '30s', target: 0 },   // Bajar a 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% de requests < 500ms
    http_req_failed: ['rate<0.1'],    // Menos de 10% de errores
  },
};

const BASE_URL = 'http://localhost:8080/api';

// Datos de prueba
const testUser = {
  correo: 'quan@prueba.cliente',
  password: '123456',
};

export default function () {
  // 1. Probar endpoint de login
  const loginRes = http.post(
    `${BASE_URL}/login`,
    JSON.stringify(testUser),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // 2. Probar validar sesión
  const sessionRes = http.get(`${BASE_URL}/validar-sesion`);
  
  check(sessionRes, {
    'session check status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);

  // 3. Probar carga de DS-160
  const ds160Res = http.post(
    `${BASE_URL}/ds160/load`,
    JSON.stringify({ correo: testUser.correo }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(ds160Res, {
    'ds160 load status 200': (r) => r.status === 200,
    'ds160 response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // 4. Probar listado de documentos
  const docsRes = http.post(
    `${BASE_URL}/documentos/listar`,
    JSON.stringify({ usuario_id: 7 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(docsRes, {
    'documentos status 200': (r) => r.status === 200,
  });

  sleep(1);
}