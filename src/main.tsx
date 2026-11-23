import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createServices } from './composition';
import { detectBrowserSupport } from './infrastructure/platform/browserSupport';
import { App } from './ui/app/App';
import { ServicesContext } from './ui/app/services';
import { UnsupportedBrowser } from './ui/components/feedback/BrowserNotices';
import { initI18n } from './ui/i18n/i18n';
import './ui/styles/index.css';

const i18n = initI18n();
const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}
const root = createRoot(rootElement);
const support = detectBrowserSupport();

if (support.supported) {
  const services = createServices(support, i18n.t('app.name'));
  root.render(
    <StrictMode>
      <ServicesContext value={services}>
        <App />
      </ServicesContext>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <UnsupportedBrowser missing={support.missing} />
    </StrictMode>,
  );
}
