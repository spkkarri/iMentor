module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    setupFiles: ['dotenv/config'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    coveragePathIgnorePatterns: ['/node_modules/'],
    coverageDirectory: 'coverage',
    collectCoverage: true,
    collectCoverageFrom: [
        'services/**/*.{js,jsx,ts,tsx}',
        '!**/node_modules/**'
    ]
};
