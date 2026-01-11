import TableDashboard from '@components/features/dashboard/TableDashboard';
import TableHeader from '@components/features/dashboard/TableHeader';

import { checkAdminTableExists } from '@actions/admin';

interface PageProps {
    params: Promise<{ tableName: string; patternId: string }>;
}

export default async function AccessPatternSearchPage({ params }: PageProps) {
    const { tableName, patternId } = await params;
    const decodedTableName = decodeURIComponent(tableName);
    const adminTableExists = await checkAdminTableExists();

    return (
        <main className="w-full p-6">
            <TableHeader tableName={decodedTableName} />
            <TableDashboard tableName={decodedTableName} mode="pattern" patternId={patternId} adminTableExists={adminTableExists} />
        </main>
    );
}