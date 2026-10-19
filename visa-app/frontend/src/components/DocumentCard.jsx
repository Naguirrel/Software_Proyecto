import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../config/api";
import { isDocumentFileRoute, openDocumentPreview } from "../utils/documentPreview";
import { buildSessionHeaders } from "../utils/sessionAuth";

const STATUS_CONFIG = {
  approved: {
    label: "Revisado (Aprobado)",
    className: "document-status-badge document-status-badge--approved",
  },
  review: {
    label: "Subido (En revisión)",
    className: "document-status-badge document-status-badge--review",
  },
  correction: {
    label: "Requiere Corrección",
    className: "document-status-badge document-status-badge--correction",
  },
  pending: {
    label: "Pendiente",
    className: "document-status-badge document-status-badge--pending",
  },
};

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 16V5m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 16.5A4.5 4.5 0 0 0 15.5 12h-.7A6 6 0 1 0 5 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16m-2 0-.8 12.1A2 2 0 0 1 15.2 21H8.8a2 2 0 0 1-2-1.9L6 7m3 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 7v6m0 4h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="m6 12 4 4 8-8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 8v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getStatusIcon(status) {
  if (status === "approved") return <CheckIcon />;
  if (status === "correction") return <AlertIcon />;
  return <ClockIcon />;
}

function getAcceptType(type) {
  if (type === "pdf") return "application/pdf";
  if (type === "image") return "image/*";
  return undefined;
}

