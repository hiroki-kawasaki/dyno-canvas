import { listTables } from '@actions/dynamodb';
import { getSettings } from '@actions/settings';
import TableListContent from '@components/features/tables/TableListContent';
import { ADMIN_TABLE_NAME } from '@lib/config';

export default async function TablesPage() {
    const tables = await listTables();
    const { mode, readOnly } = await getSettings();

    return (
        <TableListContent
            tables={tables}
            mode={mode}
            readOnly={readOnly}
            adminTableName={ADMIN_TABLE_NAME}
        />
    );
}
