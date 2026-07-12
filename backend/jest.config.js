module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  setupFilesAfterEnv: ["<rootDir>/src/shared/test/setup.ts"],
  // Each test file connects a real ioredis client (see shared/utils/redis.ts)
  // and setup.ts's afterAll already calls redis.quit()/prisma.$disconnect()
  // cleanly, but ioredis/ts-jest can leave a socket handle in a "closing"
  // state for a moment after quit() resolves, which is what triggers Jest's
  // "did not exit one second after the test run" warning. It does not affect
  // test results (all suites still pass/fail correctly) -- forceExit just
  // stops Jest from idling on that harmless leftover handle.
  forceExit: true,
};
