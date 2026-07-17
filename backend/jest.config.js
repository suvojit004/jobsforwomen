module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // Explicitly point ts-jest at tsconfig.test.json rather than letting it
  // fall back to the nearest tsconfig.json. This is what actually decouples
  // test compilation from the production tsconfig.json -- without this,
  // ts-jest would use the production config (which no longer declares
  // "jest" in its "types") and every test file would fail to compile with
  // "Cannot find name 'describe'" etc.
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
  setupFilesAfterEnv: ["<rootDir>/src/shared/test/setup.ts"],
  forceExit: true,
};
