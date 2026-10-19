import { useEffect, useState } from "react";
import "./ProfileSelection.css";
import useModoSenior from "../../hooks/useModoSenior";
import SeniorModeToggle from "../../components/SeniorModeToggle";
import useRequireAuth from "../../hooks/useRequireAuth";
import { apiRequest } from "../../utils/apiClient";
import { buildSessionHeaders } from "../../utils/sessionAuth";

function ProfileSelection() {
  const { isValidating, session } = useRequireAuth();
  const [selectedProfile, setSelectedProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const modoSenior = useModoSenior();

  useEffect(() => {
    if (!isValidating && (session?.perfil || localStorage.getItem("perfilUsuario"))) {
      window.location.replace("/dashboard");
    }
  }, [isValidating, session]);

  const profiles = [
    {
      id: "turismo_negocios",
      title: "Turismo / Negocios (B1/B2)",
      description:
        "Viajes de placer, visitas familiares o reuniones de negocios.",
    },
    {
      id: "estudiante",
      title: "Estudiante (F/M)",
      description:
        "Estudios académicos o vocacionales en instituciones de EE. UU.",
    },
    {
      id: "renovacion",
      title: "Renovación",
      description:
        "Renovación de visa sin necesidad de entrevista consular.",
    },
    {
      id: "grupo_familiar",
      title: "Grupo Familiar",
      description:
        "Solicitud conjunta para varios miembros de la familia.",
    },
    {
      id: "adulto_mayor",
      title: "Adulto Mayor (Senior)",
      description:
        "Proceso simplificado con exención de entrevista por edad.",
    },
  ];

  const handleSelectProfile = (profileId) => {
    setSelectedProfile(profileId);
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
        <div className="brand" aria-label="VisaGuide">
          <span className="brand-badge" aria-hidden="true">VG</span>
          <span className="brand-name">VisaGuide</span>
        </div>
        <div className="profile-header__actions">
          <span className="onboarding-step" data-senior-priority="secondary">Configuración de cuenta</span>
          <SeniorModeToggle showState />
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
              <span className="card-icon" aria-hidden="true" />
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
