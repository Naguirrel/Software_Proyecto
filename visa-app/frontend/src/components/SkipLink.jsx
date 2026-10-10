import useIdioma from "../hooks/useIdioma";

export default function SkipLink() {
  const { t } = useIdioma();

  const focusMain = (event) => {
    const main = document.getElementById("main-content");
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView?.({ block: "start" });
  };

  return (
    <a className="vg-skip-link" href="#main-content" onClick={focusMain}>
      {t("app.skipToContent")}
    </a>
  );
}
