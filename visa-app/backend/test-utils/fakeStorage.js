const { Readable } = require("stream");

const files = new Map();
let counter = 0;

async function uploadStoredFile(file) {
  counter += 1;
  const key = `fake/${counter}-${file.originalname}`;
  files.set(key, Buffer.from(file.buffer));
  return { key, url: `http://fake-storage.test/${key}`, provider: "fake" };
}

async function deleteStoredFile(key) {
  files.delete(key);
}

async function getStoredFile(key) {
  const content = files.get(key);
  if (!content) {
    const error = new Error("Archivo no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return {
    stream: Readable.from([content]),
    contentType: "application/octet-stream",
    contentLength: content.length,
  };
}

function reset() {
  files.clear();
  counter = 0;
}

module.exports = { LOCAL_STORAGE_DIR: "fake", files, reset, uploadStoredFile, deleteStoredFile, getStoredFile };
