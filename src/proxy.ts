import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const authMode = process.env.DYNOCANVAS_AUTH || 'none';

    if (authMode === 'none') {
        return NextResponse.next();
    }

    const basicAuth = request.headers.get('authorization');

    if (basicAuth) {
        const authValue = basicAuth.split(' ')[1];
        try {
            const [user, pwd] = atob(authValue).split(':');

            const validUser = process.env.DYNOCANVAS_AUTH_USER;
            const validPass = process.env.DYNOCANVAS_AUTH_PASS;

            if (!validUser || !validPass) {
                console.error("Auth credentials not set. Access denied.");
                return new NextResponse('Server Configuration Error', { status: 500 });
            }

            if (user === validUser && pwd === validPass) {
                return NextResponse.next();
            }
        } catch {
            console.error("Invalid auth header.");
        }
    }

    console.error("Authentication required.");
    return new NextResponse('Authentication required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="DynoCanvas"',
        },
    });
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
