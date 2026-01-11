import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateTableModal from '@components/features/tables/CreateTableModal';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@actions/dynamodb';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

jest.mock('@actions/dynamodb', () => ({
    createTable: jest.fn(),
}));

const mockPush = jest.fn();

describe('CreateTableModal Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    });

    const renderWithContext = () => {
        return render(
            <UIProvider>
                <CreateTableModal />
            </UIProvider>
        );
    };

    it('opens modal and creates table', async () => {
        renderWithContext();

        const openBtn = screen.getByText(/New Table/i);
        fireEvent.click(openBtn);

        expect(screen.getByText('Create New Table')).toBeInTheDocument();

        const input = screen.getByPlaceholderText('MyTable');
        fireEvent.change(input, { target: { value: 'NewTable' } });

        (dynamoActions.createTable as jest.Mock).mockResolvedValue({ success: true });
        const createBtn = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(dynamoActions.createTable).toHaveBeenCalledWith('NewTable');
            expect(mockPush).toHaveBeenCalledWith('/tables/NewTable');
        });
    });

    it('handles error', async () => {
        renderWithContext();
        fireEvent.click(screen.getByText(/New Table/i));
        fireEvent.change(screen.getByPlaceholderText('MyTable'), { target: { value: 'ErrTable' } });

        (dynamoActions.createTable as jest.Mock).mockResolvedValue({ success: false, error: 'Fail' });

        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => {
            expect(dynamoActions.createTable).toHaveBeenCalled();
            expect(mockPush).not.toHaveBeenCalled();
            expect(screen.getByText('Create New Table')).toBeInTheDocument();
        });
    });
});
