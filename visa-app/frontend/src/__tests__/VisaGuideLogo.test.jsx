import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VisaGuideLogo from "../components/VisaGuideLogo";

describe("VisaGuideLogo", () => {
  it("soporta las variantes completa y compacta con ícono decorativo", () => {
    const { container, rerender } = render(<VisaGuideLogo subtitle="Guevara Advisory Services" />);

    expect(container.firstChild).toHaveClass("visaguide-logo--full");
    expect(screen.getByText("Guevara Advisory Services")).toBeInTheDocument();
    expect(container.querySelector('[data-icon="visaguide-mark"]')).toHaveAttribute("aria-hidden", "true");

    rerender(<VisaGuideLogo variant="compact" accent={false} />);
    expect(container.firstChild).toHaveClass("visaguide-logo--compact");
    expect(container.querySelector(".visaguide-logo__accent")).not.toBeInTheDocument();
  });
});
