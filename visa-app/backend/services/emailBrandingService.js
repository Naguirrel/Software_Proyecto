function normalizeWebsite(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const { protocol } = new URL(text);
    return protocol === "http:" || protocol === "https:" ? text : "";
  } catch {
    return "";
  }
}

// Un fallo al leer la configuración no debe impedir enviar correos: las plantillas usan la marca por defecto.
async function loadEmailBranding(pool) {
  try {
    const result = await pool.query("SELECT nombre_comercial, sitio_web FROM admin_settings WHERE id = 1");
    const settings = result?.rows?.[0];
    return {
      nombreComercial: String(settings?.nombre_comercial ?? "").trim(),
      sitioWeb: normalizeWebsite(settings?.sitio_web),
    };
  } catch {
    return {};
  }
}

module.exports = { loadEmailBranding, normalizeWebsite };
