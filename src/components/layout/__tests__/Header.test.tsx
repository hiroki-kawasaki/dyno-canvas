import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Header from '@components/layout/Header';
import { UIProvider } from '@/contexts/UIContext';
import * as settingsActions from '@actions/settings';
import { usePathname } from 'next/navigation';

jest.mock('@actions/settings', () => ({
    switchEnvMode: jest.fn(),
    switchRegion: jest.fn(),
    switchProfile: jest.fn(),
}));

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
    usePathname: jest.fn(),
    useRouter: () => ({
        push: mockPush,
        refresh: jest.fn(),
    }),
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

    const renderWithContext = (props?: Partial<React.ComponentProps<typeof Header>>) => {
        return render(
            <UIProvider>
                <Header
                    currentMode="aws"
                    currentRegion="us-east-1"
                    currentProfile="default"
                    availableProfiles={['default', 'prod']}
                    systemStatus={mockSystemStatus}
                    {...props}
                />
            </UIProvider>
        );
    };

    it('renders logo and navigation', () => {
        renderWithContext();
        expect(screen.getByText('DynoCanvas')).toBeInTheDocument();
        expect(screen.getByDisplayValue('default')).toBeInTheDocument();
        expect(screen.getByDisplayValue('us-east-1')).toBeInTheDocument();
    });

    it('handles profile change to local', async () => {
        renderWithContext();

        const profileSelect = screen.getByDisplayValue('default');
        fireEvent.change(profileSelect, { target: { value: 'Local' } });

        await waitFor(() => {
            expect(settingsActions.switchEnvMode).toHaveBeenCalledWith('local');
            expect(mockPush).toHaveBeenCalledWith('/');
        });
    });

    it('handles region change', async () => {
        renderWithContext();

        const regionSelect = screen.getByDisplayValue('us-east-1');
        fireEvent.change(regionSelect, { target: { value: 'ap-northeast-1' } });

        await waitFor(() => {
            expect(settingsActions.switchRegion).toHaveBeenCalledWith('ap-northeast-1');
            expect(mockPush).toHaveBeenCalledWith('/');
        });
    });

    it('disables dropdowns on item detail page', () => {
        (usePathname as jest.Mock).mockReturnValue('/tables/T/item?pk=A');
        renderWithContext();

        const profileSelect = screen.getByDisplayValue('default');
        const regionSelect = screen.getByDisplayValue('us-east-1');

        expect(profileSelect).toBeDisabled();
        expect(regionSelect).toBeDisabled();
    });

    it('disables region dropdown when in local mode', () => {
        renderWithContext({ currentMode: 'local', currentRegion: 'local', currentProfile: 'Local' });

        expect(screen.getByDisplayValue('Local')).toBeInTheDocument();

        const regionSelect = screen.getByDisplayValue('local');
        expect(regionSelect).toBeDisabled();
    });
});
