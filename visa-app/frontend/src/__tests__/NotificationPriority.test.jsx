import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationCenter from "../components/NotificationCenter";
import NotificationPriorityBadge from "../components/NotificationPriorityBadge";
import AdvisorNotificationCenter from "../components/advisor/AdvisorNotificationCenter";
import Notificaciones from "../pages/Notificaciones";
import { TRANSLATIONS } from "../i18n/translations";
import { getNotificationPriority, hasPriorityBadge } from "../utils/notificationPriority";

// SP10-16 / RF-16: distinción visual de las notificaciones según su prioridad.

const advisorState = vi.hoisted(() => ({ notifications: [] }));

vi.mock("../hooks/useRequireAuth", () => ({
  default: () => ({ isValidating: false, session: { id: 7, nombre: "Ana López", correo: "ana@example.com" } }),
}));
vi.mock("../hooks/useModoSenior", () => ({ default: () => false }));
vi.mock("../components/Sidebar", () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock("../components/advisor/advisorNotificationsStore", () => ({
  useAdvisorNotifications: () => ({
    notifications: advisorState.notifications,
    unreadCount: advisorState.notifications.filter((n) => !n.leido).length,
    hasMore: false,
    status: "live",
    error: "",
    preferences: { sound_enabled: false, muted_types: [] },
    loadNotifications: vi.fn(async () => {}),
    loadMore: vi.fn(async () => {}),
    markRead: vi.fn(async () => {}),
    markAllRead: vi.fn(async () => {}),
    archive: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    updatePreferences: vi.fn(async () => {}),
  }),
}));

const NOTIFICATIONS = [
  { id: 1, titulo: "Documento requiere correcciones", mensaje: "Revisa tu pasaporte.", tipo: "documento", prioridad: "alta", leido: false, created_at: "2026-10-18T10:00:00Z" },
  { id: 2, titulo: "Cita consular registrada", mensaje: "Tu cita quedó registrada.", tipo: "entrevista", prioridad: "normal", leido: false, created_at: "2026-10-18T09:00:00Z" },
  { id: 3, titulo: "Estado de trámite actualizado", mensaje: "Tu trámite cambió.", tipo: "info", prioridad: "baja", leido: true, created_at: "2026-10-18T08:00:00Z" },
  { id: 4, titulo: "Notificación antigua", mensaje: "Sin prioridad guardada.", tipo: "info", leido: true, created_at: "2026-10-17T08:00:00Z" },
];

function mockList(notifications = NOTIFICATIONS) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => ({ notificaciones: notifications }) });
}

function itemFor(title) {
  return screen.getByText(title).closest("li");
}

describe("utilidades de prioridad", () => {
  it("devuelve la prioridad guardada y normal cuando falta o es desconocida", () => {
    expect(getNotificationPriority({ prioridad: "alta" })).toBe("alta");
    expect(getNotificationPriority({ prioridad: "baja" })).toBe("baja");
    expect(getNotificationPriority({ prioridad: "normal" })).toBe("normal");
    expect(getNotificationPriority({})).toBe("normal");
    expect(getNotificationPriority({ prioridad: "urgente" })).toBe("normal");
    expect(getNotificationPriority(null)).toBe("normal");
    expect(getNotificationPriority(undefined)).toBe("normal");
  });

  it("solo las prioridades alta y baja llevan distintivo", () => {
    expect(hasPriorityBadge("alta")).toBe(true);
    expect(hasPriorityBadge("baja")).toBe(true);
    expect(hasPriorityBadge("normal")).toBe(false);
  });

  it("las etiquetas existen en español e inglés", () => {
    for (const key of ["notifications.priority.alta", "notifications.priority.baja"]) {
      expect(TRANSLATIONS.es[key], key).toBeTruthy();
      expect(TRANSLATIONS.en[key], key).toBeTruthy();
    }
  });
});

