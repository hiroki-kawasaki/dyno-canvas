import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportModal from '@components/shared/ImportModal';
import { UIProvider } from '@/contexts/UIContext';
import * as dynamoActions from '@actions/dynamodb';

jest.mock('@actions/dynamodb', () => ({
    importItems: jest.fn(),
    importAccessPatterns: jest.fn(),
}));

const mockClose = jest.fn();
const mockSuccess = jest.fn();

describe('ImportModal Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createMockFile = (content: string, name: string) => {
        const file = new File([content], name, { type: 'application/x-jsonlines' });
        file.text = jest.fn().mockResolvedValue(content);
        return file;
    };

    const renderWithContext = (target: 'items' | 'patterns' = 'items') => {
        const utils = render(
            <UIProvider>
                <ImportModal
                    tableName="TestTable"
                    target={target}
                    onClose={mockClose}
                    onSuccess={mockSuccess}
                />
            </UIProvider>
        );
        const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
        return { ...utils, input };
    };

    it('renders and handles file selection', async () => {
        const { input } = renderWithContext();
        expect(screen.getByText(/Import Items/i)).toBeInTheDocument();

        const file = createMockFile('{"Item":{"PK":{"S":"A"}}}', 'test.jsonl');
        fireEvent.change(input, { target: { files: [file] } });

        expect(screen.getByText('test.jsonl')).toBeInTheDocument();
    });

    it('triggers execution on import click for items', async () => {
        (dynamoActions.importItems as jest.Mock).mockResolvedValue({ success: true, count: 1 });
        const { input } = renderWithContext('items');

        const file = createMockFile('{"Item":{"PK":{"S":"A"}}}', 'test.jsonl');
        fireEvent.change(input, { target: { files: [file] } });

        const importBtn = screen.getByText('Import');
        fireEvent.click(importBtn);

        const confirmBtn = await screen.findByText('Confirm', { selector: 'button' });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(dynamoActions.importItems).toHaveBeenCalled();
            expect(mockSuccess).toHaveBeenCalled();
        });
    });

    it('triggers execution on import click for patterns (validating content first)', async () => {
        (dynamoActions.importAccessPatterns as jest.Mock).mockResolvedValue({ success: true, count: 1 });
        const { input } = renderWithContext('patterns');

        const content = '{"Item":{"PK":{"S":"AccountId#123#DynoCanvas#AccessPattern"}}}';
        const file = createMockFile(content, 'patterns.jsonl');

        fireEvent.change(input, { target: { files: [file] } });

        const importBtn = screen.getByText('Import');
        fireEvent.click(importBtn);

        const confirmBtn = await screen.findByText('Confirm', { selector: 'button' });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(dynamoActions.importAccessPatterns).toHaveBeenCalled();
        });
    });
});
