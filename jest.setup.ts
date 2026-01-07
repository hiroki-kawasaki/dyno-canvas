import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

interface MockRequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    [key: string]: unknown;
}

if (typeof global.Request === 'undefined') {
    global.Request = class Request {
        url: string;
        method: string;
        headers: Headers;
        body: BodyInit | null;
        constructor(input: string | Request, init?: MockRequestInit) {
            this.url = typeof input === 'string' ? input : (input as { url: string }).url;
            this.method = init?.method || 'GET';
            this.headers = new Headers(init?.headers);
            this.body = init?.body || null;
        }
    } as unknown as typeof global.Request;
}

if (typeof global.Response === 'undefined') {
    global.Response = class Response {
        status: number;
        statusText: string;
        headers: Headers;
        body: unknown;
        constructor(body?: unknown, init?: ResponseInit) {
            this.body = body;
            this.status = init?.status || 200;
            this.statusText = init?.statusText || 'OK';
            this.headers = new Headers(init?.headers);
        }
        json() { return Promise.resolve(this.body); }
        text() { return Promise.resolve(String(this.body)); }
    } as unknown as typeof global.Response;
}

if (typeof global.Headers === 'undefined') {
    global.Headers = class Headers extends Map {
        constructor(init?: HeadersInit) {
            super();
            if (init) {
                if (Array.isArray(init)) {
                    init.forEach(([k, v]) => this.append(k, v));
                } else if (typeof init === 'object') {
                    Object.entries(init).forEach(([k, v]) => this.append(k, String(v)));
                }
            }
        }
        append(key: string, value: string) {
            this.set(key, value);
        }
    } as unknown as typeof global.Headers;
}

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        refresh: jest.fn(),
        back: jest.fn(),
        replace: jest.fn(),
    }),
    useSearchParams: () => ({
        get: jest.fn(),
    }),
    usePathname: () => '',
}));

jest.mock('next/headers', () => ({
    cookies: () => ({
        get: jest.fn(),
        set: jest.fn(),
    }),
}));

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
}