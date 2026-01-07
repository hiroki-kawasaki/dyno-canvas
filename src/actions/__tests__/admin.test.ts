/**
 * @jest-environment node
 */
import { mockClient } from 'aws-sdk-client-mock';
import {
    DynamoDBDocumentClient
} from '@aws-sdk/lib-dynamodb';
import {
    ListTablesCommand,
    CreateTableCommand,
    PutItemCommand,
    QueryCommand,
    DeleteItemCommand,
    CreateTableCommandInput,
    QueryCommandInput,
    PutItemCommandInput,
    DeleteItemCommandInput
} from '@aws-sdk/client-dynamodb';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import * as adminActions from '@/actions/admin';
import { AccessPatternConfig } from '@/types';

// Mock getSettings
jest.mock('@/actions/settings', () => ({
    getSettings: jest.fn().mockResolvedValue({ mode: 'aws', region: 'us-east-1' }),
}));

// Mock next/cache
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

const ddbMock = mockClient(DynamoDBDocumentClient);
const stsMock = mockClient(STSClient);

describe('Admin Actions', () => {
    beforeEach(() => {
        ddbMock.reset();
        stsMock.reset();
        jest.clearAllMocks();
    });

    it('checkAdminTableExists should return true if table exists', async () => {
        ddbMock.on(ListTablesCommand).resolves({ TableNames: ['dyno-canvas'] });
        const result = await adminActions.checkAdminTableExists();
        expect(result).toBe(true);
    });

    it('checkAdminTableExists should return false if table does not exist', async () => {
        ddbMock.on(ListTablesCommand).resolves({ TableNames: ['OtherTable'] });
        const result = await adminActions.checkAdminTableExists();
        expect(result).toBe(false);
    });

    it('createAdminTable should send CreateTableCommand', async () => {
        ddbMock.on(CreateTableCommand).resolves({});
        const result = await adminActions.createAdminTable();
        expect(result.success).toBe(true);
        expect(ddbMock.calls()).toHaveLength(1);
        const input = ddbMock.call(0).args[0].input as CreateTableCommandInput;
        expect(input.TableName).toBe('dyno-canvas');
    });

    it('getAccessPatternsForTable should query admin table', async () => {
        stsMock.on(GetCallerIdentityCommand).resolves({ Account: '123456789012' });
        ddbMock.on(QueryCommand).resolves({
            Items: [
                {
                    AccessPatternId: { S: 'p1' },
                    Label: { S: 'Pattern 1' },
                    PKFormat: { S: 'PK' },
                    SKFormat: { S: 'SK' }
                }
            ]
        });

        const result = await adminActions.getAccessPatternsForTable('MyTable');
        expect(result).toHaveLength(1);
        expect(result[0].AccessPatternId).toBe('p1');

        const input = ddbMock.call(0).args[0].input as QueryCommandInput;
        expect(input.ExpressionAttributeValues?.[':pk'].S).toContain('123456789012');
    });

    it('saveAccessPattern should put item to admin table', async () => {
        stsMock.on(GetCallerIdentityCommand).resolves({ Account: '123456789012' });
        ddbMock.on(PutItemCommand).resolves({});

        const config: AccessPatternConfig = {
            id: 'new-p',
            label: 'New Pattern',
            description: 'Desc',
            pkFormat: 'A',
            skFormat: 'B'
        };

        const result = await adminActions.saveAccessPattern('MyTable', config);
        expect(result.success).toBe(true);

        const input = ddbMock.call(0).args[0].input as PutItemCommandInput;
        expect(input.TableName).toBe('dyno-canvas');
        expect(input.Item?.AccessPatternId.S).toBe('new-p');
    });

    it('deleteAccessPattern should delete item from admin table', async () => {
        stsMock.on(GetCallerIdentityCommand).resolves({ Account: '123456789012' });
        ddbMock.on(DeleteItemCommand).resolves({});

        const result = await adminActions.deleteAccessPattern('MyTable', 'p1');
        expect(result.success).toBe(true);

        const input = ddbMock.call(0).args[0].input as DeleteItemCommandInput;
        expect(input.Key?.PK.S).toContain('123456789012');
    });
});
