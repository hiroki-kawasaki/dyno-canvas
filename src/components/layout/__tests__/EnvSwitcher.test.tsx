import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnvSwitcher from '@/components/layout/EnvSwitcher';
import * as settingsActions from '@/actions/settings';

// Mock settings actions
jest.mock('@/actions/settings', () => ({
    switchEnvMode: jest.fn(),
}));

// Mock useTransition (React 18+)
// Normally JSDOM supports it, but we might need to ensure it's not actually waiting for long tasks
// Actually fireEvent and waitFor should handle it.

describe('EnvSwitcher Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correct state for AWS mode', () => {
        render(<EnvSwitcher currentMode="aws" />);
        // AWS span should have active classes (bg-orange-500)
        const awsSpan = screen.getByText('AWS');
        expect(awsSpan).toHaveClass('bg-orange-500');

        const localSpan = screen.getByText('Local');
        expect(localSpan).toHaveClass('text-gray-500');
    });

    it('renders correct state for Local mode', () => {
        render(<EnvSwitcher currentMode="local" />);
        const localSpan = screen.getByText('Local');
        expect(localSpan).toHaveClass('bg-green-600');
    });

    it('switches mode on click', async () => {
        (settingsActions.switchEnvMode as jest.Mock).mockResolvedValue(undefined);
        render(<EnvSwitcher currentMode="aws" />);

        const toggle = screen.getByRole('button');
        fireEvent.click(toggle);

        await waitFor(() => {
            expect(settingsActions.switchEnvMode).toHaveBeenCalledWith('local');
        });
    });
});
