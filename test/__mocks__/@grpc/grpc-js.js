const { EventEmitter } = require('events');

// Mock gRPC status codes
const status = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
};

// Mock stream class
class MockStream extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.cancelled = false;
    this.metadata = null;
  }

  write(data) {
    if (!this.cancelled) {
      process.nextTick(() => this.emit('data', data));
    }
    return !this.cancelled;
  }

  end(data) {
    if (data) {
      this.write(data);
    }
    process.nextTick(() => {
      if (!this.cancelled) {
        this.emit('end');
      }
    });
  }

  cancel() {
    this.cancelled = true;
    this.emit('cancelled');
  }

  destroy() {
    this.cancelled = true;
    this.emit('close');
  }
}

// Mock client class
class MockClient {
  constructor(address, credentials, options = {}) {
    this.address = address;
    this.credentials = credentials;
    this.options = options;
    this.connected = false;
  }

  makeUnaryRequest(method, serialize, deserialize, argument, metadata, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    process.nextTick(() => {
      if (this.options.shouldFailUnary) {
        const error = new Error('Mock unary error');
        error.code = this.options.failureCode || status.INTERNAL;
        error.metadata = metadata;
        callback(error);
      } else {
        const mockResponse = this.options.mockUnaryResponse || { success: true };
        callback(null, mockResponse, metadata);
      }
    });
  }

  makeServerStreamRequest(method, serialize, deserialize, argument, metadata, options) {
    const stream = new MockStream();
    
    process.nextTick(() => {
      if (this.options.shouldFailServerStream) {
        const error = new Error('Mock server stream error');
        error.code = this.options.failureCode || status.INTERNAL;
        stream.emit('error', error);
      } else {
        const responses = this.options.mockServerStreamResponses || [{ data: 'stream1' }, { data: 'stream2' }];
        responses.forEach((response, index) => {
          setTimeout(() => stream.write(response), index * 10);
        });
        setTimeout(() => stream.end(), responses.length * 10 + 10);
      }
    });

    return stream;
  }

  makeClientStreamRequest(method, serialize, deserialize, metadata, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const stream = new MockStream();

    process.nextTick(() => {
      if (this.options.shouldFailClientStream) {
        const error = new Error('Mock client stream error');
        error.code = this.options.failureCode || status.INTERNAL;
        stream.emit('error', error);
      } else {
        stream.on('end', () => {
          const mockResponse = this.options.mockClientStreamResponse || { success: true };
          callback(null, mockResponse, metadata);
        });
      }
    });

    return stream;
  }

  makeBidiStreamRequest(method, serialize, deserialize, metadata, options) {
    const stream = new MockStream();

    process.nextTick(() => {
      if (this.options.shouldFailBidiStream) {
        const error = new Error('Mock bidi stream error');
        error.code = this.options.failureCode || status.INTERNAL;
        stream.emit('error', error);
      } else {
        // Echo back any data written to the stream
        stream.on('write', (data) => {
          process.nextTick(() => stream.emit('data', data));
        });
      }
    });

    return stream;
  }

  close() {
    this.connected = false;
  }

  getChannel() {
    return {
      getConnectivityState: () => 2, // READY
      watchConnectivityState: (currentState, deadline, callback) => {
        process.nextTick(callback);
      },
      createCall: jest.fn(),
      close: jest.fn(),
    };
  }
}

// Mock credentials
const credentials = {
  createInsecure: jest.fn(() => ({ _isInsecure: true })),
  createSsl: jest.fn(() => ({ _isSsl: true })),
  combineChannelCredentials: jest.fn(),
  combineCallCredentials: jest.fn(),
};

// Mock metadata
class MockMetadata {
  constructor() {
    this._internal = new Map();
  }

  add(key, value) {
    if (!this._internal.has(key)) {
      this._internal.set(key, []);
    }
    this._internal.get(key).push(value);
  }

  set(key, value) {
    this._internal.set(key, Array.isArray(value) ? value : [value]);
  }

  get(key) {
    return this._internal.get(key) || [];
  }

  remove(key) {
    this._internal.delete(key);
  }

  clone() {
    const cloned = new MockMetadata();
    for (const [key, value] of this._internal) {
      cloned._internal.set(key, [...value]);
    }
    return cloned;
  }

  toJSON() {
    const result = {};
    for (const [key, value] of this._internal) {
      result[key] = value;
    }
    return result;
  }
}

// Mock loadPackageDefinition
const loadPackageDefinition = jest.fn((packageDefinition) => {
  const mockService = {
    TestService: MockClient,
    service: {
      TestMethod: {
        path: '/test.TestService/TestMethod',
        requestStream: false,
        responseStream: false,
        requestType: {},
        responseType: {},
        requestSerialize: jest.fn(),
        requestDeserialize: jest.fn(),
        responseSerialize: jest.fn(),
        responseDeserialize: jest.fn(),
      },
    },
  };

  return mockService;
});

module.exports = {
  loadPackageDefinition,
  credentials,
  status,
  Metadata: MockMetadata,
  Client: MockClient,
  
  // Utility for tests to configure mock behavior
  __setMockBehavior: (behavior) => {
    MockClient.prototype.options = { ...MockClient.prototype.options, ...behavior };
  },
  
  // Reset mocks
  __resetMocks: () => {
    MockClient.prototype.options = {};
    jest.clearAllMocks();
  },
};