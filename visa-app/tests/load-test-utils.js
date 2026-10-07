// Funciones puras para k6 y pruebas de configuración con Node.
export function parseTestProfile(value) {
  if (value !== 'smoke' && value !== 'full') {
    throw new Error('TEST_PROFILE es obligatorio y debe ser smoke o full.');
  }
  return value;
}

export function buildLoadOptions(profile) {
  const selected = parseTestProfile(profile);
  const scenario = selected === 'smoke'
    ? {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      gracefulStop: '10s',
    }
    : {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    };

  return {
    scenarios: { authenticated_users: scenario },
    maxRedirects: 0,
    summaryTrendStats: ['avg', 'p(50)', 'p(95)', 'p(99)', 'min', 'max'],
    thresholds: selected === 'smoke'
      ? {
        http_req_failed: ['rate==0'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate==1'],
      }
      : {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<2000'],
        checks: ['rate>0.95'],
      },
  };
}

export function normalizeBaseUrl(value, allowRemote = false) {
  const input = typeof value === 'string' ? value.trim() : '';
  const match = /^(https?):\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?(\/api)\/?$/i.exec(input);
  if (!match) {
    throw new Error('BASE_URL debe ser una URL http(s) terminada en /api, sin credenciales ni parámetros.');
  }
  const protocol = match[1].toLowerCase();
  const host = match[2].toLowerCase();
  const port = match[3] ? Number(match[3]) : null;
  if (port !== null && (port < 1 || port > 65535)) {
    throw new Error('BASE_URL contiene un puerto inválido.');
  }
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!local && !allowRemote) {
    throw new Error('Carga remota bloqueada. Requiere autorización humana y ALLOW_REMOTE_LOAD_TEST=true.');
  }
  if (!local && protocol !== 'https') {
    throw new Error('Los destinos remotos requieren HTTPS.');
  }
  return protocol + '://' + host + (port === null ? '' : ':' + port) + '/api';
}

export function parseUsers(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (_error) {
    throw new Error('USERS_FILE debe contener un arreglo JSON válido.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('USERS_FILE debe contener al menos una cuenta.');
  }
  const seen = new Set();
  return parsed.map((entry, index) => {
    const correo = typeof entry?.correo === 'string' ? entry.correo.trim() : '';
    const contrasena = typeof entry?.contrasena === 'string' ? entry.contrasena : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !contrasena) {
      throw new Error('La cuenta ' + (index + 1) + ' requiere correo y contrasena.');
    }
    if (seen.has(correo.toLowerCase())) {
      throw new Error('USERS_FILE contiene un correo duplicado en la cuenta ' + (index + 1) + '.');
    }
    seen.add(correo.toLowerCase());
    return { correo, contrasena };
  });
}

export function selectUser(users, vuId) {
  if (!users || !Number.isInteger(users.length) || users.length === 0 ||
      !Number.isInteger(vuId) || vuId < 1) {
    throw new Error('No es posible asignar una cuenta al VU.');
  }
  return users[(vuId - 1) % users.length];
}

export function extractAuth(data) {
  const token = data?.token;
  const id = Number(data?.usuario?.id_usuario);
  if (typeof token !== 'string' || !token || !Number.isSafeInteger(id) || id < 1) {
    throw new Error('El login no devolvió token e identificador de usuario válidos.');
  }
  return { token, id };
}

function redactDiagnostic(value, sensitiveValues) {
  let safe = String(value).replace(/[\r\n\t]+/g, ' ');
  for (const secret of sensitiveValues) {
    if (typeof secret === 'string' && secret) {
      safe = safe.split(secret).join('[REDACTADO]');
    }
  }
  return safe
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/gi, '[REDACTADO]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTADO]')
    .replace(/\b(token|cookie|password|contrasena|contraseña)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '$1=[REDACTADO]')
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[REDACTADO]')
    .slice(0, 300);
}

export function buildLoginFailureDiagnostic(url, response, sensitiveValues = []) {
  const rawType = response?.headers?.['Content-Type'] ??
    response?.headers?.['content-type'] ?? '';
  const contentType = redactDiagnostic(rawType || 'desconocido', sensitiveValues).slice(0, 120);
  let serverError = null;
  if (/^application\/(?:[\w.+-]+\+)?json\b/i.test(contentType)) {
    try {
      const data = response.json();
      if (typeof data?.error === 'string') {
        serverError = redactDiagnostic(data.error, sensitiveValues);
      }
    } catch (_error) {
      // Una respuesta no JSON o malformada no se imprime.
    }
  }
  return {
    url,
    status: Number.isInteger(response?.status) ? response.status : 0,
    contentType,
    serverError,
  };
}
