import TableDashboard from '@components/features/dashboard/TableDashboard';
import { checkAdminTableExists } from '@actions/admin';
import { getSettings } from '@actions/settings';
import { cookies } from 'next/headers';

interface PageProps {
    params: Promise<{ tableName: string; patternId: string }>;
}

export default async function AccessPatternSearchPage({ params }: PageProps) {
    const { tableName, patternId } = await params;
    const decodedTableName = decodeURIComponent(tableName);
    const adminTableExists = await checkAdminTableExists();
    const cookieStore = await cookies();
    const limit = Number(cookieStore.get('db-limit')?.value) || 100;
    const { readOnly } = await getSettings();

    return (
        <main className="w-full p-6">
            <TableDashboard
                tableName={decodedTableName}
                mode="pattern"
                patternId={patternId}
                adminTableExists={adminTableExists}
                initialLimit={limit}
                readOnly={readOnly}
            />
        </main>
    );
}