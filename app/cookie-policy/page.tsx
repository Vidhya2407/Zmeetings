import type { Metadata } from 'next';
import LegalDocument from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Cookie policy for the ZSTREAM beta application.',
};

export default function CookiePolicyPage() {
  return (
    <LegalDocument
      eyebrow={{ en: 'Legal', de: 'Rechtliches' }}
      title={{ en: 'Cookie Policy', de: 'Cookie-Richtlinie' }}
      intro={{
        en: 'This Cookie Policy explains how ZSTREAM uses cookies and similar technologies in the beta application, including which categories are essential, which are optional, and how you can manage consent.',
        de: 'Diese Cookie-Richtlinie erklart, wie ZSTREAM in der Beta-Anwendung Cookies und ahnliche Technologien einsetzt, welche Kategorien erforderlich sind, welche optional bleiben und wie Sie Ihre Einwilligung verwalten konnen.',
      }}
      lastUpdated={{ en: 'March 27, 2026', de: '27. Marz 2026' }}
      sourceNote={{
        en: 'Based directly on the cookie settings copy exposed in the public Zero-Carbon deployed site bundle, including the category labels Essential Cookies, Analytics Cookies, Preference Cookies, and Marketing Cookies, along with the site consent actions for accepting, declining, customizing, saving, and withdrawing consent.',
        de: 'Basiert direkt auf den Cookie-Einstellungen, die im offentlich ausgelieferten Zero-Carbon-Site-Bundle sichtbar sind, einschliesslich der Kategorien Essential Cookies, Analytics Cookies, Preference Cookies und Marketing Cookies sowie der Aktionen zum Akzeptieren, Ablehnen, Anpassen, Speichern und Widerrufen der Einwilligung.',
      }}
      sections={[
        {
          title: { en: 'Why cookies are used', de: 'Warum Cookies verwendet werden' },
          paragraphs: [
            {
              en: 'Zero-Carbon publicly states that cookies are used to enhance browsing experience, serve personalized ads or content, and analyze traffic. The beta application follows the same overall model, while keeping required security and usability cookies enabled where necessary for platform operation.',
              de: 'Zero-Carbon erklaert offentlich, dass Cookies eingesetzt werden, um das Nutzungserlebnis zu verbessern, personalisierte Inhalte oder Werbung bereitzustellen und den Traffic zu analysieren. Die Beta-Anwendung folgt demselben Grundmodell und lasst notwendige Sicherheits- und Funktions-Cookies aktiviert, wenn sie fur den Plattformbetrieb erforderlich sind.',
            },
          ],
        },
        {
          title: { en: 'Essential cookies', de: 'Notwendige Cookies' },
          paragraphs: [
            {
              en: 'Essential cookies support authentication, security, and performance. These are required for the website or app to function correctly, including sign-in state, security protections, and core rendering behavior.',
              de: 'Notwendige Cookies unterstutzen Authentifizierung, Sicherheit und Performance. Sie sind erforderlich, damit Website oder App korrekt funktionieren, einschliesslich Login-Status, Schutzmechanismen und zentralem Rendering-Verhalten.',
            },
          ],
        },
        {
          title: { en: 'Analytics cookies', de: 'Analyse-Cookies' },
          paragraphs: [
            {
              en: 'Analytics cookies are used for usage statistics and behavior analysis so the service can be improved over time. In beta, these signals help identify reliability gaps, UX friction, and operational issues.',
              de: 'Analyse-Cookies dienen Nutzungsstatistiken und Verhaltensanalysen, damit der Dienst verbessert werden kann. In der Beta helfen diese Signale dabei, Zuverlassigkeitslucken, UX-Reibung und operative Probleme zu erkennen.',
            },
          ],
        },
        {
          title: { en: 'Preference cookies', de: 'Praferenz-Cookies' },
          paragraphs: [
            {
              en: 'Preference cookies remember your language, theme, playback, or quality-related settings so the app can keep a consistent experience across visits.',
              de: 'Praferenz-Cookies speichern Sprache, Theme, Wiedergabe- oder qualitatsbezogene Einstellungen, damit die App uber mehrere Besuche hinweg ein konsistentes Erlebnis bieten kann.',
            },
          ],
        },
        {
          title: { en: 'Marketing cookies', de: 'Marketing-Cookies' },
          paragraphs: [
            {
              en: 'Marketing cookies may support targeted advertising and social media integrations when those features are enabled. If these cookies are optional in your region or consent flow, you should be able to decline them.',
              de: 'Marketing-Cookies konnen gezielte Werbung und Social-Media-Integrationen unterstutzen, sofern diese Funktionen aktiviert sind. Wenn diese Cookies in Ihrer Region oder innerhalb des Consent-Dialogs optional sind, sollten Sie sie ablehnen konnen.',
            },
          ],
        },
        {
          title: { en: 'Managing consent', de: 'Einwilligung verwalten' },
          bullets: [
            {
              en: 'Accept all cookies when you want the full personalized experience.',
              de: 'Akzeptieren Sie alle Cookies, wenn Sie das vollstandige personalisierte Erlebnis nutzen mochten.',
            },
            {
              en: 'Decline optional cookies while keeping only essential cookies active.',
              de: 'Lehnen Sie optionale Cookies ab und lassen Sie nur notwendige Cookies aktiv.',
            },
            {
              en: 'Customize cookie categories before saving your preferences.',
              de: 'Passen Sie Cookie-Kategorien an, bevor Sie Ihre Einstellungen speichern.',
            },
            {
              en: 'Withdraw consent later if the product surfaces a consent-management option.',
              de: 'Widerrufen Sie Ihre Einwilligung spater, wenn das Produkt eine Consent-Verwaltung anbietet.',
            },
          ],
        },
      ]}
    />
  );
}




