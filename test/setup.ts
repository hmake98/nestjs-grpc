import 'reflect-metadata';

// Global test setup
beforeAll(() => {
    // Set up global test environment
    process.env.NODE_ENV = 'test';
});

beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
});

afterEach(() => {
    // Clean up after each test
    // Note: Individual tests should manage their own timers
});

afterAll(() => {
    // Clean up after all tests
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
