import { useEffect, useId, useRef, useState } from "react";
import { Camera, Trash2, UserCircle } from "lucide-react";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";
import { deleteProfileAvatar, uploadProfileAvatar } from "../utils/profileAvatar";
import "../styles/profile-avatar.css";

export default function ProfileAvatar({
  userId,
  version = null,
  size = 44,
  className = "",
}) {
  const [loadedAvatar, setLoadedAvatar] = useState({ userId: null, source: "" });
  const [eventRevision, setEventRevision] = useState(0);

  useEffect(() => {
    const refresh = (event) => {
      if (Number(event.detail?.userId) === Number(userId)) {
        setEventRevision(event.detail?.avatarVersion || Date.now());
      }
    };
    window.addEventListener("visaguide:avatar-updated", refresh);
    return () => window.removeEventListener("visaguide:avatar-updated", refresh);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    let objectUrl = "";
    const cacheVersion = eventRevision || version || 0;
    fetch(buildApiUrl(`/identity/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(cacheVersion)}`), {
      headers: buildSessionHeaders(),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("avatar-unavailable");
      objectUrl = URL.createObjectURL(await response.blob());
      setLoadedAvatar({ userId: Number(userId), source: objectUrl });
    }).catch((error) => {
      if (error.name !== "AbortError") setLoadedAvatar({ userId: Number(userId), source: "" });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [eventRevision, userId, version]);

  const style = { "--profile-avatar-size": typeof size === "number" ? `${size}px` : size };
  const source = Number(loadedAvatar.userId) === Number(userId) ? loadedAvatar.source : "";
  return (
    <span className={`profile-avatar ${className}`.trim()} style={style} aria-hidden="true">
      {source
        ? <img src={source} alt="" />
        : <UserCircle aria-hidden="true" />}
    </span>
  );
}

export function ProfileAvatarEditor({ userId, name, version, onUpdated, large = false }) {
  const inputRef = useRef(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setBusy(true);
      setError("");
      const result = await uploadProfileAvatar(file);
      onUpdated?.(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      setBusy(true);
      setError("");
      const result = await deleteProfileAvatar();
      onUpdated?.(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`profile-avatar-editor${large ? " profile-avatar-editor--large" : ""}`}>
      <ProfileAvatar userId={userId} name={name} version={version} size={large ? 112 : 72} />
      <div>
        <strong>Fotografía de perfil</strong>
        <span>JPG o PNG, máximo 2 MB.</span>
        <div className="profile-avatar-editor__actions">
          <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png" onChange={change} disabled={busy} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}><Camera aria-hidden="true" />{busy ? "Procesando…" : "Cambiar foto"}</button>
          <button type="button" className="is-secondary" onClick={remove} disabled={busy}><Trash2 aria-hidden="true" />Quitar</button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
