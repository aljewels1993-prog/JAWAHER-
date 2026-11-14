import { useI18n } from '../i18n';

/** Copyright line shown at the bottom of every page. The author's name stays in Arabic as she wrote it. */
export const AUTHOR_AR = 'الأستاذة: جواهر الخصيبي';

export function Footer({ light }: { light?: boolean }) {
  const { t } = useI18n();
  return (
    <footer className={`app-footer${light ? ' on-dark' : ''}`}>
      <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
      <span aria-hidden="true"> · </span>
      <span>{t('footer.by')} <b lang="ar" dir="rtl">{AUTHOR_AR}</b></span>
    </footer>
  );
}
