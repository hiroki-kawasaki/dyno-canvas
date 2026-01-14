import { render, screen, fireEvent } from '@testing-library/react';
import SearchForm from '../SearchForm';
import { dictionary } from '@lib/i18n';

describe('SearchForm', () => {
    const defaultProps = {
        mode: 'free' as const,
        loading: false,
        error: '',
        t: dictionary['en'],
        indexInput: '',
        setIndexInput: jest.fn(),
        pkInput: '',
        setPkInput: jest.fn(),
        skInput: '',
        setSkInput: jest.fn(),
        gsis: [],
        patterns: [],
        handlePatternChange: jest.fn(),
        patternParams: {},
        setPatternParams: jest.fn(),
        patternsLoading: false,
        dynamicFormFields: [],
        onSearch: jest.fn()
    };

    it('renders free search inputs', () => {
        render(<SearchForm {...defaultProps} />);
        expect(screen.getByText('Partition Key')).toBeInTheDocument();
        expect(screen.getByText('Sort Key')).toBeInTheDocument();
        expect(screen.getByText('Index')).toBeInTheDocument();
    });

    it('handles input changes', () => {
        const setPkInput = jest.fn();
        render(<SearchForm {...defaultProps} setPkInput={setPkInput} />);

        const input = screen.getByPlaceholderText('e.g. USER#123');
        fireEvent.change(input, { target: { value: 'TEST' } });

        expect(setPkInput).toHaveBeenCalledWith('TEST');
    });

    it('renders pattern search inputs', () => {
        const patterns = [{ id: 'p1', label: 'Pattern 1', description: 'desc', pkFormat: 'PK', skFormat: 'SK' }];
        render(<SearchForm {...defaultProps} mode="pattern" patterns={patterns} />);
        expect(screen.getAllByText('Select Pattern')[0]).toBeInTheDocument();
    });
});
