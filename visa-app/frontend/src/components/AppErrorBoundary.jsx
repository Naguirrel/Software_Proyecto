import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class AppErrorBoundary extends Component {
  state = { error: null, recoveryAttempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("FRONTEND RENDER ERROR:", error, info.componentStack);
  }

  retry = () => {
    this.setState(({ recoveryAttempt }) => ({ error: null, recoveryAttempt: recoveryAttempt + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <div key={this.state.recoveryAttempt}>{this.props.children}</div>;
    }

    return (
      <main className="app-error" role="alert" aria-live="assertive">
        <AlertTriangle aria-hidden="true" />
        <h1>No pudimos mostrar esta página</h1>
        <p>Ocurrió un error inesperado al cargar la interfaz. Tus datos guardados no se modificaron.</p>
        <div className="app-error__actions">
          <button type="button" onClick={this.retry}>
            <RefreshCw aria-hidden="true" /> Intentar de nuevo
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </div>
      </main>
    );
  }
}
