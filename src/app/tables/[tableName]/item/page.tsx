import { notFound } from 'next/navigation';
import { getItem } from '@actions/dynamodb';
import { getSettings } from '@actions/settings';
import ItemEditor from '@components/features/editor/ItemEditor';
import ItemDetailHeader from '@components/features/editor/ItemDetailHeader';

interface Props {
    params: Promise<{ tableName: string }>;
    searchParams: Promise<{ pk?: string; sk?: string; backUrl?: string }>;
}

export default async function ItemPage({ params, searchParams }: Props) {
    const { tableName } = await params;
    const { pk, sk, backUrl } = await searchParams;
    const decodedTableName = decodeURIComponent(tableName);
    const { readOnly } = await getSettings();

    const isCreateMode = !pk && !sk;

    let item;
    if (!isCreateMode) {
        if (!pk || !sk) {
            return (
                <div className="p-8 text-red-500">
                    Error: Missing Partition Key or Sort Key in URL parameters.
                </div>
            );
        }
        item = await getItem(decodedTableName, pk, sk);
        if (!item) { return notFound(); }
    } else {
        item = { PK: "", SK: "" };
    }

    return (
        <main className="w-full p-6 h-full flex flex-col overflow-hidden">
            <ItemDetailHeader
                tableName={decodedTableName}
                isCreateMode={isCreateMode}
                pk={pk}
                sk={sk}
                backUrl={backUrl}
            />
            <div className="flex-grow border rounded-lg overflow-hidden shadow-lg border-gray-200 dark:border-gray-700">
                <ItemEditor
                    tableName={decodedTableName}
                    initialData={item}
                    isCreateMode={isCreateMode}
                    readOnly={readOnly}
                />
            </div>
        </main>
    );
}