import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
    dir: './',
});

const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@actions/(.*)$': '<rootDir>/src/actions/$1',
        '^@lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@components/(.*)$': '<rootDir>/src/components/$1',
    },
};

export default createJestConfig(config);