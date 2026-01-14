import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteTableModal, { DeleteTableModalProps } from '../DeleteTableModal';
import { UIProvider } from '@/contexts/UIContext';

describe('DeleteTableModal', () => {
    const defaultProps: DeleteTableModalProps = {
        isOpen: true,
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        tableName: 'TestTable',
        mode: 'local',
        region: 'local',
        accountId: 'Local',
        isDeleting: false
    };

    const renderModal = (props: Partial<DeleteTableModalProps> = {}) => {
        return render(
            <UIProvider>
                <DeleteTableModal {...defaultProps} {...props} />
            </UIProvider>
        );
    };

    it('renders correctly', () => {
        renderModal();
        expect(screen.getByText(/Are you sure you want to delete table "TestTable"/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('local:TestTable')).toBeInTheDocument();
    });

    it('validates input for local mode', () => {
        renderModal();
        const input = screen.getByPlaceholderText('local:TestTable');
        const deleteButton = screen.getByRole('button', { name: 'Delete' });

        expect(deleteButton).toBeDisabled();

        fireEvent.change(input, { target: { value: 'wrong' } });
        expect(deleteButton).toBeDisabled();

        fireEvent.change(input, { target: { value: 'local:TestTable' } });
        expect(deleteButton).toBeEnabled();
    });

    it('validates input for aws mode', () => {
        renderModal({
            mode: 'aws',
            region: 'us-east-1',
            accountId: '123456789012'
        });

        const expected = 'us-east-1:123456789012:TestTable';
        const input = screen.getByPlaceholderText(expected);
        const deleteButton = screen.getByRole('button', { name: 'Delete' });

        fireEvent.change(input, { target: { value: expected } });
        expect(deleteButton).toBeEnabled();
    });

    it('calls onConfirm when delete is clicked', () => {
        const onConfirm = jest.fn();
        renderModal({ onConfirm });

        const input = screen.getByPlaceholderText('local:TestTable');
        fireEvent.change(input, { target: { value: 'local:TestTable' } });

        const deleteButton = screen.getByRole('button', { name: 'Delete' });
        fireEvent.click(deleteButton);

        expect(onConfirm).toHaveBeenCalled();
    });
});
