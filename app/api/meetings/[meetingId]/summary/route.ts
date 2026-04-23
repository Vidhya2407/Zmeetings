import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { getMeetingRepo } from '@/lib/meetings/meetingRepository';

type RouteContext = { params: Promise<{ meetingId: string }> };

function formatKg(value: number) {
  return value >= 1 ? `${value.toFixed(2)} kg` : `${(value * 1000).toFixed(1)} g`;
}

function meetingFocus(title: string, lang: 'en' | 'de') {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('climate policy')) {
    return {
      summary: lang === 'de'
        ? 'Die Diskussion behandelte politische Signale, offene Fragen der Teilnehmenden und naechste Schritte fuer die Climate-Policy-Kommunikation.'
        : 'Discussion covered policy signals, attendee questions, and next steps for climate-policy communication.',
      actionItems: lang === 'de'
        ? [
            'Climate-Policy-Brief mit den drei wichtigsten Fragen aus der Q&A aktualisieren.',
            'Antworten fuer offene Regulierungsfragen mit Dr. Sarah Chen abstimmen.',
            'Aufzeichnung und Folgefragen an die angemeldeten Teilnehmenden senden.',
          ]
        : [
            'Update the climate-policy brief with the top three Q&A questions.',
            'Confirm answers for open regulatory questions with Dr. Sarah Chen.',
            'Send the recording and follow-up questions to registered attendees.',
          ],
    };
  }

  if (normalizedTitle.includes('zero waste')) {
    return {
      summary: lang === 'de'
        ? 'Die Session konzentrierte sich auf Workshop-Struktur, Materialplanung und Verantwortlichkeiten fuer die Zero-Waste-Umsetzung.'
        : 'The session focused on workshop structure, materials planning, and ownership for zero-waste execution.',
      actionItems: lang === 'de'
        ? [
            'Zero-Waste-Workshop-Zeitplan mit den Team-Leads teilen.',
            'Material- und Lieferantenliste vor dem naechsten Check-in finalisieren.',
            'Teilnehmerfeedback in die Workshop-Agenda einarbeiten.',
          ]
        : [
            'Share the zero-waste workshop timeline with team leads.',
            'Finalize the materials and vendor list before the next check-in.',
            'Fold attendee feedback into the workshop agenda.',
          ],
    };
  }

  if (normalizedTitle.includes('eco dev')) {
    return {
      summary: lang === 'de'
        ? 'Das Team pruefte Live-Meeting-Flows, technische Blocker und Aufgaben fuer die naechste Entwicklungsrunde.'
        : 'The team reviewed live meeting flows, technical blockers, and tasks for the next development pass.',
      actionItems: lang === 'de'
        ? [
            'Live-Room-Flow fuer Host und Teilnehmer erneut testen.',
            'Offene Meeting-UI-Probleme priorisieren und im Dev-Board aktualisieren.',
            'Naechsten Sync mit Status zu Breakouts, Aufzeichnung und Aktivitaeten vorbereiten.',
          ]
        : [
            'Retest the live-room flow for host and attendee roles.',
            'Prioritize open meeting UI issues and update the dev board.',
            'Prepare the next sync with status on breakouts, recordings, and activity.',
          ],
    };
  }

  return {
    summary: lang === 'de'
      ? `Die Diskussion fuer "${title}" fasste Entscheidungen, offene Fragen und naechste Verantwortlichkeiten zusammen.`
      : `Discussion for "${title}" captured decisions, open questions, and next owners.`,
    actionItems: lang === 'de'
      ? [
          `Notizen und Entscheidungen fuer "${title}" teilen.`,
          'Verantwortliche fuer offene Punkte bestaetigen.',
          'Naechsten Check-in mit aktualisierter Agenda planen.',
        ]
      : [
          `Share notes and decisions for "${title}".`,
          'Confirm owners for open follow-ups.',
          'Schedule the next checkpoint with an updated agenda.',
        ],
  };
}

function statusAction(status: string, lang: 'en' | 'de') {
  if (status === 'live') {
    return lang === 'de'
      ? 'Live-Entscheidungen direkt nach Meeting-Ende in die Zusammenfassung uebernehmen.'
      : 'Capture live decisions into the summary immediately after the meeting ends.';
  }

  if (status === 'ended') {
    return lang === 'de'
      ? 'Abschlussnotiz mit Zusammenfassung, Aufzeichnung und offenen Aufgaben versenden.'
      : 'Send the closing note with summary, recording, and open tasks.';
  }

  return lang === 'de'
    ? 'Agenda, Teilnehmerliste und Beitrittslink vor Start pruefen.'
    : 'Review agenda, attendee list, and join link before start.';
}

export async function GET(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') === 'de' ? 'de' : 'en';
  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  if (!access.canViewMeeting) {
    return apiError('You do not have access to this meeting summary.', 403);
  }

  const meetingResult = await getMeetingRepo(meetingId);
  const meeting = meetingResult.value;
  if (!meeting) {
    return apiError('Meeting not found.', 404);
  }

  const carbonSummary = meeting.carbonSummary;
  const focus = meetingFocus(meeting.title, lang);
  const breakoutContributionLine = carbonSummary
    ? (lang === 'de'
      ? `Gemessene Meeting-Emissionen: ${formatKg(carbonSummary.totalKg)} insgesamt, davon ${formatKg(carbonSummary.breakoutKg)} in Breakout-Raeumen (${carbonSummary.breakoutSharePercent.toFixed(1)}%).`
      : `Measured meeting emissions: ${formatKg(carbonSummary.totalKg)} total, with ${formatKg(carbonSummary.breakoutKg)} from breakout rooms (${carbonSummary.breakoutSharePercent.toFixed(1)}%).`)
    : (lang === 'de'
      ? 'Noch keine breakout-spezifischen Carbon-Messdaten verfuegbar.'
      : 'No breakout-specific carbon telemetry is available yet.');

  const summary = {
    meetingId,
    title: meeting.title,
    summary: lang === 'de'
      ? `${focus.summary} ${breakoutContributionLine}`
      : `${focus.summary} ${breakoutContributionLine}`,
    actionItems: lang === 'de'
      ? [
          ...focus.actionItems,
          statusAction(meeting.status, lang),
          carbonSummary?.breakoutRoomCount
            ? `Breakout-Auswertung pruefen: ${carbonSummary.breakoutRoomCount} Raeume trugen ${formatKg(carbonSummary.breakoutKg)} bei.`
            : 'Keine Breakout-Auswertung notwendig.',
        ]
      : [
          ...focus.actionItems,
          statusAction(meeting.status, lang),
          carbonSummary?.breakoutRoomCount
            ? `Review breakout analysis: ${carbonSummary.breakoutRoomCount} rooms contributed ${formatKg(carbonSummary.breakoutKg)}.`
            : 'No breakout carbon review needed.',
        ],
    carbon: carbonSummary,
  };

  return apiSuccess({ summary }, meetingResult.demoMode ? { _demoMode: true } : {});
}
