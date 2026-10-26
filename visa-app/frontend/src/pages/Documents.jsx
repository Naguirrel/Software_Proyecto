import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import DocumentCard from "../components/DocumentCard";
import StatusCard from "../components/StatusCard";
import VisaProfileRequirements from "../components/VisaProfileRequirements";
import useModoSenior from "../hooks/useModoSenior";
import useRequireAuth from "../hooks/useRequireAuth";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import { apiRequest } from "../utils/apiClient";
import "../styles/documents.css";

const FALLBACK_DOCUMENTS = [
  {
    id: "passport",
    baseKey: "passport",
    title: "Página de datos del pasaporte vigente",
    category: "Documento oficial",
    type: "image_or_pdf",
    requirement: "required",
    scope: "official",
    required: true,
  },
  {
    id: "photo",
    baseKey: "photo",
    title: "Fotografía digital para visa estadounidense",
    category: "Documento oficial",
    type: "image",
    requirement: "required",
    scope: "official",
    required: true,
  },
];

const SUMMARY_CARDS = [
  { status: "approved", label: "APROBADO", tone: "approved" },
  { status: "review", label: "EN REVISION", tone: "review" },
  { status: "correction", label: "CORRECCION", tone: "correction" },
  { status: "pending", label: "PENDIENTE", tone: "pending" },
];