describe("NotificationPriorityBadge", () => {
  it("muestra el texto de la prioridad alta, no solo un color", () => {
    render(<NotificationPriorityBadge priority="alta" label="Prioridad alta" />);

    expect(screen.getByText("Prioridad alta")).toHaveClass("vg-priority-badge", "vg-priority-badge--alta");
  });

  it("muestra el distintivo informativo para la prioridad baja", () => {
    render(<NotificationPriorityBadge priority="baja" label="Informativa" />);

    expect(screen.getByText("Informativa")).toHaveClass("vg-priority-badge--baja");
  });

  it("no muestra nada para la prioridad normal", () => {
    const { container } = render(<NotificationPriorityBadge priority="normal" label="Normal" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("centro de notificaciones del cliente", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function openPanel() {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationCenter userId={7} unreadCount={2} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Abrir notificaciones/ }));
    await screen.findByText("Documento requiere correcciones");
  }

  it("distingue las notificaciones de prioridad alta y baja y deja las normales sin distintivo", async () => {
    mockList();

    await openPanel();

    const high = itemFor("Documento requiere correcciones");
    expect(high).toHaveClass("is-priority-alta");
    expect(within(high).getByText("Prioridad alta")).toBeInTheDocument();

    const low = itemFor("Estado de trámite actualizado");
    expect(low).toHaveClass("is-priority-baja");
    expect(within(low).getByText("Informativa")).toBeInTheDocument();

    const normal = itemFor("Cita consular registrada");
    expect(normal).toHaveClass("is-priority-normal");
    expect(normal.querySelector(".vg-priority-badge")).toBeNull();
  });

  it("una notificación sin prioridad guardada se muestra como normal", async () => {
    mockList();

    await openPanel();

    const legacy = itemFor("Notificación antigua");
    expect(legacy).toHaveClass("is-priority-normal");
    expect(legacy.querySelector(".vg-priority-badge")).toBeNull();
  });

  it("conserva el marcador de no leída junto a la prioridad", async () => {
    mockList();

    await openPanel();

    expect(itemFor("Documento requiere correcciones")).toHaveClass("is-unread", "is-priority-alta");
    expect(itemFor("Estado de trámite actualizado")).not.toHaveClass("is-unread");
  });
});

describe("página de notificaciones del cliente", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function cardFor(title) {
    return screen.getByText(title).closest("[data-priority]");
  }

  it("marca cada tarjeta con su prioridad y muestra el distintivo solo cuando corresponde", async () => {
    mockList();

    render(<Notificaciones />);
    await screen.findByText("Documento requiere correcciones");

    const high = cardFor("Documento requiere correcciones");
    expect(high).toHaveAttribute("data-priority", "alta");
    expect(within(high).getByText("Prioridad alta")).toBeInTheDocument();

    const low = cardFor("Estado de trámite actualizado");
    expect(low).toHaveAttribute("data-priority", "baja");
    expect(within(low).getByText("Informativa")).toBeInTheDocument();

    const normal = cardFor("Cita consular registrada");
    expect(normal).toHaveAttribute("data-priority", "normal");
    expect(normal.querySelector(".vg-priority-badge")).toBeNull();
    expect(cardFor("Notificación antigua")).toHaveAttribute("data-priority", "normal");
  });

  it("la prioridad alta tiene un estilo propio incluso cuando ya fue leída", async () => {
    mockList([{ ...NOTIFICATIONS[0], leido: true }]);

    render(<Notificaciones />);
    await screen.findByText("Documento requiere correcciones");

    expect(cardFor("Documento requiere correcciones").style.borderLeft).toContain("var(--vg-danger-text)");
  });
});

describe("centro de notificaciones del asesor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    advisorState.notifications = [
      { id: 10, titulo: "Tarea vencida", mensaje: "Revisar DS-160", tipo: "task", prioridad: "alta", leido: false, created_at: new Date().toISOString() },
      { id: 11, titulo: "Nuevo mensaje de un solicitante", mensaje: "Ana te envió un mensaje.", tipo: "chat", prioridad: "normal", leido: false, created_at: new Date().toISOString() },
    ];
  });

  it("distingue las notificaciones de prioridad alta y deja las normales sin distintivo", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdvisorNotificationCenter /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: /Abrir notificaciones/ }));

    const high = screen.getByText("Tarea vencida").closest("li");
    expect(high).toHaveClass("is-priority-alta");
    expect(within(high).getByText("Prioridad alta")).toBeInTheDocument();
    const normal = screen.getByText("Nuevo mensaje de un solicitante").closest("li");
    expect(normal).toHaveClass("is-priority-normal");
    expect(normal.querySelector(".vg-priority-badge")).toBeNull();
  });
});
