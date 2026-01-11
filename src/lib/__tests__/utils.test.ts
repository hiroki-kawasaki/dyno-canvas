import { parsePlaceholders, toSnakeCase, sortDynamoItemKeys } from '@lib/utils';

describe('Utility Functions', () => {
    describe('parsePlaceholders', () => {
        it('should extract variables from a format string', () => {
            const format = 'USER#{userId}#wf#{workflowId}';
            const result = parsePlaceholders(format);
            expect(result).toEqual(['userId', 'workflowId']);
        });

        it('should return an empty array if no placeholders exist', () => {
            const format = 'USER#mw#admin';
            const result = parsePlaceholders(format);
            expect(result).toEqual([]);
        });

        it('should handle undefined input', () => {
            expect(parsePlaceholders(undefined)).toEqual([]);
        });
    });

    describe('toSnakeCase', () => {
        it('should convert camelCase to snake_case', () => {
            expect(toSnakeCase('userId')).toBe('user_id');
            expect(toSnakeCase('myVariableName')).toBe('my_variable_name');
        });
    });

    describe('sortDynamoItemKeys', () => {
        it('should prioritize PK and SK', () => {
            const item = {
                name: 'test',
                SK: '123',
                age: 20,
                PK: 'USER'
            };
            const sorted = sortDynamoItemKeys(item);
            const keys = Object.keys(sorted);

            expect(keys[0]).toBe('PK');
            expect(keys[1]).toBe('SK');
            // The order of other keys depends on implementation, but PK/SK must be first
        });
    });
});