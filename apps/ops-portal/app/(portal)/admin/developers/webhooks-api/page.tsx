import { getTranslations } from 'next-intl/server';
import WebhooksClientPage from './client-page';
import { webhooksHtmlContent } from '@/lib/generated/webhooks-content';

export default async function WebhooksApiPage() {
  const t = await getTranslations('admin.developers.webhooksApi');
  
  return (
    <WebhooksClientPage 
      title={t('header.title')} 
      subtitle={t('header.subtitle')} 
      html={webhooksHtmlContent} 
    />
  );
}
