import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TopActions from "../components/TopActions";

describe("TopActions", () => {
  it("usa los iconos oficiales para información y notificaciones", () => {
    const { container } = render(
      <MemoryRouter>
        <TopActions userId={7} unreadCount={1} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /información del proceso/i })).toHaveAttribute(
      "href",
      "/dashboard#informacion"
    );
    expect(container.querySelector('[data-icon="information"]')).toBeInTheDocument();
    expect(container.querySelector('[data-icon="bell"]')).toBeInTheDocument();
  });
});
