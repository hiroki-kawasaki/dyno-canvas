import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TableDashboard from '@components/features/dashboard/TableDashboard';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@actions/dynamodb';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
    usePathname: jest.fn(),
}));

jest.mock('@actions/dynamodb', () => ({
    searchItems: jest.fn(),
    getAccessPatterns: jest.fn(),
    deleteItem: jest.fn(),
    batchDeleteItems: jest.fn(),
    getSearchCount: jest.fn(),
    exportAllItems: jest.fn(),
    getTableDetails: jest.fn(),
    createTable: jest.fn()
}));

const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();

describe('TableDashboard Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
        (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
        (usePathname as jest.Mock).mockReturnValue('/tables/TestTable');

        (dynamoActions.getAccessPatterns as jest.Mock).mockResolvedValue([]);
        (dynamoActions.getTableDetails as jest.Mock).mockResolvedValue({
            success: true,
            table: { GlobalSecondaryIndexes: [] }
        });
    });

    const renderWithContext = (component: React.ReactNode) => {
        return render(
            <UIProvider>
                {component}
            </UIProvider>
        );
    };

    it('renders correctly in free mode', async () => {
        renderWithContext(<TableDashboard tableName="TestTable" mode="free" adminTableExists={true} />);

        await waitFor(() => {
            expect(screen.getByText('Free Search')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('e.g. USER#123')).toBeInTheDocument();
        });
    });

    it('performs search in free mode', async () => {
        (dynamoActions.searchItems as jest.Mock).mockResolvedValue({
            success: true,
            data: [{ PK: 'A', SK: 'B', name: 'TestItem' }]
        });

        renderWithContext(<TableDashboard tableName="TestTable" mode="free" adminTableExists={true} />);

        const pkInput = screen.getByPlaceholderText('e.g. USER#123');
        fireEvent.change(pkInput, { target: { value: 'A' } });

        const searchButton = screen.getByText('Search');
        fireEvent.click(searchButton);

        await waitFor(() => {
            expect(dynamoActions.searchItems).toHaveBeenCalledWith(expect.objectContaining({
                tableName: 'TestTable',
                mode: 'DIRECT',
                pkInput: 'A'
            }));
            expect(screen.getByText(/TestItem/)).toBeInTheDocument();
        });
    });

    it('handles delete item', async () => {
        (dynamoActions.searchItems as jest.Mock).mockResolvedValue({
            success: true,
            data: [{ PK: 'A', SK: 'B' }]
        });

        renderWithContext(<TableDashboard tableName="TestTable" mode="free" adminTableExists={true} />);

        const pkInput = screen.getByPlaceholderText('e.g. USER#123');
        fireEvent.change(pkInput, { target: { value: 'A' } });
        fireEvent.click(screen.getByText('Search'));

        await waitFor(() => screen.getByText('A'));

        const deleteButton = screen.getByTitle('Delete');
        fireEvent.click(deleteButton);

        const confirmBtn = await screen.findByText('Confirm', { selector: 'button' });

        (dynamoActions.deleteItem as jest.Mock).mockResolvedValue({ success: true });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(dynamoActions.deleteItem).toHaveBeenCalledWith('TestTable', 'A', 'B');
        });
    });

    it('updates URL on search', async () => {
        renderWithContext(<TableDashboard tableName="TestTable" mode="free" adminTableExists={true} />);

        const pkInput = screen.getByPlaceholderText('e.g. USER#123');
        fireEvent.change(pkInput, { target: { value: 'KEY' } });

        const form = screen.getByRole('button', { name: 'Search' }).closest('form');
        fireEvent.submit(form!);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('pk=KEY'));
        });
    });
    it('hides actions in read-only mode', async () => {
        (dynamoActions.searchItems as jest.Mock).mockResolvedValue({
            success: true,
            data: [{ PK: 'A', SK: 'B' }]
        });

        renderWithContext(<TableDashboard tableName="TestTable" mode="free" adminTableExists={true} readOnly={true} />);

        fireEvent.change(screen.getByPlaceholderText('e.g. USER#123'), { target: { value: 'A' } });
        fireEvent.click(screen.getByText('Search'));

        await waitFor(() => screen.getByText('A'));

        expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
        expect(screen.queryByText('Import')).not.toBeInTheDocument();
    });
});
