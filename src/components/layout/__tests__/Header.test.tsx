import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Header from '@components/layout/Header';
import { UIProvider } from '@/contexts/UIContext';
import * as settingsActions from '@actions/settings';
import { usePathname } from 'next/navigation';

// Mock Actions
jest.mock('@actions/settings', () => ({
    switchEnvMode: jest.fn(),
    switchRegion: jest.fn(),
}));

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
    usePathname: jest.fn(),
}));

const mockSystemStatus = {
    isLocalAvailable: true,
    availableRegions: ['local', 'us-east-1', 'ap-northeast-1']
};

describe('Header Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (usePathname as jest.Mock).mockReturnValue('/');
    });

    const renderWithContext = () => {
        return render(
            <UIProvider>
                <Header
                    currentMode="aws"
                    currentRegion="us-east-1"
                    systemStatus={mockSystemStatus}
                />
            </UIProvider>
        );
    };

    it('renders logo and navigation', () => {
        renderWithContext();
        expect(screen.getByText('DynoCanvas')).toBeInTheDocument();
        expect(screen.getByDisplayValue('us-east-1')).toBeInTheDocument();
    });

    it('handles region/mode change', async () => {
        renderWithContext();

        const select = screen.getByDisplayValue('us-east-1');
        fireEvent.change(select, { target: { value: 'local' } });

        await waitFor(() => {
            expect(settingsActions.switchEnvMode).toHaveBeenCalledWith('local');
        });
    });

    it('disables environment switcher on item detail page', () => {
        (usePathname as jest.Mock).mockReturnValue('/tables/T/item?pk=A');
        renderWithContext();

        const select = screen.getByDisplayValue('us-east-1');
        expect(select).toBeDisabled();
    });
});
