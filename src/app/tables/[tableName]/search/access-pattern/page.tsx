import TableDashboard from '@components/features/dashboard/TableDashboard';
import { checkAdminTableExists } from '@actions/admin';
import { cookies } from 'next/headers';

interface PageProps {
    params: Promise<{ tableName: string }>;
}

export default async function AccessPatternRootPage({ params }: PageProps) {
    const { tableName } = await params;
    const decodedTableName = decodeURIComponent(tableName);
    const adminTableExists = await checkAdminTableExists();
    const cookieStore = await cookies();
    const limit = Number(cookieStore.get('db-limit')?.value) || 100;

    return (
        <main className="w-full p-6">
            <TableDashboard
                tableName={decodedTableName}
                mode="pattern"
                adminTableExists={adminTableExists}
                initialLimit={limit}
            />
        </main>
    );
}