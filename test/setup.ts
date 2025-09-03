import 'reflect-metadata';
import { safeCleanupTimers } from './__mocks__/timer-utils';

// Global test setup
beforeAll(() => {
    // Set up global test environment
    process.env.NODE_ENV = 'test';

    // Set reasonable timeout for tests
    jest.setTimeout(10000);
});

beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Clear all timers to prevent leaks
    jest.clearAllTimers();

    // Use real timers by default to avoid hanging
    jest.useRealTimers();

    // Clear managed timers
    safeCleanupTimers();
});

afterEach(async () => {
    // Clean up after each test
    // Clear any remaining timers
    jest.clearAllTimers();

    // Ensure real timers are used
    jest.useRealTimers();

    // Clear managed timers
    safeCleanupTimers();

    // Clear any remaining handles
    if (global.gc) {
        global.gc();
    }

    // Small delay to ensure cleanup - use shorter timeout
    await new Promise(resolve => setTimeout(resolve, 1));
});

afterAll(async () => {
    // Clean up after all tests
    // Clear all timers
    jest.clearAllTimers();

    // Restore real timers
    jest.useRealTimers();

    // Clear managed timers
    safeCleanupTimers();

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }

    // Clear any remaining handles
    await new Promise(resolve => setImmediate(resolve));
});

// Global mocks
jest.mock('@grpc/grpc-js', () => ({
    loadPackageDefinition: jest.fn(),
    credentials: {
        createInsecure: jest.fn(),
        createSsl: jest.fn(),
    },
    Metadata: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
    })),
    status: {
        INTERNAL: 13,
        UNAVAILABLE: 14,
        DEADLINE_EXCEEDED: 4,
        OK: 0,
    },
}));

jest.mock('@grpc/proto-loader', () => ({
    load: jest.fn(),
}));

jest.mock('protobufjs', () => ({
    load: jest.fn(),
    Root: jest.fn(),
}));

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeAll(() => {
    // Suppress console.log and console.info in tests unless explicitly needed
    console.log = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
});

afterAll(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

// Ensure cleanup on process exit
process.on('exit', () => {
    safeCleanupTimers();
});

process.on('SIGINT', () => {
    safeCleanupTimers();
    process.exit(0);
});

process.on('SIGTERM', () => {
    safeCleanupTimers();
    process.exit(0);
});
