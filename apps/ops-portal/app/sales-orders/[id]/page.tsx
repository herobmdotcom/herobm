import { use } from 'react';
import EditSalesOrderClient from './EditSalesOrderClient';

export default function SalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <EditSalesOrderClient id={id} />;
}
