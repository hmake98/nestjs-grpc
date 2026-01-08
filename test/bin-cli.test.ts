import fs from 'fs';
import path from 'path';

const bin = require('../bin/nestjs-grpc.js');

describe('bin/nestjs-grpc.js', () => {
    afterEach(() => jest.restoreAllMocks());

    it('prefers dist/src paths when present', () => {
        jest.spyOn(fs, 'existsSync').mockImplementation((p: string) => {
            const s = String(p);
            if (
                s.endsWith(`src${path.sep}cli${path.sep}cli.js`) ||
                s.endsWith(`src${path.sep}index.js`)
            ) {
                return true;
            }
            return false;
        });

        const found = bin.findCliModule();
        expect(found).toMatch(/src[\\/]cli[\\/]cli\.js|src[\\/]index\.js/);
    });

    it('falls back to top-level dist paths when present', () => {
        jest.spyOn(fs, 'existsSync').mockImplementation((p: string) => {
            const s = String(p);
            if (s.endsWith(`cli${path.sep}cli.js`) || s.endsWith(`index.js`)) {
                return true;
            }
            return false;
        });

        const found = bin.findCliModule();
        expect(found).toMatch(/cli[\\/]cli\.js|index\.js/);
    });
});
