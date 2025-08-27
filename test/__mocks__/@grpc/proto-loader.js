const load = jest.fn((protoPath, options = {}) => {
  // Default mock package definition
  const defaultPackageDefinition = {
    'test.TestService': {
      TestMethod: {
        path: '/test.TestService/TestMethod',
        requestStream: false,
        responseStream: false,
        originalName: 'TestMethod',
        requestType: {
          type: 'TestRequest',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
        responseType: {
          type: 'TestResponse',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
      },
      TestStreamMethod: {
        path: '/test.TestService/TestStreamMethod',
        requestStream: false,
        responseStream: true,
        originalName: 'TestStreamMethod',
        requestType: {
          type: 'TestRequest',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
        responseType: {
          type: 'TestResponse',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
      },
      TestClientStreamMethod: {
        path: '/test.TestService/TestClientStreamMethod',
        requestStream: true,
        responseStream: false,
        originalName: 'TestClientStreamMethod',
        requestType: {
          type: 'TestRequest',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
        responseType: {
          type: 'TestResponse',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
      },
      TestBidiStreamMethod: {
        path: '/test.TestService/TestBidiStreamMethod',
        requestStream: true,
        responseStream: true,
        originalName: 'TestBidiStreamMethod',
        requestType: {
          type: 'TestRequest',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
        responseType: {
          type: 'TestResponse',
          format: 'Protocol Buffer 3 DescriptorProto',
        },
      },
    },
  };

  // Return mock package definition based on the proto path
  if (protoPath.includes('invalid')) {
    throw new Error('Invalid proto file');
  } else if (protoPath.includes('empty')) {
    return {};
  } else if (protoPath.includes('malformed')) {
    throw new Error('Malformed proto file');
  } else {
    return defaultPackageDefinition;
  }
});

// Utility for tests to configure mock behavior
const __setMockResponse = (response) => {
  load.mockReturnValue(response);
};

const __setMockError = (error) => {
  load.mockImplementation(() => {
    throw error;
  });
};

const __resetMocks = () => {
  load.mockClear();
  load.mockImplementation((protoPath, options = {}) => {
    const defaultPackageDefinition = {
      'test.TestService': {
        TestMethod: {
          path: '/test.TestService/TestMethod',
          requestStream: false,
          responseStream: false,
          originalName: 'TestMethod',
          requestType: {
            type: 'TestRequest',
            format: 'Protocol Buffer 3 DescriptorProto',
          },
          responseType: {
            type: 'TestResponse',
            format: 'Protocol Buffer 3 DescriptorProto',
          },
        },
      },
    };
    return defaultPackageDefinition;
  });
};

module.exports = {
  load,
  __setMockResponse,
  __setMockError,
  __resetMocks,
};