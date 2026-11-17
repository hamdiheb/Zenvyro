// Jest runs against a real PostgreSQL database (TEST_DATABASE_URL, saad_test). Mock providers stop tests from calling the network.
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/testEnvironment.js'],
  testTimeout: 15000,
  collectCoverageFrom: ['src/**/*.js'],
};
