import { redirect } from 'next/navigation';

interface PageProps {
    params: Promise<{ tableName: string }>;
}

export default async function TablePage({ params }: PageProps) {
    const { tableName } = await params;
    redirect(`/tables/${tableName}/search/free`);
}