import { useEffect, useState } from "react";
import { buildApiUrl } from "../config/api";
import { buildSessionHeaders } from "../utils/sessionAuth";

export default function AuthenticatedAudio({ src, children = "Tu navegador no puede reproducir este audio." }) {
  const isRemoteSource = Boolean(src) && !String(src).startsWith("/");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!src) return undefined;
    if (isRemoteSource) return undefined;

    const controller = new AbortController();
    let createdUrl = "";
    fetch(buildApiUrl(src), { headers: buildSessionHeaders(), signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el audio.");
        return response.blob();
      })
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob);
        setLoadedUrl(createdUrl);
        setError("");
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [isRemoteSource, src]);

  if (!src) return null;
  if (error) return <small role="alert">{error}</small>;
  const objectUrl = isRemoteSource ? src : loadedUrl;
  if (!objectUrl) return <small>Cargando audio…</small>;
  return <audio controls src={objectUrl}>{children}</audio>;
}
