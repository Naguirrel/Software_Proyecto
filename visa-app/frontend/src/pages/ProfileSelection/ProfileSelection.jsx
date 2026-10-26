import { useEffect, useState } from "react";
import "./ProfileSelection.css";
import useModoSenior from "../../hooks/useModoSenior";
import useRequireAuth from "../../hooks/useRequireAuth";
import { apiRequest } from "../../utils/apiClient";
import { buildSessionHeaders } from "../../utils/sessionAuth";
import { setModoSenior } from "../../utils/modoSenior";
import VisaGuideLogo from "../../components/VisaGuideLogo";
import {
  FamilyVisaIcon,
  RenewalVisaIcon,
  SeniorGlassesIcon,
  StudentVisaIcon,
  TourismBusinessVisaIcon,
} from "../../components/icons/VisaGuideIcons";

function ProfileSelection() {
  const { isValidating, session } = useRequireAuth();
  const [selectedProfile, setSelectedProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const modoSenior = useModoSenior();

  useEffect(() => {
    // La selección inicia en modo estándar. Adulto Mayor es el único perfil
    // que activa automáticamente la experiencia senior durante el onboarding.
    setModoSenior(false);
  }, []);

  useEffect(() => {
    if (!isValidating && (session?.perfil || localStorage.getItem("perfilUsuario"))) {
      window.location.replace("/dashboard");
    }
  }, [isValidating, session]);

  const profiles = [
    {
      id: "turismo_negocios",
      title: "Turismo / Negocios (B1/B2)",
      Icon: TourismBusinessVisaIcon,
      description:
        "Viajes de placer, visitas familiares o reuniones de negocios.",
    },
    {
      id: "estudiante",
      title: "Estudiante (F/M)",
      Icon: StudentVisaIcon,
      description:
        "Estudios académicos o vocacionales en instituciones de EE. UU.",
    },
    {
      id: "renovacion",
      title: "Renovación B1/B2",
      Icon: RenewalVisaIcon,
      description:
        "Renueva tu visa con un DS-160 y pago nuevos. El portal oficial confirmará si necesitas entrevista.",
    },
    {
      id: "grupo_familiar",
      title: "Grupo Familiar",
      Icon: FamilyVisaIcon,
      description:
        "Seguimiento compartido con DS-160, documentos y tarifa individual para cada integrante.",
    },
    {
      id: "adulto_mayor",
      title: "Adulto Mayor (asistencia accesible)",
      Icon: SeniorGlassesIcon,
      description:
        "Activa el Modo Senior desde el inicio. La edad no elimina automáticamente la entrevista.",
    },
  ];

  const handleSelectProfile = (profileId) => {
    setSelectedProfile(profileId);
    setModoSenior(profileId === "adulto_mayor");
    setErrorMessage("");
  };

  const handleConfirmSelection = async () => {
    if (!selectedProfile) {
      setErrorMessage("Selecciona un perfil antes de continuar.");
      return;
    }

    if (!session) {
      setErrorMessage("Primero inicia sesión para guardar el perfil.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // El usuario lo identifica el token de sesión; solo se envía el perfil elegido.
      await apiRequest("/guardar-perfil", {
        method: "POST",
        headers: buildSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ perfil: selectedProfile }),
        fallbackMessage: "No se pudo guardar el perfil.",
      });

      localStorage.setItem("perfilUsuario", selectedProfile);

      // Actualizar también la sesión con el perfil
      const storedSession = localStorage.getItem("visaguide_session");
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        sessionData.perfil = selectedProfile;
        localStorage.setItem("visaguide_session", JSON.stringify(sessionData));
      }

      setSuccessMessage("¡Perfil seleccionado con éxito!");

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (error) {
      // Con 401 apiRequest ya limpió la sesión y useRequireAuth redirige a /login.
      setErrorMessage(error.status ? error.message : "Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="profile-page profile-page--loading">
        <main id="main-content" tabIndex="-1" className="profile-main">
          <p role="status" aria-live="polite">Verificando sesión...</p>
        </main>
      </div>
    );
  }

  return (
    <div className={`profile-page ${modoSenior ? "modo-senior" : ""}`}>
      <header className="profile-header">
        <VisaGuideLogo className="profile-brand" />
        <div className="profile-header__actions">
          <span className="onboarding-step" data-senior-priority="secondary">Configuración de cuenta</span>
        </div>
      </header>
      <main id="main-content" tabIndex="-1" className="profile-main">
        <h1 id="profile-selection-title" className="profile-title">
          {modoSenior ? "Selecciona tu perfil" : <>Prepara tu solicitud de visa<span>sin estrés</span></>}
        </h1>

        <p className="profile-subtitle">
          {modoSenior
            ? "Elige la opción que mejor describe tu solicitud."
            : "Te guiamos paso a paso, evitamos errores comunes y te preparamos para tu entrevista consular. Selecciona tu perfil para personalizar tu experiencia."}
        </p>

        <div className="profile-announcements" aria-live="polite" aria-atomic="true">
          {successMessage && <p className="success-message" role="status">{successMessage}</p>}
          {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
        </div>

        <section className="cards-grid" aria-labelledby="profile-selection-title">
          {profiles.map((profile) => (
            <button
              type="button"
              key={profile.id}
              className={`profile-card ${
                selectedProfile === profile.id ? "selected" : ""
              }`}
              onClick={() => handleSelectProfile(profile.id)}
              aria-pressed={selectedProfile === profile.id}
            >
              <span className={`card-icon card-icon--${profile.id}`} aria-hidden="true">
                <profile.Icon size={26} strokeWidth={2} />
              </span>
              <span className="card-title">{profile.title}</span>
              <span className="card-description">{profile.description}</span>
              <span className="card-footer">
                <span>Seleccionar</span>
                <span className="arrow">➜</span>
              </span>
            </button>
          ))}
        </section>

        <div className="actions">
          <button
            className="save-button"
            onClick={handleConfirmSelection}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Continuar"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default ProfileSelection;
