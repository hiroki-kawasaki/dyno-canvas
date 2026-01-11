/**
 * @jest-environment node
 */
import { mockClient } from 'aws-sdk-client-mock';
import {
    DynamoDBDocumentClient,
    PutCommand,
    BatchWriteCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    ListTablesCommand,
    CreateTableCommand,
    DeleteTableCommand,
    UpdateTableCommand,
    CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import * as dynamoActions from '@actions/dynamodb';

jest.mock('@actions/settings', () => ({
    getSettings: jest.fn().mockResolvedValue({ mode: 'aws', region: 'us-east-1' }),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

jest.mock('@actions/admin', () => ({
    getAccessPatternsForTable: jest.fn(),
    saveAccessPattern: jest.fn(),
    deleteAccessPattern: jest.fn(),
}));

import * as adminActions from '@actions/admin';

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
            (require('@actions/settings').getSettings as jest.Mock).mockResolvedValue({ mode: 'local', region: 'local' }); // eslint-disable-line @typescript-eslint/no-require-imports

            ddbMock.on(DeleteTableCommand).resolves({});
            const result = await dynamoActions.deleteTable('OldTable');
            expect(result.success).toBe(true);
            expect(ddbMock.calls()).toHaveLength(1);

            (require('@actions/settings').getSettings as jest.Mock).mockResolvedValue({ mode: 'aws', region: 'us-east-1' }); // eslint-disable-line @typescript-eslint/no-require-imports
        });

        it('createItem should handle overwrite error', async () => {
            ddbMock.on(PutCommand).rejects({ name: 'ConditionalCheckFailedException' });
            const item = { PK: 'A', SK: 'B' };
            const result = await dynamoActions.createItem('TestTable', item);
            expect(result.success).toBe(false);
            expect(result.error).toBe("Item already exists or condition failed.");
        });

        it('updateItem should send UpdateCommand with correct expression', async () => {
            ddbMock.on(UpdateCommand).resolves({});
            const item = { PK: 'A', SK: 'B', Name: 'NewName', Age: 30 };
            const result = await dynamoActions.updateItem('TestTable', item);
            expect(result.success).toBe(true);
            expect(ddbMock.calls()).toHaveLength(1);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const input = ddbMock.call(0).args[0].input as any;
            expect(input.TableName).toBe('TestTable');
            expect(input.Key).toEqual({ PK: 'A', SK: 'B' });
            expect(input.UpdateExpression).toContain('SET');
            expect(Object.keys(input.ExpressionAttributeNames)).toHaveLength(2);
            expect(Object.keys(input.ExpressionAttributeValues)).toHaveLength(2);
        });

        it('updateItem should return message if no attributes to update', async () => {
            const item = { PK: 'A', SK: 'B' };
            const result = await dynamoActions.updateItem('TestTable', item);
            expect(result.success).toBe(true);
            expect(result.message).toBe("No attributes to update.");
            expect(ddbMock.calls()).toHaveLength(0);
        });

        it('deleteGSI should succeed even if not local', async () => {
            ddbMock.on(UpdateTableCommand).resolves({});
            const result = await dynamoActions.deleteGSI('TestTable', 'Index1');
            expect(result.success).toBe(true);
        });

        it('importItems should parse JSONL and batch write', async () => {
            ddbMock.on(BatchWriteCommand).resolves({});
            const lines = '{"Item":{"PK":{"S":"A"},"SK":{"S":"B"}}}\n{"Item":{"PK":{"S":"C"},"SK":{"S":"D"}}}';
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = {
                get: jest.fn().mockReturnValue(mockFile)
            } as unknown as FormData;

            const result = await dynamoActions.importItems('TestTable', formData);
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
            expect(ddbMock.calls()).toHaveLength(1);
        });

        it('importItems should handle chunking', async () => {
            ddbMock.on(BatchWriteCommand).resolves({});
            const lines = Array.from({ length: 30 }, (_, i) => `{"Item":{"PK":{"S":"P${i}"},"SK":{"S":"S${i}"}}}`).join('\n');
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = { get: jest.fn().mockReturnValue(mockFile) } as unknown as FormData;

            const result = await dynamoActions.importItems('TestTable', formData);
            expect(result.success).toBe(true);
            expect(result.count).toBe(30);
            expect(ddbMock.calls()).toHaveLength(2);
        });

        it('importAccessPatterns should save each pattern', async () => {
            const lines = '{"Item":{"PK":{"S":"P1"},"SK":{"S":"S1"},"AccessPatternId":{"S":"id1"},"Label":{"S":"L1"},"PKFormat":{"S":"F1"}}}';
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = { get: jest.fn().mockReturnValue(mockFile) } as unknown as FormData;

            (adminActions.saveAccessPattern as jest.Mock).mockResolvedValue({ success: true });

            const result = await dynamoActions.importAccessPatterns('TestTable', formData);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);
            expect(adminActions.saveAccessPattern).toHaveBeenCalled();
        });

        it('importAccessPatterns should return error on invalid content', async () => {
            const lines = '{"Item":{"AccessPatternId":{"S":"id1"}}}';
            const mockFile = {
                stream: () => new Blob([lines]).stream()
            } as unknown as File;
            const formData = { get: jest.fn().mockReturnValue(mockFile) } as unknown as FormData;

            const result = await dynamoActions.importAccessPatterns('TestTable', formData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Errors:');
        });
    });
});