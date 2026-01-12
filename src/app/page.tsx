import { listTables } from '@actions/dynamodb';
import { getSettings } from '@actions/settings';
import HomeContent from '@components/features/home/HomeContent';
import { ADMIN_TABLE_NAME } from '@lib/config';

export default async function HomePage() {
    const tables = await listTables();
    const { mode, readOnly } = await getSettings();

    return (
        <HomeContent
            tables={tables}
            mode={mode}
            readOnly={readOnly}
            adminTableName={ADMIN_TABLE_NAME}
        />
    );
}