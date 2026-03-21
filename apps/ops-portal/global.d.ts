import 'next-intl';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof import('./messages/en.json');
  }
}
