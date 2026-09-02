import TemplateForm from '../TemplateForm';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'New PDF Template',
};

export default async function NewTemplatePage() {
  const tCommon = await getTranslations('common');

  return (
    <>
      <div className="h-full p-4 lg:p-6 overflow-hidden">
        <TemplateForm />
      </div>
    </>
  );
}
