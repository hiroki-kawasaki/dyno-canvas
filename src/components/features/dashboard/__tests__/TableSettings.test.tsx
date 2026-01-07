import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TableSettings from '@/components/features/dashboard/TableSettings';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@/actions/dynamo';
import { AccessPatternConfig } from '@/types';

// Mock Actions
jest.mock('@/actions/dynamo', () => ({
    getTableDetails: jest.fn(),
    upsertAccessPattern: jest.fn(),
    deleteAccessPattern: jest.fn(),
    exportAccessPatterns: jest.fn(),
    createGSI: jest.fn(),
    deleteGSI: jest.fn(),
    updateTTL: jest.fn()
}));

const mockClose = jest.fn();
const mockUpdate = jest.fn();

const mockPatterns: AccessPatternConfig[] = [
    { id: 'p1', label: 'Pattern 1', pkFormat: 'A', skFormat: 'B', description: '' }
];

describe('TableSettings Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (dynamoActions.getTableDetails as jest.Mock).mockResolvedValue({
            success: true,
            table: { GlobalSecondaryIndexes: [] },
            ttl: { TimeToLiveStatus: 'DISABLED' },
            isLocal: true
        });
    });

    const renderWithContext = () => {
        return render(
            <UIProvider>
                <TableSettings
                    tableName="TestTable"
                    patterns={mockPatterns}
                    onClose={mockClose}
                    onUpdate={mockUpdate}
                />
            </UIProvider>
        );
    };

    it('renders and loads details', async () => {
        renderWithContext();
        expect(screen.getByText(/Table Settings/)).toBeInTheDocument();
        await waitFor(() => {
            expect(dynamoActions.getTableDetails).toHaveBeenCalledWith('TestTable');
        });
    });

    it('manages access patterns', async () => {
        renderWithContext();

        // Switch to patterns tab
        fireEvent.click(screen.getByText('Access Patterns'));

        // Check list
        expect(screen.getByText('Pattern 1')).toBeInTheDocument();

        // Create new
        fireEvent.click(screen.getByText('New Pattern'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('unique-id'), { target: { value: 'new-p' } });
        fireEvent.change(screen.getByPlaceholderText('Label'), { target: { value: 'New Label' } });
        fireEvent.change(screen.getByPlaceholderText('PREFIX#{userId}'), { target: { value: 'PK' } });

        // Save
        (dynamoActions.upsertAccessPattern as jest.Mock).mockResolvedValue({ success: true });
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(dynamoActions.upsertAccessPattern).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    it('manages GSI deletion (Local)', async () => {
        (dynamoActions.getTableDetails as jest.Mock).mockResolvedValue({
            success: true,
            table: {
                GlobalSecondaryIndexes: [
                    { IndexName: 'GSI1', IndexStatus: 'ACTIVE', KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }] }
                ]
            },
            isLocal: true
        });

        renderWithContext();

        await waitFor(() => screen.getByText('GSI1'));

        // Delete button
        // Find by title which comes from i18n
        const deleteBtn = screen.getByTitle('Delete GSI');
        fireEvent.click(deleteBtn);

        // Confirm
        const confirmBtn = await screen.findByText('Confirm', { selector: 'button' });
        (dynamoActions.deleteGSI as jest.Mock).mockResolvedValue({ success: true });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(dynamoActions.deleteGSI).toHaveBeenCalledWith('TestTable', 'GSI1');
        });
    });

    it('toggles TTL', async () => {
        renderWithContext();
        await waitFor(() => screen.getByText('Enable TTL'));

        fireEvent.click(screen.getByText('Enable TTL'));

        // Modal opens
        const input = screen.getByPlaceholderText('expireAt');
        fireEvent.change(input, { target: { value: 'ttl' } });

        // The modal button is the second "Enable TTL" in the DOM
        const enableButtons = await screen.findAllByText('Enable TTL');
        const submitBtn = enableButtons[enableButtons.length - 1];

        (dynamoActions.updateTTL as jest.Mock).mockResolvedValue({ success: true });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(dynamoActions.updateTTL).toHaveBeenCalledWith('TestTable', true, 'ttl');
        });
    });
});
