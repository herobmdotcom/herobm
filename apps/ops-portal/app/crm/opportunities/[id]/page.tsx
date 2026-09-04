import EditOpportunityClient from './EditOpportunityClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditOpportunityPage({ params }: Props) {
  const { id } = await params;
  return <EditOpportunityClient id={id} />;
}
