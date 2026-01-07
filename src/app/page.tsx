import { listTables } from '@/actions/dynamo';
import { getSettings } from '@/actions/settings';
import HomeContent from '@/components/features/home/HomeContent';
import { ADMIN_TABLE_NAME } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const tables = await listTables();
    const { mode } = await getSettings();

    return (
        <HomeContent
            tables={tables}
            mode={mode}
            adminTableName={ADMIN_TABLE_NAME}
        />
    );
}