import 'reflect-metadata';

// Global test setup
beforeAll(() => {
    // Set up global test environment
    process.env.NODE_ENV = 'test';
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
}));

jest.mock('@grpc/proto-loader', () => ({
    load: jest.fn(),
}));

jest.mock('protobufjs', () => ({
    load: jest.fn(),
    Root: jest.fn(),
}));
