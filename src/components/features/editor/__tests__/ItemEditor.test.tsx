import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ItemEditor from '@/components/features/editor/ItemEditor';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@/actions/dynamo';
import { useRouter } from 'next/navigation';

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock Monaco Editor since it doesn't run in JSDOM
jest.mock('@monaco-editor/react', () => {
    return {
        __esModule: true,
        default: ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
            return (
                <textarea
                    data-testid="monaco-editor-mock"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
        },
    };
});

// Mock Actions
jest.mock('@/actions/dynamo', () => ({
    createItem: jest.fn(),
    updateItem: jest.fn(),
    replaceItem: jest.fn(),
}));

const mockClose = jest.fn();
const mockPush = jest.fn();

const renderWithContext = (component: React.ReactNode) => {
    return render(
        <UIProvider>
            {component}
        </UIProvider>
    );
};

describe('ItemEditor Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    });

    it('should render correctly with initial data', () => {
        const initialData = { PK: 'USER#1', SK: 'A', name: 'Test' };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} onClose={mockClose} />
        );

        expect(screen.getByText(/JSON Editor/)).toBeInTheDocument();
        const editor = screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement;
        expect(editor.value).toContain('USER#1');
    });

    it('should call updateItem when saving an existing item', async () => {
        (dynamoActions.updateItem as jest.Mock).mockResolvedValue({ success: true });

        const initialData = { PK: 'USER#1', SK: 'A' };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} onClose={mockClose} />
        );

        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(dynamoActions.updateItem).toHaveBeenCalled();
        });
    });

    it('should call createItem in create mode', async () => {
        (dynamoActions.createItem as jest.Mock).mockResolvedValue({ success: true });
        const initialData = { PK: 'NEW', SK: 'ITEM' };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} isCreateMode={true} />
        );

        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(dynamoActions.createItem).toHaveBeenCalled();
            expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('pk=NEW'));
        });
    });

    it('should call replaceItem when PK/SK is changed', async () => {
        (dynamoActions.replaceItem as jest.Mock).mockResolvedValue({ success: true });
        const initialData = { PK: 'OLD', SK: 'KEY' };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} onClose={mockClose} />
        );

        const editor = screen.getByTestId('monaco-editor-mock');
        fireEvent.change(editor, { target: { value: JSON.stringify({ PK: 'NEW', SK: 'KEY' }) } });

        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        // Confirm dialog should appear
        const confirmBtn = await screen.findByText('Confirm', { selector: 'button' });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(dynamoActions.replaceItem).toHaveBeenCalledWith(
                'TestTable',
                { PK: 'OLD', SK: 'KEY' },
                { PK: 'NEW', SK: 'KEY' }
            );
        });
    });

    it('should validate JSON before saving', async () => {
        const initialData = { PK: 'USER#1', SK: 'A' };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} />
        );

        const editor = screen.getByTestId('monaco-editor-mock');
        fireEvent.change(editor, { target: { value: '{ "invalid": }' } });

        expect(screen.getByText('Invalid JSON format')).toBeInTheDocument();
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeDisabled();
    });

    it('should automatically switch to DynamoDB JSON mode when item has Sets', () => {
        // Items coming from getClient in app are unmarshalled, so Sets are real Set objects
        const initialData = { PK: 'A', SK: 'B', tags: new Set(['tag1', 'tag2']) };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} />
        );

        // Should find "DynamoDB JSON" active
        const dynamoTab = screen.getByText('DynamoDB JSON');
        expect(dynamoTab).toHaveClass('bg-blue-600');

        // Editor content should be marshalled JSON
        const editor = screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement;
        expect(editor.value).toContain('"SS":');
    });
});