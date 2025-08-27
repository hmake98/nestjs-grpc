class MockRoot {
  constructor() {
    this.nested = {};
    this.files = [];
  }

  static fromJSON(json) {
    const root = new MockRoot();
    root.nested = json.nested || {};
    return root;
  }

  lookup(path) {
    const parts = path.split('.');
    let current = this.nested;
    
    for (const part of parts) {
      if (current[part]) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return current;
  }

  lookupService(path) {
    const service = this.lookup(path);
    if (service && service.methods) {
      return service;
    }
    return null;
  }

  lookupType(path) {
    const type = this.lookup(path);
    if (type && type.fields) {
      return type;
    }
    return null;
  }

  resolveAll() {
    return this;
  }
}

const load = jest.fn((filename, options = {}) => {
  return Promise.resolve({
    nested: {
      test: {
        TestService: {
          methods: {
            TestMethod: {
              requestType: 'TestRequest',
              responseType: 'TestResponse',
              requestStream: false,
              responseStream: false,
            },
            TestStreamMethod: {
              requestType: 'TestRequest',
              responseType: 'TestResponse',
              requestStream: false,
              responseStream: true,
            },
          },
        },
      },
    },
  });
});

const Root = MockRoot;

// Utility functions for tests
const __setMockResponse = (response) => {
  load.mockResolvedValue(response);
};

const __setMockError = (error) => {
  load.mockRejectedValue(error);
};

const __resetMocks = () => {
  load.mockClear();
  load.mockResolvedValue({
    nested: {
      test: {
        TestService: {
          methods: {
            TestMethod: {
              requestType: 'TestRequest',
              responseType: 'TestResponse',
              requestStream: false,
              responseStream: false,
            },
          },
        },
      },
    },
  });
};

module.exports = {
  load,
  Root,
  __setMockResponse,
  __setMockError,
  __resetMocks,
};