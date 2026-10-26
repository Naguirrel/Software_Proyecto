const fs = require("fs/promises");
const nodeFs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  validateR2Config,
  uploadBufferToR2,
  deleteObjectFromR2,
  getObjectFromR2,
} = require("./r2");

const LOCAL_STORAGE_DIR = process.env.LOCAL_UPLOAD_DIR
  ? path.resolve(process.env.LOCAL_UPLOAD_DIR)
  : path.join(__dirname, "local_uploads");

function sanitizeFilename(filename) {
  return path.basename(filename).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

function canUseLocalFallback() {
  return process.env.NODE_ENV !== "production"
    || process.env.LOCAL_STORAGE_FALLBACK === "true";
}

async function uploadLocalFile(file, baseUrl) {
  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`;
  await fs.writeFile(path.join(LOCAL_STORAGE_DIR, filename), file.buffer, { flag: "wx" });
  return {
    key: `local/${filename}`,
    url: `${baseUrl.replace(/\/+$/, "")}/local-files/${encodeURIComponent(filename)}`,
    provider: "local",
  };
}

async function uploadStoredFile(file, { baseUrl }) {
  try {
    validateR2Config();
  } catch (error) {
    if (!canUseLocalFallback()) throw error;
    return uploadLocalFile(file, baseUrl);
  }

  const uploaded = await uploadBufferToR2(file);
  return { ...uploaded, provider: "r2" };
}

async function deleteStoredFile(key) {
  if (!key) return;
  if (!key.startsWith("local/")) {
    await deleteObjectFromR2(key);
    return;
  }

  const filename = path.basename(key.slice("local/".length));
  try {
    await fs.unlink(path.join(LOCAL_STORAGE_DIR, filename));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function getStoredFile(key) {
  if (!key) {
    const error = new Error("Archivo no encontrado");
    error.statusCode = 404;
    throw error;
  }

  if (!key.startsWith("local/")) {
    return getObjectFromR2(key);
  }

  const filename = path.basename(key.slice("local/".length));
  return {
    stream: nodeFs.createReadStream(path.join(LOCAL_STORAGE_DIR, filename)),
    contentType: "application/octet-stream",
  };
}

module.exports = {
  LOCAL_STORAGE_DIR,
  uploadStoredFile,
  deleteStoredFile,
  getStoredFile,
};
