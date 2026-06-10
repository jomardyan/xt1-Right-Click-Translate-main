module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['background.js', 'options.js', 'popup.js', 'content.js'],
  coverageReporters: ['text', 'lcov']
};
