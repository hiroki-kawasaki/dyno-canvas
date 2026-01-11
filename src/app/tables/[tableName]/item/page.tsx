import ItemEditor from '@/components/features/editor/ItemEditor';
import ItemDetailHeader from '@/components/features/editor/ItemDetailHeader';
import { notFound } from 'next/navigation';
import { getItem } from '@/actions/dynamo';

interface Props {
    params: Promise<{ tableName: string }>;
    searchParams: Promise<{ pk?: string; sk?: string; backUrl?: string }>;
}

export default async function ItemPage({ params, searchParams }: Props) {
    const { tableName } = await params;
    const { pk, sk, backUrl } = await searchParams;
    const decodedTableName = decodeURIComponent(tableName);

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
        <main className="w-full p-6 h-screen flex flex-col">
            <ItemDetailHeader
                tableName={decodedTableName}
                isCreateMode={isCreateMode}
                pk={pk}
                sk={sk}
                backUrl={backUrl}
            />
            <div className="flex-grow border rounded-lg overflow-hidden shadow-lg border-gray-200 dark:border-gray-700">
                <ItemEditor tableName={decodedTableName} initialData={item} isCreateMode={isCreateMode} />
            </div>
        </main>
    );
}