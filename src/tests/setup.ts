// Test setup file for Vitest
import { beforeAll, afterEach, afterAll } from 'vitest';

// Mock localStorage for tests
const localStorageMock = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
  length: 0,
  key: (index: number) => null
};

global.localStorage = localStorageMock as Storage;

// Mock fetch for tests
global.fetch = async () => {
  throw new Error('Fetch not mocked for this test');
};

// Setup and teardown
beforeAll(() => {
  console.log('Starting test suite...');
});

afterEach(() => {
  // Clear any test data
  localStorage.clear();
});

afterAll(() => {
  console.log('Test suite completed.');
});