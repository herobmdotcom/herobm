import Shell from '@/components/Shell';
import TemplateForm from '../TemplateForm';
import { getTranslations } from 'next-intl/server';

export default async function NewTemplatePage() {
  const tCommon = await getTranslations('common');

  return (
    <Shell>
      <div className="h-full p-4 lg:p-6 overflow-hidden">
        <TemplateForm />
      </div>
    </Shell>
  );
}
