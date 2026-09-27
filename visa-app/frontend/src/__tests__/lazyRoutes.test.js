import { describe, expect, it } from "vitest";
import { resolveRouteKey } from "../routes/lazyRoutes";

describe("lazy route resolution", () => {
  it.each([
    ["/dashboard", "dashboard"],
    ["/documents?status=review", "documents"],
    ["/entrevista/simulador", "interviewSimulator"],
    ["/admin", "adminDashboard"],
    ["/admin/users/42", "adminUserDetail"],
    ["/admin/processes/15#history", "adminProcessDetail"],
    ["/admin/consular/", "consularManagement"],
  ])("resolves %s to its lazy chunk", (path, expectedRouteKey) => {
    expect(resolveRouteKey(path)).toBe(expectedRouteKey);
  });

  it("does not preload public auth or unknown routes", () => {
    expect(resolveRouteKey("/login")).toBeNull();
    expect(resolveRouteKey("/not-found")).toBeNull();
  });
});
