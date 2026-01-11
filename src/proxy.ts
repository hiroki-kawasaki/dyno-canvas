import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const authMode = process.env.DYNOCANVAS_AUTH || 'none';

    if (authMode !== 'basic') {
        return NextResponse.next();
    }

    const basicAuth = request.headers.get('authorization');

    if (basicAuth) {
        const authValue = basicAuth.split(' ')[1];
        try {
            const [user, pwd] = atob(authValue).split(':');

            const validUser = process.env.DYNOCANVAS_AUTH_USER || 'admin';
            const validPass = process.env.DYNOCANVAS_AUTH_PASS || 'dynocanvas';

            if (user === validUser && pwd === validPass) {
                return NextResponse.next();
            }
        } catch {
            // ignore invalid auth header
        }
    }

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
