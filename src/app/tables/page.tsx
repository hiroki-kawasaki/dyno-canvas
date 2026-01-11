import { listTables } from '@/actions/dynamo';
import { getSettings } from '@/actions/settings';
import TableListContent from '@/components/features/tables/TableListContent';
import { ADMIN_TABLE_NAME } from '@/lib/config';

export default async function TablesPage() {
    const tables = await listTables();
    const { mode } = await getSettings();

    return (
        <TableListContent
            tables={tables}
            mode={mode}
            adminTableName={ADMIN_TABLE_NAME}
        />
    );
}
