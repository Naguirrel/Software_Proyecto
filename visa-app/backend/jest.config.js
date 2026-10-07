module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  testPathIgnorePatterns: ["/node_modules/", "/postgres-tests/"],
  collectCoverageFrom: [
    "app.js",
    "r2.js",
    "storage.js",
    "upload.js",
    "controllers/**/*.js",
    "routes/**/*.js",
    "services/**/*.js",
    "!index.js",
  ],
  coverageDirectory: "coverage",
};
