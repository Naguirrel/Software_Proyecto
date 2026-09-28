import { useEffect, useState } from "react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorPageHeader, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";

export default function AdvisorProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    advisorRequest("/profile").then((data) => setProfile(data.user)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true); setError(""); setNotice("");
      const data = await advisorRequest("/profile", { method: "PUT", body: JSON.stringify(profile) });
      setProfile(data.user); setNotice("Perfil actualizado correctamente.");
      const session = JSON.parse(localStorage.getItem("visaguide_session") || "null");
      if (session) localStorage.setItem("visaguide_session", JSON.stringify({ ...session, nombre: data.user.nombre }));
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  return <AdvisorLayout><AdvisorPageHeader title="Mi perfil" description="Actualiza tus datos de contacto." /><AdvisorState loading={loading} error={error && !profile ? error : ""} />{profile && <form className="advisor-panel advisor-profile-form" onSubmit={save}>{notice && <p className="advisor-success" role="status">{notice}</p>}{error && <p className="advisor-inline-error" role="alert">{error}</p>}<div className="advisor-form-grid"><label>Nombre completo<input value={profile.nombre || ""} onChange={(event) => setProfile({ ...profile, nombre: event.target.value })} required /></label><label>Correo<input type="email" value={profile.correo || ""} disabled /></label><label>Teléfono<input value={profile.telefono || ""} onChange={(event) => setProfile({ ...profile, telefono: event.target.value })} /></label><label>Ciudad<input value={profile.ciudad || ""} onChange={(event) => setProfile({ ...profile, ciudad: event.target.value })} /></label><label>País<input value={profile.pais || ""} onChange={(event) => setProfile({ ...profile, pais: event.target.value })} /></label></div><footer><button className="advisor-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></footer></form>}</AdvisorLayout>;
}
