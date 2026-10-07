const base = require("./jest.config");

module.exports = {
  ...base,
  testMatch: ["**/postgres-tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
};
