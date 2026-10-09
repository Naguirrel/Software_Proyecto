import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SkipLink from "../components/SkipLink";

describe("SkipLink", () => {
  it("es el primer elemento enfocable y lleva el foco al contenido principal", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <nav><a href="/otra">Otra página</a></nav>
        <main id="main-content" tabIndex="-1">Contenido</main>
      </>
    );

    await user.tab();
    const link = screen.getByRole("link", { name: "Saltar al contenido principal" });
    expect(link).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });
});
