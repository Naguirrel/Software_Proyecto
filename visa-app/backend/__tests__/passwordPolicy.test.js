const { MIN_PASSWORD_LENGTH, PASSWORD_POLICY_MESSAGE, validatePassword } = require("../services/passwordPolicy");

describe("passwordPolicy (SP10-05)", () => {
  test("el mínimo es 8 caracteres", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  test.each(["clave1234", "abcdefg1", "1234567a", "Contraseña2026", "ñandú1234", "Clave-segura-123"])(
    "acepta %s",
    (password) => {
      expect(validatePassword(password)).toBeNull();
    }
  );

  test.each([
    ["demasiado corta", "abc123"],
    ["siete caracteres con letras y números", "abcdef1"],
    ["solo números", "12345678"],
    ["solo letras", "abcdefgh"],
    ["símbolos y números sin letras", "1234-5678"],
    ["símbolos y letras sin números", "abcd-efgh"],
    ["solo espacios", "        "],
    ["vacía", ""],
  ])("rechaza una contraseña %s", (_label, password) => {
    expect(validatePassword(password)).toBe(PASSWORD_POLICY_MESSAGE);
  });

  test.each([undefined, null, 12345678, ["clave1234"], { toString: () => "clave1234" }])(
    "rechaza valores que no son texto (%p)",
    (value) => {
      expect(validatePassword(value)).toBe(PASSWORD_POLICY_MESSAGE);
    }
  );
});
