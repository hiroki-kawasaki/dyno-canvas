/**
 * @jest-environment node
 */
import { mockClient } from 'aws-sdk-client-mock';
import {
    DynamoDBDocumentClient,
    PutCommand,
    BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    ListTablesCommand,
    CreateTableCommand,
    DeleteTableCommand,
    CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import * as dynamoActions from '@/actions/dynamo';

// Mock getSettings
jest.mock('@/actions/settings', () => ({
    getSettings: jest.fn().mockResolvedValue({ mode: 'aws', region: 'us-east-1' }),
}));

// Mock next/cache
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

// Mock Admin Actions
jest.mock('@/actions/admin', () => ({
    getAccessPatternsForTable: jest.fn(),
    saveAccessPattern: jest.fn(),
    deleteAccessPattern: jest.fn(),
}));

import * as adminActions from '@/actions/admin';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DynamoDB Actions', () => {
    beforeEach(() => {
        ddbMock.reset();
        jest.clearAllMocks();
    });

    describe('Table Operations', () => {
        it('listTables should return table names', async () => {
            ddbMock.on(ListTablesCommand).resolves({ TableNames: ['Table1', 'Table2'] });
            const result = await dynamoActions.listTables();
            expect(result).toEqual(['Table1', 'Table2']);
        });

        it('createTable should send CreateTableCommand', async () => {
            ddbMock.on(CreateTableCommand).resolves({});
            const result = await dynamoActions.createTable('NewTable');
            expect(result.success).toBe(true);
            expect(ddbMock.calls()).toHaveLength(1);
            const input = ddbMock.call(0).args[0].input as CreateTableCommandInput;
            expect(input.TableName).toBe('NewTable');
        });

        it('deleteTable should send DeleteTableCommand', async () => {
            // Mock local to allow deletion
            (require('@/actions/settings').getSettings as jest.Mock).mockResolvedValue({ mode: 'local', region: 'local' }); // eslint-disable-line @typescript-eslint/no-require-imports

            ddbMock.on(DeleteTableCommand).resolves({});
            const result = await dynamoActions.deleteTable('OldTable');
            expect(result.success).toBe(true);
            expect(ddbMock.calls()).toHaveLength(1);

            // Reset mock
            (require('@/actions/settings').getSettings as jest.Mock).mockResolvedValue({ mode: 'aws', region: 'us-east-1' }); // eslint-disable-line @typescript-eslint/no-require-imports
        });

        // ... inside Item CRUD
        it('createItem should handle overwrite error', async () => {
            ddbMock.on(PutCommand).rejects({ name: 'ConditionalCheckFailedException' });
            const item = { PK: 'A', SK: 'B' };
            const result = await dynamoActions.createItem('T', item);
            expect(result.success).toBe(false);
            expect(result.error).toBe("Item already exists or condition failed.");
        });

        // ... inside GSI
        it('deleteGSI should fail if not local (mocked as aws)', async () => {
            // Default mock is AWS
            const result = await dynamoActions.deleteGSI('T', 'Index1');
            expect(result.success).toBe(false);
            expect(result.error).toContain('is not allowed in this environment');
        });

        // ... inside Export/Import
        it('importItems should parse JSONL and batch write', async () => {
            ddbMock.on(BatchWriteCommand).resolves({});
            const lines = '{"Item":{"PK":{"S":"A"},"SK":{"S":"B"}}}\n{"Item":{"PK":{"S":"C"},"SK":{"S":"D"}}}';
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = {
                get: jest.fn().mockReturnValue(mockFile)
            } as unknown as FormData;

            const result = await dynamoActions.importItems('T', formData);
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
            expect(ddbMock.calls()).toHaveLength(1);
        });

        it('importItems should handle chunking', async () => {
            ddbMock.on(BatchWriteCommand).resolves({});
            // 30 lines
            const lines = Array.from({ length: 30 }, (_, i) => `{"Item":{"PK":{"S":"P${i}"},"SK":{"S":"S${i}"}}}`).join('\n');
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = { get: jest.fn().mockReturnValue(mockFile) } as unknown as FormData;

            const result = await dynamoActions.importItems('T', formData);
            expect(result.success).toBe(true);
            expect(result.count).toBe(30);
            expect(ddbMock.calls()).toHaveLength(2); // 25 + 5
        });

        it('importAccessPatterns should save each pattern', async () => {
            const lines = '{"Item":{"PK":{"S":"P1"},"SK":{"S":"S1"},"AccessPatternId":{"S":"id1"},"Label":{"S":"L1"},"PKFormat":{"S":"F1"}}}';
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = { get: jest.fn().mockReturnValue(mockFile) } as unknown as FormData;

            (adminActions.saveAccessPattern as jest.Mock).mockResolvedValue({ success: true });

            const result = await dynamoActions.importAccessPatterns('T', formData);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);
            expect(adminActions.saveAccessPattern).toHaveBeenCalled();
        });

        it('importAccessPatterns should return error on invalid content', async () => {
            const lines = '{"Item":{"AccessPatternId":{"S":"id1"}}}'; // Missing Label and PKFormat
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = { get: jest.fn().mockReturnValue(mockFile) } as unknown as FormData;

            const result = await dynamoActions.importAccessPatterns('T', formData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Errors:');
        });
    });
});