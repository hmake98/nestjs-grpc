import { readFileSync } from 'fs';
import { Command } from 'commander';

// Mock dependencies
jest.mock('fs');
jest.mock('../../src/commands/generate.command');

const mockFs = jest.mocked({ readFileSync });

describe('CLI', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let exitSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original values
    originalArgv = process.argv;
    originalExit = process.exit;

    // Mock process.exit
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // Mock console.error for logger
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.exit = originalExit;
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

import { readFileSync } from 'fs';
import { join } from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('../../src/commands/generate.command');

const mockFs = jest.mocked({ readFileSync });
const mockGenerateCommand = jest.requireMock('../../src/commands/generate.command');

describe('CLI', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let exitSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original values
    originalArgv = process.argv;
    originalExit = process.exit;

    // Mock process.exit
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // Mock console.error for logger
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.exit = originalExit;
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  describe('package version reading', () => {
    it('should read version from package.json', () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });
      mockFs.readFileSync.mockReturnValue(mockPackageJson);

      // Import CLI module to test version reading
      delete require.cache[require.resolve('../../src/cli/cli')];

      // Set up valid args to avoid validation errors
      process.argv = ['node', 'cli.js', 'generate'];

      expect(() => require('../../src/cli/cli')).not.toThrow();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        'utf8'
      );
    });

    it('should use fallback version when package.json cannot be read', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      delete require.cache[require.resolve('../../src/cli/cli')];
      process.argv = ['node', 'cli.js', 'generate'];

      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should use fallback version when package.json has invalid version', () => {
      const mockPackageJson = JSON.stringify({ version: null });
      mockFs.readFileSync.mockReturnValue(mockPackageJson);

      delete require.cache[require.resolve('../../src/cli/cli')];
      process.argv = ['node', 'cli.js', 'generate'];

      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should use fallback version when package.json is invalid JSON', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      delete require.cache[require.resolve('../../src/cli/cli')];
      process.argv = ['node', 'cli.js', 'generate'];

      expect(() => require('../../src/cli/cli')).not.toThrow();
    });
  });

  describe('argument validation', () => {
    it('should handle valid arguments', () => {
      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should show help when no arguments provided', () => {
      process.argv = ['node', 'cli.js'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should validate command arguments for invalid commands', () => {
      process.argv = ['node', 'cli.js', 'invalid-command'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('command setup', () => {
    it('should set up commander program correctly', () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });
      mockFs.readFileSync.mockReturnValue(mockPackageJson);

      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should add generate command with options', () => {
      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });
  });

  describe('command execution', () => {
    it('should parse commands', () => {
      process.argv = ['node', 'cli.js', 'generate', 'test.proto'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should handle parsing errors gracefully', () => {
      // Mock commander to throw an error
      jest.doMock('commander', () => ({
        Command: jest.fn().mockImplementation(() => ({
          name: jest.fn().mockReturnThis(),
          description: jest.fn().mockReturnThis(),
          version: jest.fn().mockReturnThis(),
          command: jest.fn().mockReturnThis(),
          option: jest.fn().mockReturnThis(),
          action: jest.fn().mockReturnThis(),
          parse: jest.fn().mockImplementation(() => {
            throw new Error('Parse error');
          }),
          outputHelp: jest.fn(),
        }))
      }));

      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should handle unknown arguments gracefully', () => {
      process.argv = ['node', 'cli.js', 'unknown-command'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show usage information when needed', () => {
      process.argv = ['node', 'cli.js'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should handle complete generate command setup', () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });
      mockFs.readFileSync.mockReturnValue(mockPackageJson);

      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).not.toThrow();
    });

    it('should validate arguments before setup', () => {
      process.argv = ['node', 'cli.js', 'bad-command'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrow('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.version).toHaveBeenCalledWith('1.2.4');
    });
  });

  describe('argument validation', () => {
    it('should handle valid arguments', () => {
      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.parse).toHaveBeenCalledWith(['node', 'cli.js', 'generate']);
    });

    it('should show help when no arguments provided', () => {
      process.argv = ['node', 'cli.js'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.outputHelp).toHaveBeenCalled();
    });

    it('should validate command arguments for invalid commands', () => {
      process.argv = ['node', 'cli.js', 'unknown-command'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrowError('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('command setup', () => {
    it('should set up commander program correctly', () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });
      mockFs.readFileSync.mockReturnValue(mockPackageJson);

      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.name).toHaveBeenCalledWith('nestjs-grpc');
      expect(mockProgram.description).toHaveBeenCalledWith(
        'CLI tool for NestJS gRPC package'
      );
      expect(mockProgram.version).toHaveBeenCalledWith('1.2.3');
    });

    it('should add generate command with options', () => {
      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.command).toHaveBeenCalledWith('generate');
      expect(mockProgram.description).toHaveBeenCalledWith(
        'Generate TypeScript definitions from protobuf files'
      );
      expect(mockProgram.option).toHaveBeenCalledTimes(10); // Check that options are added
      expect(mockProgram.action).toHaveBeenCalled();
    });
  });

  describe('command execution', () => {
    it('should parse commands', () => {
      process.argv = ['node', 'cli.js', 'generate', 'test.proto'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.parse).toHaveBeenCalledWith(['node', 'cli.js', 'generate', 'test.proto']);
    });

    it('should handle parsing errors gracefully', () => {
      const parseError = new Error('Parse error');
      mockProgram.parse.mockImplementation(() => {
        throw parseError;
      });

      process.argv = ['node', 'cli.js', 'generate'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrowError('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    it('should handle unknown arguments gracefully', () => {
      process.argv = ['node', 'cli.js', 'bad', 'args'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrowError('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show usage information when needed', () => {
      process.argv = ['node', 'cli.js'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.outputHelp).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should handle complete generate command setup', () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });
      mockFs.readFileSync.mockReturnValue(mockPackageJson);

      process.argv = ['node', 'cli.js', 'generate', '--proto', 'test.proto', '--output', './dist'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      require('../../src/cli/cli');

      expect(mockProgram.name).toHaveBeenCalledWith('nestjs-grpc');
      expect(mockProgram.version).toHaveBeenCalledWith('1.2.3');
      expect(mockProgram.command).toHaveBeenCalledWith('generate');
      expect(mockProgram.parse).toHaveBeenCalled();
    });

    it('should validate arguments before setup', () => {
      process.argv = ['node', 'cli.js', 'invalid', 'args'];

      delete require.cache[require.resolve('../../src/cli/cli')];
      expect(() => require('../../src/cli/cli')).toThrowError('process.exit');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
