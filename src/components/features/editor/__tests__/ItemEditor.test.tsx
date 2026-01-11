import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ItemEditor from '@components/features/editor/ItemEditor';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@actions/dynamodb';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

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

jest.mock('@actions/dynamodb', () => ({
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
        const initialData = { PK: 'A', SK: 'B', tags: new Set(['tag1', 'tag2']) };
        renderWithContext(
            <ItemEditor tableName="TestTable" initialData={initialData} />
        );

        const dynamoTab = screen.getByText('DynamoDB JSON');
        expect(dynamoTab).toHaveClass('bg-blue-600');

        const editor = screen.getByTestId('monaco-editor-mock') as HTMLTextAreaElement;
        expect(editor.value).toContain('"SS":');
    });
});