function getUpdatedLabel(updatedAt, fallback) {
  if (updatedAt instanceof Date) {
    return updatedAt.toLocaleString("es-GT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return fallback || "No subido";
}

function getPreviewUrl(preview, downloadUrl) {
  if (preview) return preview;
  if (!downloadUrl) return "";
  if (isDocumentFileRoute(downloadUrl)) return "";
  return downloadUrl.startsWith("/") ? buildApiUrl(downloadUrl) : downloadUrl;
}

function DocumentFilePreview({ doc, preview, file, onOpen }) {
  const previewUrl = getPreviewUrl(preview, doc.downloadUrl);

  if (!previewUrl) return null;

  const isImage = doc.type === "image" || file?.type?.startsWith("image/");
  const isPdf = doc.type === "pdf" || file?.type === "application/pdf";

  return (
    <div className="document-file-preview">
      <div className="document-file-preview__header">
        <span>Archivo subido</span>
        <button type="button" onClick={onOpen}>
          Ver completo
        </button>
      </div>

      {isImage && (
        <button
          className="document-file-preview__image"
          type="button"
          onClick={onOpen}
        >
          <img
            src={previewUrl}
            alt={`Vista previa de ${doc.title}`}
            loading="lazy"
            decoding="async"
            width="640"
            height="360"
          />
        </button>
      )}

      {isPdf && (
        <div className="document-file-preview__pdf">
          <iframe src={previewUrl} title={`Vista previa de ${doc.title}`} />
          <span>PDF cargado</span>
        </div>
      )}

      {!isImage && !isPdf && (
        <div className="document-file-preview__generic">
          Documento cargado
        </div>
      )}
    </div>
  );
}

export default function DocumentCard({
  doc,
  usuarioId,
  onStatusChange,
  onUploadSuccess,
  onDeleteSuccess,
}) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(doc.status || "pending");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setStatus(doc.status || "pending");
  }, [doc.status]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const validateFile = (selectedFile) => {
    if (doc.type === "pdf" && selectedFile.type !== "application/pdf") {
      setUploadError("Este documento requiere un archivo PDF.");
      return false;
    }

    if (doc.type === "image" && !selectedFile.type.startsWith("image/")) {
      setUploadError("Este documento requiere una imagen PNG o JPG.");
      return false;
    }

    return true;
  };

  const uploadDocument = async (selectedFile) => {
    if (!usuarioId) {
      setUploadError("Inicia sesión para ligar este archivo a tu usuario.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("nombre", doc.title);
    formData.append("tipo", doc.category || selectedFile.type);
    formData.append("documento_key", doc.id);

    formData.append("usuario_id", usuarioId);

    setUploading(true);
    setUploadError("");

    try {
      const response = await fetch(buildApiUrl("/upload"), {
        method: "POST",
        headers: buildSessionHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo subir el archivo.");
      }

      const data = await response.json();
      const now = new Date();

      setStatus("review");
      setUpdatedAt(now);
      onStatusChange?.(doc.id, "review", "Ahora", data.documento);
      onUploadSuccess?.(doc.id, data.documento);
    } catch (error) {
      setFile(null);
      setPreview((currentPreview) => {
        if (currentPreview) URL.revokeObjectURL(currentPreview);
        return null;
      });
      setUploadError(error.message || "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile || !validateFile(selectedFile)) return;

    if (preview) URL.revokeObjectURL(preview);

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    await uploadDocument(selectedFile);
  };

  const handleAction = () => {
    if (!usuarioId) {
      setUploadError("Inicia sesión para ligar este archivo a tu usuario.");
      return;
    }

    fileInputRef.current?.click();
  };

  const handleDelete = async () => {
    if (!doc.storedDocumentId || !usuarioId) return;

    setDeleting(true);
    setUploadError("");

    try {
      const response = await fetch(buildApiUrl("/documentos"), {
        method: "DELETE",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          documento_id: doc.storedDocumentId,
          usuario_id: usuarioId,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el archivo.");
      }

      setFile(null);
      setStatus("pending");
      setUpdatedAt(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      onDeleteSuccess?.(doc.id);
    } catch (error) {
      setUploadError(error.message || "No se pudo eliminar el archivo.");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenPreview = () => {
    if (preview) {
      window.open(preview, "_blank", "noopener,noreferrer");
      return;
    }

    openDocumentPreview({ archivo_url: doc.downloadUrl, nombre: doc.title });
  };

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isCorrection = status === "correction";
  const canUploadPending = status === "pending";
  const canManageUploaded = status === "review" || status === "correction";
  const cardClassName = `document-card${
    isCorrection ? " document-card--correction" : ""
  }`;
  const hasSavedFile = Boolean(doc.storedDocumentId || preview || doc.downloadUrl);

  return (
    <article className={cardClassName} data-document-status={status}>
      <div className="document-card__main">
        <div className="document-card__content">
          <div className="document-card__title-row">
            <h3 className="document-card__title">{doc.title}</h3>
            {doc.required && (
              <span className="document-required-badge">
                <span />
                REQUERIDO
              </span>
            )}
          </div>

          <p className="document-card__meta">
            {doc.category} • Actualizado: {getUpdatedLabel(updatedAt, doc.updatedAt)}
          </p>

          {doc.feedback && (
            <div className="document-feedback" role="status">
              <div className="document-feedback__heading">
                <AlertIcon />
                <strong>Feedback del revisor:</strong>
              </div>
              <p>{doc.feedback}</p>
            </div>
          )}

          {file && (
            <p className="document-card__selected-file">
              Archivo recibido: <strong>{file.name}</strong>
            </p>
          )}

          <DocumentFilePreview
            doc={doc}
            preview={preview}
            file={file}
            onOpen={handleOpenPreview}
          />

          {uploadError && <p className="document-upload-error">{uploadError}</p>}
        </div>

        <div className="document-card__aside">
          <span className={statusConfig.className}>
            {getStatusIcon(status)}
            {statusConfig.label}
          </span>

          <div className="document-card__actions">
            <button
              className="document-icon-button"
              type="button"
              aria-label="Abrir documento"
              title="Abrir documento"
              onClick={handleOpenPreview}
              disabled={!preview && !doc.downloadUrl}
              data-senior-priority={
                !preview && !doc.downloadUrl ? "secondary" : undefined
              }
            >
              <DownloadIcon />
            </button>

            {canUploadPending && (
              <button
                className="document-action-button"
                type="button"
                onClick={handleAction}
                disabled={uploading}
                data-document-upload-action="true"
              >
                <UploadIcon />
                {uploading ? "Subiendo..." : "Subir archivo"}
              </button>
            )}

            {canManageUploaded && (
              <button
                className={`document-action-button${
                  isCorrection ? " document-action-button--danger" : ""
                }`}
                type="button"
                onClick={handleAction}
                disabled={uploading}
                data-document-upload-action="true"
              >
                <EditIcon />
                {uploading ? "Subiendo..." : "Modificar"}
              </button>
            )}

            {canManageUploaded && (
              <button
                className="document-delete-button"
                type="button"
                onClick={handleDelete}
                disabled={!hasSavedFile || deleting}
                title={
                  hasSavedFile
                    ? "Eliminar archivo"
                    : "No hay archivo para eliminar"
                }
              >
                <TrashIcon />
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            className="document-file-input"
            type="file"
            accept={getAcceptType(doc.type)}
            onChange={handleFileChange}
          />
        </div>
      </div>
    </article>
  );
}
