'use client'

interface Props {
    tableName: string;
}

export default function TableHeader({ tableName }: Props) {
    return (
        <header className="mb-6 flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Table: {tableName}
                </h1>
            </div>
        </header>
    );
}