import React from 'react';
import EditShipmentClient from './EditShipmentClient';

export const metadata = {
  title: 'Shipment',
};

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <EditShipmentClient id={id} />;
}
