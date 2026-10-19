const {
  createCorsOptions,
  getAllowedOrigins,
  normalizeOrigin,
  parseConfiguredOrigins,
} = require("../config/cors");

describe("CORS configuration", () => {
  test("parses and normalizes configured origins", () => {
    expect(parseConfiguredOrigins(" https://app.example.com/,http://localhost:5173 ")).toEqual([
      "https://app.example.com",
      "http://localhost:5173",
    ]);
    expect(normalizeOrigin("https://app.example.com///")).toBe("https://app.example.com");
  });

  test("uses only the explicit allowlist when configured", () => {
    const origins = getAllowedOrigins({
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://app.example.com,https://admin.example.com",
    });

    expect([...origins]).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  test("allows configured origins and requests without Origin", () => {
    const options = createCorsOptions({
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://app.example.com",
    });
    const callback = jest.fn();

    options.origin("https://app.example.com", callback);
    expect(callback).toHaveBeenLastCalledWith(null, true);

    options.origin(undefined, callback);
    expect(callback).toHaveBeenLastCalledWith(null, true);
  });

  test("rejects origins outside the allowlist", () => {
    const options = createCorsOptions({
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://app.example.com",
    });
    const callback = jest.fn();

    options.origin("https://untrusted.example.com", callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });

  test("supports PATCH, authorization and observable diagnostic headers", () => {
    const options = createCorsOptions({ NODE_ENV: "development" });

    expect(options.methods).toContain("PATCH");
    expect(options.allowedHeaders).toEqual(["Authorization", "Content-Type", "X-Request-Id"]);
    expect(options.exposedHeaders).toEqual([
      "X-Request-Id",
      "RateLimit",
      "RateLimit-Policy",
      "Retry-After",
    ]);
    expect(options.credentials).toBe(false);
  });
});
