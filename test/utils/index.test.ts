import * as utils from '../../src/utils';

describe('utils/index', () => {
    it('should export all utilities', () => {
        expect(utils.loadProto).toBeDefined();
        expect(utils.createChannelOptions).toBeDefined();
        expect(utils.createClientCredentials).toBeDefined();
        expect(utils.GrpcLogger).toBeDefined();
        expect(utils.generateTypeDefinitions).toBeDefined();
        expect(utils.mapProtoTypeToTs).toBeDefined();
    });
});