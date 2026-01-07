import TableDashboard from '@/components/features/dashboard/TableDashboard';
import TableHeader from '@/components/features/dashboard/TableHeader';

import { checkAdminTableExists } from '@/actions/admin';

interface PageProps {
    params: Promise<{ tableName: string }>;
}

export default async function FreeSearchPage({ params }: PageProps) {
    const { tableName } = await params;
    const decodedTableName = decodeURIComponent(tableName);
    const adminTableExists = await checkAdminTableExists();

    return (
        <main className="w-full p-6">
            <TableHeader tableName={decodedTableName} />
            <TableDashboard tableName={decodedTableName} mode="free" adminTableExists={adminTableExists} />
        </main>
    );
}