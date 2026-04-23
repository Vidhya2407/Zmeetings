import type { Metadata } from 'next';
import LegalDocument from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the ZSTREAM beta application.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      eyebrow={{ en: 'Legal', de: 'Rechtliches' }}
      title={{ en: 'Privacy Policy', de: 'Datenschutzerklarung' }}
      intro={{
        en: 'This Privacy Policy explains how ZSTREAM and Zero-Carbon handle personal information in the current beta application, including account access, platform usage, support interactions, and sustainability-related product analytics.',
        de: 'Diese Datenschutzerklarung beschreibt, wie ZSTREAM und Zero-Carbon personenbezogene Daten in der aktuellen Beta-Anwendung verarbeiten, einschliesslich Kontozugang, Plattformnutzung, Support-Anfragen und nachhaltigkeitsbezogener Produktanalysen.',
      }}
      lastUpdated={{ en: 'March 27, 2026', de: '27. Marz 2026' }}
      showBackButton
      sourceNote={{
        en: 'Based on Zero-Carbon public site legal references and privacy-first product statements published at zero-carbon.de, including the public footer legal navigation, cookie disclosures, contact details, and privacy messaging. This version is adapted for the ZSTREAM beta product experience.',
        de: 'Basiert auf den offentlich sichtbaren rechtlichen Hinweisen und Privacy-First-Aussagen von zero-carbon.de, einschliesslich Footer-Navigation, Cookie-Hinweisen, Kontaktdaten und Datenschutzbotschaften. Diese Version wurde fur die ZSTREAM-Beta angepasst.',
      }}
      sections={[
        {
          title: { en: 'Who controls your data', de: 'Wer Ihre Daten verantwortet' },
          paragraphs: [
            {
              en: 'For the beta application, the service is operated under the Zero-Carbon brand. Public contact details currently shown on zero-carbon.de include contact@zero-carbon.de, support@zero-carbon.de, and partnerships@zero-carbon.de, with an Essen, Germany office reference.',
              de: 'Fur die Beta-Anwendung wird der Dienst unter der Marke Zero-Carbon betrieben. Auf zero-carbon.de offentlich angezeigte Kontaktdaten sind derzeit contact@zero-carbon.de, support@zero-carbon.de und partnerships@zero-carbon.de sowie ein Standortverweis auf Essen, Deutschland.',
            },
            {
              en: 'If you have questions about privacy, access requests, correction requests, or deletion requests, please contact the support channel listed above so your request can be routed correctly during beta operations.',
              de: 'Wenn Sie Fragen zu Datenschutz, Auskunft, Berichtigung oder Loschung haben, nutzen Sie bitte den oben genannten Support-Kanal, damit Ihre Anfrage im Beta-Betrieb korrekt bearbeitet werden kann.',
            },
          ],
        },
        {
          title: { en: 'What we collect', de: 'Welche Daten wir erfassen' },
          bullets: [
            {
              en: 'Account data such as name, email address, login credentials, role, and profile preferences.',
              de: 'Kontodaten wie Name, E-Mail-Adresse, Zugangsdaten, Rolle und Profilpraferenzen.',
            },
            {
              en: 'Platform usage data such as session activity, navigation patterns, device information, and security logs needed to operate and protect the service.',
              de: 'Nutzungsdaten der Plattform wie Sitzungsaktivitat, Navigationsmuster, Gerateinformationen und Sicherheitsprotokolle, die fur Betrieb und Schutz des Dienstes erforderlich sind.',
            },
            {
              en: 'Preference data such as selected language, theme, playback settings, and consent choices.',
              de: 'Praferenzdaten wie Sprache, Theme, Wiedergabeeinstellungen und Einwilligungsentscheidungen.',
            },
            {
              en: 'Support and communication data when you contact the Zero-Carbon or ZSTREAM team.',
              de: 'Support- und Kommunikationsdaten, wenn Sie das Zero-Carbon- oder ZSTREAM-Team kontaktieren.',
            },
          ],
        },
        {
          title: { en: 'How we use information', de: 'Wie wir Informationen verwenden' },
          bullets: [
            {
              en: 'To create and secure accounts, authenticate users, and support password recovery or OTP-based verification when enabled.',
              de: 'Zur Erstellung und Absicherung von Konten, zur Authentifizierung von Nutzerinnen und Nutzern sowie fur Passwortwiederherstellung oder OTP-Verifizierung, sofern aktiviert.',
            },
            {
              en: 'To operate the streaming platform, personalize the interface, and maintain core platform features.',
              de: 'Zum Betrieb der Streaming-Plattform, zur Personalisierung der Oberflache und zur Aufrechterhaltung zentraler Plattformfunktionen.',
            },
            {
              en: 'To measure beta reliability, detect abuse, prevent fraud, troubleshoot issues, and improve the product.',
              de: 'Zur Messung der Beta-Zuverlassigkeit, zur Erkennung von Missbrauch, zur Betrugspravention, zur Fehleranalyse und zur Produktverbesserung.',
            },
            {
              en: 'To provide sustainability and carbon-impact related platform metrics, where those metrics are available within the app.',
              de: 'Zur Bereitstellung von Nachhaltigkeits- und Klimawirkungsmetriken, soweit diese innerhalb der App verfugbar sind.',
            },
          ],
        },
        {
          title: { en: 'Privacy-first product principles', de: 'Privacy-First-Grundsatze' },
          paragraphs: [
            {
              en: 'Zero-Carbon publicly describes the platform as privacy-first and explicitly states that viewing habits stay private and encrypted. The beta app follows the same direction by limiting data use to operational, security, support, and product-improvement purposes.',
              de: 'Zero-Carbon beschreibt die Plattform offentlich als privacy-first und betont, dass Sehgewohnheiten privat und verschlusselt bleiben. Die Beta-App folgt demselben Ansatz und beschrankt die Datennutzung auf Betrieb, Sicherheit, Support und Produktverbesserung.',
            },
            {
              en: 'We do not treat personal data as something to sell. Where providers are used for infrastructure, authentication, email, analytics, or storage, they are intended to act as service providers supporting delivery of the product.',
              de: 'Wir behandeln personenbezogene Daten nicht als Ware zum Verkauf. Wenn Anbieter fur Infrastruktur, Authentifizierung, E-Mail, Analysen oder Speicherung eingesetzt werden, dienen sie der technischen Bereitstellung des Produkts.',
            },
          ],
        },
        {
          title: { en: 'Legal bases and retention', de: 'Rechtsgrundlagen und Speicherdauer' },
          paragraphs: [
            {
              en: 'Depending on the feature, data may be processed to perform the service you request, to meet legal obligations, based on your consent, or based on legitimate interests such as security, abuse prevention, and product reliability.',
              de: 'Je nach Funktion konnen Daten verarbeitet werden, um den angeforderten Dienst zu erbringen, gesetzliche Pflichten zu erfullen, auf Ihrer Einwilligung zu beruhen oder berechtigte Interessen wie Sicherheit, Missbrauchspravention und Produktzuverlassigkeit wahrzunehmen.',
            },
            {
              en: 'Personal data is retained only for as long as needed for account operations, security, support, beta program administration, and legal compliance. Security logs and backups may remain for a limited period after account changes or deletion requests.',
              de: 'Personenbezogene Daten werden nur so lange gespeichert, wie sie fur Kontobetrieb, Sicherheit, Support, Beta-Programmverwaltung und rechtliche Pflichten benotigt werden. Sicherheitsprotokolle und Backups konnen nach Anderungen oder Loschungsanfragen fur einen begrenzten Zeitraum bestehen bleiben.',
            },
          ],
        },
        {
          title: { en: 'Your rights', de: 'Ihre Rechte' },
          bullets: [
            {
              en: 'Request access to the data associated with your account.',
              de: 'Auskunft uber die mit Ihrem Konto verbundenen Daten verlangen.',
            },
            {
              en: 'Request correction of inaccurate account information.',
              de: 'Berichtigung unrichtiger Kontoinformationen verlangen.',
            },
            {
              en: 'Request deletion of your beta account, subject to legal or security retention needs.',
              de: 'Loschung Ihres Beta-Kontos verlangen, vorbehaltlich gesetzlicher oder sicherheitsrelevanter Aufbewahrungspflichten.',
            },
            {
              en: 'Withdraw consent where processing depends on consent, including optional cookie preferences.',
              de: 'Eine Einwilligung widerrufen, sofern die Verarbeitung darauf beruht, einschliesslich optionaler Cookie-Einstellungen.',
            },
            {
              en: 'Raise a complaint with the relevant supervisory authority if applicable.',
              de: 'Sich gegebenenfalls bei der zustandigen Aufsichtsbehorde beschweren.',
            },
          ],
        },
      ]}
    />
  );
}



