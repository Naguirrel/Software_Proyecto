const multer = require("multer");
const path = require("path");
const { sendErrorResponse } = require("./middleware/errorResponse");

const FILE_SIZE_LIMIT_MB = 5;
const FILE_SIZE_LIMIT_BYTES = FILE_SIZE_LIMIT_MB * 1024 * 1024;

const DOCUMENT_FILE_TYPES = {
  ".pdf": new Set(["application/pdf"]),
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png": new Set(["image/png"]),
};

const INTERVIEW_AUDIO_TYPES = {
  ".webm": new Set(["audio/webm", "video/webm"]),
};

const AVATAR_FILE_TYPES = {
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png": new Set(["image/png"]),
};
const AVATAR_SIZE_LIMIT_MB = 2;
const AVATAR_SIZE_LIMIT_BYTES = AVATAR_SIZE_LIMIT_MB * 1024 * 1024;

const DANGEROUS_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".com",
  ".exe",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".php",
  ".ps1",
  ".sh",
  ".svg",
  ".zip",
]);

const storage = multer.memoryStorage();

function buildUploadError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getNormalizedExtension(file) {
  const originalName = String(file.originalname || "").trim();
  const baseName = path.basename(originalName);

  if (!originalName || baseName !== originalName || originalName.includes("..")) {
    throw buildUploadError("Nombre de archivo inválido");
  }

  const extension = path.extname(baseName).toLowerCase();
  if (!extension) {
    throw buildUploadError("El archivo debe tener una extensión válida");
  }

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    throw buildUploadError("Tipo de archivo no permitido");
  }

  return extension;
}

function getAllowedTypesForField(file) {
  if (file.fieldname === "file") return DOCUMENT_FILE_TYPES;
  if (file.fieldname === "avatar") return AVATAR_FILE_TYPES;
  if (file.fieldname?.startsWith("audio_")) return INTERVIEW_AUDIO_TYPES;
  return null;
}

function validateUploadedFile(_req, file, callback) {
  try {
    const allowedTypes = getAllowedTypesForField(file);
    if (!allowedTypes) {
      return callback(buildUploadError("Campo de archivo no permitido"));
    }

    const extension = getNormalizedExtension(file);
    const allowedMimeTypes = allowedTypes[extension];

    if (!allowedMimeTypes) {
      return callback(buildUploadError("Extensión de archivo no permitida"));
    }

    const mimetype = String(file.mimetype || "").toLowerCase().split(";")[0].trim();
    if (!allowedMimeTypes.has(mimetype)) {
      return callback(buildUploadError("El tipo MIME no coincide con la extensión permitida"));
    }

    return callback(null, true);
  } catch (error) {
    return callback(error);
  }
}

function handleUploadError(error, _req, res, next) {
  if (!error) return next();

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      const limitMb = error.field === "avatar" ? AVATAR_SIZE_LIMIT_MB : FILE_SIZE_LIMIT_MB;
      return res.status(413).json({
        error: `El archivo excede el límite de ${limitMb} MB`,
      });
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Demasiados archivos adjuntos" });
    }

    return res.status(400).json({ error: "No se pudo procesar el archivo adjunto" });
  }

  if (error.statusCode) {
    return sendErrorResponse(_req, res, error, {
      fallback: "No se pudo procesar el archivo adjunto",
      context: "upload.middleware",
    });
  }

  return next(error);
}

const upload = multer({
  storage,
  fileFilter: validateUploadedFile,
  limits: {
    fileSize: FILE_SIZE_LIMIT_BYTES,
    files: 8,
  },
});

const avatarUpload = multer({
  storage,
  fileFilter: validateUploadedFile,
  limits: {
    fileSize: AVATAR_SIZE_LIMIT_BYTES,
    files: 1,
  },
});

upload.handleUploadError = handleUploadError;
upload.FILE_SIZE_LIMIT_MB = FILE_SIZE_LIMIT_MB;
upload.FILE_SIZE_LIMIT_BYTES = FILE_SIZE_LIMIT_BYTES;
upload.allowedDocumentExtensions = Object.keys(DOCUMENT_FILE_TYPES);
upload.allowedAvatarExtensions = Object.keys(AVATAR_FILE_TYPES);
upload.allowedInterviewAudioExtensions = Object.keys(INTERVIEW_AUDIO_TYPES);
upload.avatarSingle = avatarUpload.single("avatar");
upload.AVATAR_SIZE_LIMIT_MB = AVATAR_SIZE_LIMIT_MB;
upload.AVATAR_SIZE_LIMIT_BYTES = AVATAR_SIZE_LIMIT_BYTES;

module.exports = upload;
