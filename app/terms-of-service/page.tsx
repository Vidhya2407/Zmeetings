import type { Metadata } from 'next';
import LegalDocument from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for the Z Meetings beta application.',
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      eyebrow={{ en: 'Beta Terms', de: 'Beta-Bedingungen' }}
      title={{ en: 'Terms of Service', de: 'Nutzungsbedingungen' }}
      intro={{
        en: 'These Terms of Service govern access to the Z Meetings beta application and related Zero-Carbon digital services. By creating an account, signing in, or using the platform, you agree to these beta terms.',
        de: 'Diese Nutzungsbedingungen regeln den Zugang zur Z Meetings-Beta-Anwendung und zu damit verbundenen digitalen Diensten von Zero-Carbon. Mit der Registrierung, Anmeldung oder Nutzung der Plattform stimmen Sie diesen Beta-Bedingungen zu.',
      }}
      lastUpdated={{ en: 'March 27, 2026', de: '27. Marz 2026' }}
      showBackButton
      sourceNote={{
        en: 'Zero-carbon.de publicly exposes legal navigation for Privacy Policy, Imprint, and GDPR-related information, but no separate public Terms page was accessible in the deployed site shell at the time of review. This Terms page is therefore prepared for the Z Meetings beta application and aligned to the same Zero-Carbon brand and contact references.',
        de: 'Zero-carbon.de verweist offentlich auf Datenschutz, Impressum und DSGVO-bezogene Inhalte, jedoch war in der ausgelieferten Site-Hulle keine separate offentliche Terms-Seite zuganglich. Diese Seite wurde daher fur die Z Meetings-Beta erstellt und an dieselbe Zero-Carbon-Marke sowie dieselben Kontaktangaben angelehnt.',
      }}
      sections={[
        {
          title: { en: 'Beta service scope', de: 'Leistungsumfang der Beta' },
          paragraphs: [
            {
              en: 'Z Meetings is currently offered as a beta application. Features, content availability, user flows, sustainability metrics, account capabilities, and integrations may change without prior notice while the product is being validated.',
              de: 'Z Meetings wird derzeit als Beta-Anwendung angeboten. Funktionen, Inhaltsverfugbarkeit, Nutzerflusse, Nachhaltigkeitsmetriken, Kontofahigkeiten und Integrationen konnen sich wahrend der Produktvalidierung ohne vorherige Ankundigung andern.',
            },
            {
              en: 'Some areas of the product may rely on staged, demo, or fallback data during beta. Access to specific features may be limited, interrupted, or withdrawn while we improve reliability and security.',
              de: 'Einige Bereiche des Produkts konnen wahrend der Beta auf Staging-, Demo- oder Fallback-Daten beruhen. Der Zugang zu einzelnen Funktionen kann eingeschrankt, unterbrochen oder entzogen werden, wahrend Zuverlassigkeit und Sicherheit verbessert werden.',
            },
          ],
        },
        {
          title: { en: 'Accounts and access', de: 'Konten und Zugriff' },
          bullets: [
            {
              en: 'You are responsible for keeping your login credentials and OTP or recovery details secure.',
              de: 'Sie sind dafur verantwortlich, Ihre Zugangsdaten sowie OTP- oder Wiederherstellungsinformationen sicher aufzubewahren.',
            },
            {
              en: 'You must provide accurate account information and keep it reasonably up to date.',
              de: 'Sie mussen zutreffende Kontoinformationen angeben und diese angemessen aktuell halten.',
            },
            {
              en: 'You may not share accounts in a way that harms service security, violates law, or bypasses platform restrictions.',
              de: 'Sie durfen Konten nicht auf eine Weise teilen, die die Sicherheit des Dienstes beeintrachtigt, gegen geltendes Recht verstosst oder Plattformbeschrankungen umgeht.',
            },
            {
              en: 'We may suspend or restrict access where needed to investigate abuse, protect the service, or comply with legal obligations.',
              de: 'Wir konnen den Zugang aussetzen oder einschranken, wenn dies zur Untersuchung von Missbrauch, zum Schutz des Dienstes oder zur Erfullung gesetzlicher Pflichten erforderlich ist.',
            },
          ],
        },
        {
          title: { en: 'Acceptable use', de: 'Zulassige Nutzung' },
          bullets: [
            {
              en: 'Do not attempt to interfere with the service, scrape protected data, bypass security controls, or disrupt availability.',
              de: 'Versuchen Sie nicht, den Dienst zu storen, geschutzte Daten abzugreifen, Sicherheitskontrollen zu umgehen oder die Verfugbarkeit zu beeintrachtigen.',
            },
            {
              en: 'Do not upload, submit, or share unlawful, harmful, infringing, or abusive material through the platform.',
              de: 'Laden Sie uber die Plattform keine rechtswidrigen, schadlichen, verletzenden oder missbrauchlichen Inhalte hoch und teilen Sie solche Inhalte nicht.',
            },
            {
              en: 'Do not misuse beta features, invitation paths, or account systems to obtain unauthorized access.',
              de: 'Missbrauchen Sie keine Beta-Funktionen, Einladungswege oder Kontosysteme, um unbefugten Zugriff zu erhalten.',
            },
          ],
        },
        {
          title: { en: 'Content and intellectual property', de: 'Inhalte und geistiges Eigentum' },
          paragraphs: [
            {
              en: 'The platform, interface, branding, code, design, and available content remain the property of their respective owners unless expressly stated otherwise.',
              de: 'Plattform, Benutzeroberflache, Branding, Code, Design und verfugbare Inhalte bleiben Eigentum der jeweiligen Rechteinhaber, sofern nicht ausdrucklich etwas anderes angegeben ist.',
            },
            {
              en: 'Your use of the service gives you a limited, revocable, non-exclusive right to access the beta application for its intended purpose. It does not transfer ownership of platform assets or content rights.',
              de: 'Ihre Nutzung des Dienstes gewahrt Ihnen ein beschranktes, widerrufbares und nicht ausschliessliches Recht auf Zugang zur Beta-Anwendung fur den vorgesehenen Zweck. Eigentumsrechte an Plattformbestandteilen oder Inhalten werden dadurch nicht ubertragen.',
            },
          ],
        },
        {
          title: { en: 'Availability and disclaimers', de: 'Verfugbarkeit und Haftungshinweise' },
          paragraphs: [
            {
              en: 'Because this is a beta product for an early user base, the service is provided on an as-available basis. We do not guarantee uninterrupted availability, defect-free operation, or that all features will remain unchanged.',
              de: 'Da es sich um ein Beta-Produkt fur eine fruhe Nutzerbasis handelt, wird der Dienst nach Verfugbarkeit bereitgestellt. Wir garantieren keine unterbrechungsfreie Verfugbarkeit, fehlerfreie Funktion oder unveranderte Funktionen.',
            },
            {
              en: 'Sustainability metrics, carbon counters, and impact indicators are informational unless specifically identified otherwise. They should not be treated as formal verification or legal certification statements for your organization.',
              de: 'Nachhaltigkeitsmetriken, Carbon-Counter und Impact-Indikatoren dienen rein informativen Zwecken, sofern nicht ausdrucklich anders angegeben. Sie sollten nicht als formale Verifikation oder rechtliche Zertifizierung fur Ihre Organisation verstanden werden.',
            },
          ],
        },
        {
          title: { en: 'Contact and termination', de: 'Kontakt und Beendigung' },
          paragraphs: [
            {
              en: 'If you need help regarding account access, support, or legal requests, use the publicly listed Zero-Carbon channels such as contact@zero-carbon.de or support@zero-carbon.de.',
              de: 'Wenn Sie Hilfe zu Kontozugang, Support oder rechtlichen Anliegen benotigen, nutzen Sie bitte die offentlich genannten Zero-Carbon-Kanale wie contact@zero-carbon.de oder support@zero-carbon.de.',
            },
            {
              en: 'We may update these beta terms as the product matures. Continued use after material updates means the revised terms apply from the effective date shown on this page.',
              de: 'Wir konnen diese Beta-Bedingungen mit der Weiterentwicklung des Produkts aktualisieren. Wenn Sie den Dienst nach wesentlichen Anderungen weiter nutzen, gelten die uberarbeiteten Bedingungen ab dem auf dieser Seite genannten Datum.',
            },
          ],
        },
      ]}
    />
  );
}


