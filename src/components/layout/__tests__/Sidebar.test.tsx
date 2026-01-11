import React from 'react';
import { render, screen } from '@testing-library/react';
import Sidebar from '@components/layout/Sidebar';
import { UIProvider } from '@/contexts/UIContext';
import { usePathname } from 'next/navigation';

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
    usePathname: jest.fn(),
}));

describe('Sidebar Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderWithContext = () => {
        return render(
            <UIProvider>
                <Sidebar />
            </UIProvider>
        );
    };

    it('renders navigation links', () => {
        (usePathname as jest.Mock).mockReturnValue('/');
        renderWithContext();

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Table List')).toBeInTheDocument();
        expect(screen.getByText('System Settings')).toBeInTheDocument();
    });

    it('highlights active link', () => {
        (usePathname as jest.Mock).mockReturnValue('/tables');
        renderWithContext();

        const tableLink = screen.getByRole('link', { name: /Table List/ });
        expect(tableLink).toHaveClass('bg-blue-50'); // Active class

        const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
        expect(dashboardLink).not.toHaveClass('bg-blue-50');
    });
});
