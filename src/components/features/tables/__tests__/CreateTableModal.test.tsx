import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateTableModal from '@components/features/tables/CreateTableModal';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@actions/dynamodb';
import { useRouter } from 'next/navigation';

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}));

// Mock Actions
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

        // Open modal
        const openBtn = screen.getByText(/New Table/i);
        fireEvent.click(openBtn);

        expect(screen.getByText('Create New Table')).toBeInTheDocument();

        // Fill form
        const input = screen.getByPlaceholderText('MyTable');
        fireEvent.change(input, { target: { value: 'NewTable' } });

        // Submit
        (dynamoActions.createTable as jest.Mock).mockResolvedValue({ success: true });
        // The button text is "Create" (t.createTable.create) which is "Create" in English.
        // Wait, "Create" might match Title "Create New Table" if I use getByText strictly.
        // I will use selector or getAllByText
        const createBtn = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(dynamoActions.createTable).toHaveBeenCalledWith('NewTable');
            expect(mockPush).toHaveBeenCalledWith('/tables/NewTable');
            // Modal closed (button to open is back)
            // But waitFor might not catch re-render immediately if using getByText
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
            // Expect toast error (mocked UIProvider usually logs or we can't easily check without custom mock)
            // But we can check that modal is still open?
            expect(screen.getByText('Create New Table')).toBeInTheDocument();
        });
    });
});
