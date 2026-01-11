import { getSettings, getSystemStatus } from '@/actions/settings';
import { listTables } from '@/actions/dynamo';
import SettingsContent from '@/components/features/settings/SettingsContent';
import { ADMIN_TABLE_NAME } from '@/lib/config';

export default async function SettingsPage() {
    const settings = await getSettings();
    const status = await getSystemStatus();
    const tables = await listTables();
    const adminTableExists = tables.includes(ADMIN_TABLE_NAME);

    return (
        <SettingsContent
            settings={settings}
            systemStatus={status}
            adminTableExists={adminTableExists}
            adminTableName={ADMIN_TABLE_NAME}
            accountId={settings.accountId}
        />
    );
}