function formatDocumentDate(value) {
  if (!value) return "No subido";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No subido";

  return date.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitialDocuments(definitions = FALLBACK_DOCUMENTS) {
  return definitions.map((document) => ({
    ...document,
    status: "pending",
    updatedAt: "No subido",
    downloadUrl: "",
    storedDocumentId: null,
    feedback: "",
  }));
}

function mergeSavedDocuments(definitions, savedDocuments) {
  return definitions.map((document) => {
    const savedDocument = savedDocuments.find(
      (item) => item.documento_key === document.id || item.nombre === document.title
    );

    if (!savedDocument) {
      return {
        ...document,
        status: "pending",
        updatedAt: "No subido",
        downloadUrl: "",
        storedDocumentId: null,
        feedback: "",
      };
    }

    return {
      ...document,
      status: savedDocument.estado || "review",
      updatedAt: formatDocumentDate(
        savedDocument.actualizado_en || savedDocument.creado_en
      ),
      downloadUrl: savedDocument.archivo_url,
      storedDocumentId: savedDocument.id,
      feedback: savedDocument.feedback || "",
    };
  });
}

export default function Documents() {
  const { isValidating, session } = useRequireAuth();
  const modoSenior = useModoSenior();
  const [documents, setDocuments] = useState(getInitialDocuments);
  const [requirements, setRequirements] = useState(null);
  const [requirementsRevision, setRequirementsRevision] = useState(0);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const fetchUserDocuments = async () => {
      if (isValidating) return;

      if (!session?.id) {
        setDocuments(getInitialDocuments());
        setLoadingDocuments(false);
        setDocumentsError("");
        return;
      }

      try {
        setLoadingDocuments(true);
        setDocumentsError("");

        const [profileRequirements, response] = await Promise.all([
          apiRequest("/visa-profile/requirements", {
            headers: buildSessionHeaders(),
            signal: controller.signal,
            fallbackMessage: "No se pudieron cargar los requisitos de tu visa.",
          }),
          fetch(buildApiUrl("/documentos/listar"), {
            method: "POST",
            headers: buildSessionHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ usuario_id: session.id }),
            signal: controller.signal,
          }),
        ]);
        if (!response.ok) {
          throw new Error("No se pudieron cargar tus documentos.");
        }

        const data = await response.json();
        const definitions = Array.isArray(profileRequirements?.documents)
          ? profileRequirements.documents
          : FALLBACK_DOCUMENTS;
        setRequirements(profileRequirements);
        setDocuments(mergeSavedDocuments(definitions, Array.isArray(data) ? data : []));
      } catch (error) {
        if (error.name === "AbortError") return;
        setDocuments(getInitialDocuments());
        setDocumentsError(error.message || "No se pudieron cargar tus documentos.");
      } finally {
        if (!controller.signal.aborted) setLoadingDocuments(false);
      }
    };

    fetchUserDocuments();
    return () => controller.abort();
  }, [isValidating, requirementsRevision, session?.id]);

  const statusCounts = useMemo(() => {
    return documents.filter((document) => document.required).reduce(
      (counts, document) => ({
        ...counts,
        [document.status]: (counts[document.status] || 0) + 1,
      }),
      { approved: 0, review: 0, correction: 0, pending: 0 }
    );
  }, [documents]);

  const groupedDocuments = useMemo(() => ({
    required: documents.filter((document) => document.required),
    supporting: documents.filter((document) => !document.required && document.scope === "supporting"),
    internal: documents.filter((document) => !document.required && document.scope === "internal"),
    conditional: documents.filter((document) => !document.required && document.requirement === "conditional"),
  }), [documents]);

  const refreshRequirements = async () => setRequirementsRevision((revision) => revision + 1);

  const handleDocumentStatusChange = (
    documentId,
    status,
    updatedAt,
    savedDocument
  ) => {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId
          ? {
              ...document,
              status,
              updatedAt: updatedAt || document.updatedAt,
              downloadUrl: savedDocument?.archivo_url || document.downloadUrl,
              storedDocumentId: savedDocument?.id || document.storedDocumentId,
              feedback:
                savedDocument?.feedback === undefined
                  ? document.feedback
                  : savedDocument.feedback || "",
            }
          : document
      )
    );
  };

  const handleUploadSuccess = (documentId, savedDocument) => {
    handleDocumentStatusChange(documentId, "review", "Ahora", savedDocument);
  };

  const handleDocumentDelete = (documentId) => {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId
          ? {
              ...document,
              status: "pending",
              updatedAt: "No subido",
              downloadUrl: "",
              storedDocumentId: null,
              feedback: "",
            }
          : document
      )
    );
  };

  const handleHeaderUpload = () => {
    const pendingAction = document.querySelector(
      '[data-document-status="pending"] [data-document-upload-action="true"]'
    );
    const correctionAction = document.querySelector(
      '[data-document-status="correction"] [data-document-upload-action="true"]'
    );
    const target = pendingAction || correctionAction;

    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.click();
  };

  return (
    <div className="documents-shell">
      <Sidebar currentPage="documentos" />

      <main
        id="main-content" tabIndex="-1"
        className={`documents-main${modoSenior ? " documents-main--senior" : ""}`}
      >
        {isValidating ? (
          <p className="documents-message">Verificando sesion...</p>
        ) : (
          <>
            <section className="documents-header">
              <div>
                <h1 className="documents-title">Gestor de Documentos</h1>
                <p className="documents-subtitle" data-senior-priority="secondary">
                  Los requisitos cambian según tu categoría. Distinguimos documentos oficiales,
                  respaldos opcionales y formularios internos para evitar confusiones.
                </p>
              </div>

              <button
                className="documents-header__button"
                type="button"
                onClick={handleHeaderUpload}
              >
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
                Subir archivo
              </button>
            </section>

            <VisaProfileRequirements requirements={requirements} onRefresh={refreshRequirements} />

            <section className="status-grid" aria-label="Resumen de documentos" data-senior-priority="secondary">
              {SUMMARY_CARDS.map((card) => (
                <StatusCard
                  key={card.status}
                  count={statusCounts[card.status] || 0}
                  label={card.label}
                  tone={card.tone}
                />
              ))}
            </section>

            <section className="documents-list" aria-label="Documentos del expediente">
              {loadingDocuments && (
                <p className="documents-message">
                  Cargando estado de documentos...
                </p>
              )}

              {documentsError && (
                <p className="documents-message documents-message--error">
                  {documentsError}
                </p>
              )}

              {!loadingDocuments && <header className="documents-section-heading"><h2>Documentos obligatorios</h2><p>Deben cargarse y ser aprobados para continuar al pago.</p></header>}
              {groupedDocuments.required.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  usuarioId={session?.id}
                  onStatusChange={handleDocumentStatusChange}
                  onUploadSuccess={handleUploadSuccess}
                  onDeleteSuccess={handleDocumentDelete}
                />
              ))}

              {!loadingDocuments && groupedDocuments.conditional.length > 0 && <header className="documents-section-heading"><h2>Documentos condicionales</h2><p>Cárgalos únicamente cuando el portal oficial o tu asesor los solicite.</p></header>}
              {groupedDocuments.conditional.map((doc) => <DocumentCard key={doc.id} doc={doc} usuarioId={session?.id} onStatusChange={handleDocumentStatusChange} onUploadSuccess={handleUploadSuccess} onDeleteSuccess={handleDocumentDelete} />)}

              {!loadingDocuments && groupedDocuments.supporting.length > 0 && <header className="documents-section-heading"><h2>Documentos de respaldo</h2><p>Pueden ser solicitados según tu situación; no son obligatorios universales.</p></header>}
              {groupedDocuments.supporting.map((doc) => <DocumentCard key={doc.id} doc={doc} usuarioId={session?.id} onStatusChange={handleDocumentStatusChange} onUploadSuccess={handleUploadSuccess} onDeleteSuccess={handleDocumentDelete} />)}

              {!loadingDocuments && groupedDocuments.internal.length > 0 && <header className="documents-section-heading"><h2>Preparación interna VisaGuide</h2><p>Ayuda al asesor, pero no es documentación exigida por el consulado.</p></header>}
              {groupedDocuments.internal.map((doc) => <DocumentCard key={doc.id} doc={doc} usuarioId={session?.id} onStatusChange={handleDocumentStatusChange} onUploadSuccess={handleUploadSuccess} onDeleteSuccess={handleDocumentDelete} />)}
            </section>

          </>
        )}
      </main>
    </div>
  );
}
