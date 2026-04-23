'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import {
  DEFAULT_MEETING_USAGE_PROFILE,
  calcEstimatedParticipantRate,
  estimateMeetingEmissionKgFromParticipantMinutes,
} from '@/lib/meetings/carbonCalc';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useAppTranslations } from '@/lib/utils/translations';
import { useHydrated } from '@/hooks/useHydrated';
import type { Meeting } from '@/types/domain/workspace';

type ProjectConfig = {
  id: string;
  name: string;
  hostUserIds: string[];
};

type ProjectSummary = {
  breakoutKg: number;
  breakoutMeetings: number;
  emittedKg: number;
  id: string;
  meetingCount: number;
  name: string;
};

type MeetingImpact = {
  breakoutKg: number;
  estimatedCredits: number;
  emittedKg: number;
  eWasteGrams: number;
  id: string;
  isTracked: boolean;
  participantMinutes: number;
  participants: number;
  projectId: string;
  projectName: string;
  startsAt: string;
  title: string;
  waterLiters: number;
};

const PROJECTS: ProjectConfig[] = [
  { id: 'climate-education', name: 'Climate Education', hostUserIds: ['u1', 'u2'] },
  { id: 'meetings-product', name: 'Meetings Product', hostUserIds: ['u5', 'u6'] },
  { id: 'operations-research', name: 'Operations & Research', hostUserIds: ['u3', 'u4'] },
];

const ALL_PROJECTS_ID = 'all';
const UNKNOWN_PROJECT_ID = 'other';
const UNKNOWN_PROJECT_NAME = 'Cross-Functional';

const USAGE_PROFILE = DEFAULT_MEETING_USAGE_PROFILE;
const TOTAL_G_PER_MIN = calcEstimatedParticipantRate(USAGE_PROFILE);
const KG_PER_CARBON_CREDIT = 1000;
const WATER_L_PER_KG_CO2 = 14.2;
const E_WASTE_G_PER_KG_CO2 = 3.4;

function toMinutes(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 45;
  return Math.max(1, (end - start) / 60000);
}

function toFixedNumber(value: number, precision = 4) {
  return Number(value.toFixed(precision));
}

function resolveProject(hostUserId: string) {
  return PROJECTS.find((project) => project.hostUserIds.includes(hostUserId)) ?? {
    id: UNKNOWN_PROJECT_ID,
    name: UNKNOWN_PROJECT_NAME,
    hostUserIds: [],
  };
}

function getMeetingParticipantCount(meeting: Meeting) {
  return Math.max(meeting.attendeesCount, meeting.participants.length, 1);
}

function estimateMeetingEmissionKg(meeting: Meeting) {
  if (typeof meeting.carbonSummary?.totalKg === 'number' && meeting.carbonSummary.totalKg > 0) {
    return toFixedNumber(meeting.carbonSummary.totalKg);
  }

  const participantMinutes = toMinutes(meeting.startsAt, meeting.endsAt) * getMeetingParticipantCount(meeting);
  return toFixedNumber(estimateMeetingEmissionKgFromParticipantMinutes(participantMinutes, USAGE_PROFILE));
}

function estimatedCreditsFromKg(kgCO2: number) {
  return toFixedNumber(Math.max(0, kgCO2) / KG_PER_CARBON_CREDIT, 8);
}

function calculateImpactTotals(impacts: MeetingImpact[]) {
  const emittedKg = impacts.reduce((sum, meeting) => sum + meeting.emittedKg, 0);
  const breakoutKg = impacts.reduce((sum, meeting) => sum + meeting.breakoutKg, 0);

  return {
    breakoutKg: toFixedNumber(breakoutKg),
    emittedKg: toFixedNumber(emittedKg),
    estimatedCredits: estimatedCreditsFromKg(emittedKg),
    eWasteGrams: emittedKg * E_WASTE_G_PER_KG_CO2,
    meetingCount: impacts.length,
    waterLiters: emittedKg * WATER_L_PER_KG_CO2,
  };
}

function formatKg(value: number) {
  if (value >= 100) return `${value.toFixed(1)} kg CO2`;
  if (value >= 10) return `${value.toFixed(2)} kg CO2`;
  return `${value.toFixed(3)} kg CO2`;
}

function formatKgCompact(value: number) {
  if (value >= 100) return `${value.toFixed(1)} kg`;
  if (value >= 10) return `${value.toFixed(2)} kg`;
  return `${value.toFixed(3)} kg`;
}

function formatLiters(value: number) {
  if (value >= 1000) return `${value.toFixed(0)} L`;
  if (value >= 10) return `${value.toFixed(1)} L`;
  return `${value.toFixed(2)} L`;
}

function formatEwaste(valueInGrams: number) {
  if (valueInGrams >= 1000) return `${(valueInGrams / 1000).toFixed(2)} kg`;
  if (valueInGrams >= 10) return `${valueInGrams.toFixed(1)} g`;
  return `${valueInGrams.toFixed(2)} g`;
}

function formatCredits(value: number) {
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

function replaceTokens(value: string, tokens: Record<string, string>) {
  return Object.entries(tokens).reduce((current, [token, replacement]) => current.replaceAll(`{${token}}`, replacement), value);
}

export default function SustainabilityImpactScreen() {
  const { t, language } = useAppTranslations();
  const router = useRouter();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';

  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState(ALL_PROJECTS_ID);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const panel = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)';
  const softPanel = isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.035)';
  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const heading = isLight ? '#0f172a' : '#ffffff';
  const muted = isLight ? '#64748b' : '#94a3b8';
  const body = isLight ? '#334155' : '#cbd5e1';
  const loadErrorText = t('workspace.impact.error', 'Unable to load sustainability data right now.');
  const tableLabels = {
    carbon: t('workspace.impact.table.carbon', 'Carbon'),
    credits: t('workspace.impact.table.credits', 'Est. credits'),
    ewaste: t('workspace.impact.table.ewaste', 'E-waste'),
    participants: t('workspace.impact.table.participants', 'participants'),
    water: t('workspace.impact.table.water', 'Water'),
  };

  React.useEffect(() => {
    let mounted = true;

    async function loadImpactData() {
      setLoading(true);
      setError(null);

      const meetingsResult = await fetchJsonWithRetry<{ meetings: Meeting[] }>('/api/impact/company', { cache: 'no-store' });

      if (!mounted) return;

      if (meetingsResult.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/impact')}`);
        return;
      }

      if (!meetingsResult.ok) {
        setError(meetingsResult.error ?? loadErrorText);
        setLoading(false);
        return;
      }

      setMeetings(meetingsResult.data?.meetings ?? []);
      setLoading(false);
    }

    void loadImpactData();

    return () => {
      mounted = false;
    };
  }, [loadErrorText, router]);

  const handleProjectSelect = React.useCallback((projectId: string) => {
    setSelectedProjectId((currentProjectId) => (
      currentProjectId === projectId ? ALL_PROJECTS_ID : projectId
    ));
  }, []);

  const meetingImpacts = React.useMemo<MeetingImpact[]>(() => meetings
    .map((meeting) => {
      const project = resolveProject(meeting.hostUserId);
      const participants = getMeetingParticipantCount(meeting);
      const participantMinutes = toMinutes(meeting.startsAt, meeting.endsAt) * participants;
      const emittedKg = estimateMeetingEmissionKg(meeting);
      return {
        breakoutKg: meeting.carbonSummary?.breakoutKg ?? 0,
        emittedKg,
        estimatedCredits: estimatedCreditsFromKg(emittedKg),
        eWasteGrams: emittedKg * E_WASTE_G_PER_KG_CO2,
        id: meeting.id,
        isTracked: Boolean(meeting.carbonSummary?.totalKg),
        participantMinutes,
        participants,
        projectId: project.id,
        projectName: project.name,
        startsAt: meeting.startsAt,
        title: meeting.title,
        waterLiters: emittedKg * WATER_L_PER_KG_CO2,
      };
    })
    .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()), [meetings]);

  const companyTotals = React.useMemo(() => calculateImpactTotals(meetingImpacts), [meetingImpacts]);

  const projectSummaries = React.useMemo<ProjectSummary[]>(() => {
    const summaries = new Map<string, ProjectSummary>();

    for (const project of PROJECTS) {
      summaries.set(project.id, {
        breakoutKg: 0,
        breakoutMeetings: 0,
        emittedKg: 0,
        id: project.id,
        meetingCount: 0,
        name: project.name,
      });
    }

    summaries.set(UNKNOWN_PROJECT_ID, {
      breakoutKg: 0,
      breakoutMeetings: 0,
      emittedKg: 0,
      id: UNKNOWN_PROJECT_ID,
      meetingCount: 0,
      name: UNKNOWN_PROJECT_NAME,
    });

    for (const meeting of meetingImpacts) {
      const project = summaries.get(meeting.projectId);
      if (!project) continue;

      project.meetingCount += 1;
      project.emittedKg += meeting.emittedKg;
      project.breakoutKg += meeting.breakoutKg;
      if (meeting.breakoutKg > 0) project.breakoutMeetings += 1;
    }

    return Array.from(summaries.values()).map((project) => ({
      ...project,
      breakoutKg: toFixedNumber(project.breakoutKg),
      emittedKg: toFixedNumber(project.emittedKg),
    }));
  }, [meetingImpacts]);

  const locale = language === 'de' ? 'de-DE' : 'en-US';

  return (
    <div className="space-y-5">
      <section>
        <div className="rounded-3xl border p-4 md:p-5" style={{ background: panel, borderColor: border }}>
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'rgb(0,229,186)' }}>
            {t('workspace.impact.eyebrow', 'Sustainability Impact')}
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight" style={{ color: heading }}>
            {t('workspace.impact.title', 'Meeting impact, credits, and resource estimates')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: body }}>
            {t('workspace.impact.subtitle', 'Track carbon emissions, water use, e-waste, and estimated carbon credits from your meeting data.')}
          </p>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border px-4 py-3" style={{ background: isLight ? 'rgba(254,242,242,0.86)' : 'rgba(127,29,29,0.22)', borderColor: isLight ? 'rgba(220,38,38,0.2)' : 'rgba(248,113,113,0.35)' }}>
          <p className="text-sm font-semibold" style={{ color: isLight ? '#991b1b' : '#fecaca' }}>{error}</p>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ImpactMetric
          isLight={isLight}
          label={t('workspace.impact.metrics.emissions', 'Meeting emissions')}
          note={t('workspace.impact.metrics.emissionsNote', 'company total estimated')}
          tone="#f97316"
          value={formatKg(companyTotals.emittedKg)}
        />
        <ImpactMetric
          isLight={isLight}
          label={t('workspace.impact.metrics.water', 'Water wastage')}
          note={replaceTokens(t('workspace.impact.metrics.waterNote', '{factor} L per kg CO2'), { factor: WATER_L_PER_KG_CO2.toFixed(1) })}
          tone="#0ea5e9"
          value={formatLiters(companyTotals.waterLiters)}
        />
        <ImpactMetric
          isLight={isLight}
          label={t('workspace.impact.metrics.ewaste', 'E-waste')}
          note={replaceTokens(t('workspace.impact.metrics.ewasteNote', '{factor} g per kg CO2'), { factor: E_WASTE_G_PER_KG_CO2.toFixed(1) })}
          tone="#ec4899"
          value={formatEwaste(companyTotals.eWasteGrams)}
        />
        <ImpactMetric
          isLight={isLight}
          label={t('workspace.impact.metrics.estimatedCredits', 'Estimated carbon credits')}
          note={t('workspace.impact.metrics.creditsNote', 'Verra VCS estimate')}
          info={{
            body: t('workspace.impact.metrics.creditsInfoBody', 'Eco-server delivery is modeled at 28 g CO2/GB versus a 72 g CO2/GB standard streaming baseline. Carbon savings are converted into potential Verra VCS credits, with 1 credit equal to 1 tonne CO2e.'),
            close: t('workspace.impact.metrics.creditsInfoClose', 'OK'),
            label: t('workspace.impact.metrics.creditsInfoLabel', 'About estimated carbon credits'),
            title: t('workspace.impact.metrics.creditsInfoTitle', 'How credits are estimated'),
          }}
          tone="#10b981"
          value={formatCredits(companyTotals.estimatedCredits)}
        />
        <ImpactMetric
          isLight={isLight}
          label={t('workspace.impact.metrics.meetings', 'Meetings')}
          note={t('workspace.impact.metrics.meetingsNote', 'all company meetings')}
          tone="#8b5cf6"
          value={`${companyTotals.meetingCount}`}
        />
      </section>

      <section className="rounded-3xl border p-4 md:p-5" style={{ background: panel, borderColor: border }}>
        <h3 className="text-xl font-black leading-tight" style={{ color: heading }}>
          {t('workspace.impact.portfolio.title', 'Project impact details')}
        </h3>
        <p className="mt-1 text-sm leading-6" style={{ color: body }}>
          {t('workspace.impact.portfolio.subtitle', 'Open a project, then open a meeting to inspect carbon, water, e-waste, credits, and calculation logic.')}
        </p>
        <div className="mt-5 space-y-3">
          {projectSummaries.map((project) => {
            const selected = selectedProjectId === project.id;
            const projectMeetings = meetingImpacts.filter((meeting) => meeting.projectId === project.id);
            const projectWaterLiters = project.emittedKg * WATER_L_PER_KG_CO2;
            const projectEWasteGrams = project.emittedKg * E_WASTE_G_PER_KG_CO2;
            const projectCredits = estimatedCreditsFromKg(project.emittedKg);
            return (
              <article
                key={project.id}
                className="overflow-hidden rounded-2xl border"
                style={{
                  background: softPanel,
                  borderColor: border,
                }}
              >
                <button
                  aria-expanded={selected}
                  aria-label={replaceTokens(t('workspace.impact.portfolio.openProject', 'Open {project} impact details'), { project: project.name })}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors md:px-5"
                  onClick={() => handleProjectSelect(project.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black" style={{ color: heading }}>{project.name}</span>
                    <span className="mt-1 block text-xs font-bold" style={{ color: muted }}>
                      {replaceTokens(t('workspace.impact.portfolio.meta', '{count} meetings | {credits} estimated credits'), {
                        count: `${project.meetingCount}`,
                        credits: formatCredits(projectCredits),
                      })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-base font-black" style={{ color: '#f97316' }}>{formatKgCompact(project.emittedKg)}</span>
                    <span className="grid h-8 w-8 place-items-center rounded-full border text-lg font-black" style={{ borderColor: border, color: heading }}>
                      {selected ? '-' : '+'}
                    </span>
                  </span>
                </button>

                {selected ? (
                  <div className="border-t px-4 py-4 md:px-5" style={{ background: panel, borderColor: border }}>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <ImpactDetailMetric isLight={isLight} label={t('workspace.impact.table.carbon', 'Carbon')} tone="#f97316" value={formatKg(project.emittedKg)} />
                      <ImpactDetailMetric isLight={isLight} label={t('workspace.impact.table.water', 'Water')} tone="#0ea5e9" value={formatLiters(projectWaterLiters)} />
                      <ImpactDetailMetric isLight={isLight} label={t('workspace.impact.table.ewaste', 'E-waste')} tone="#ec4899" value={formatEwaste(projectEWasteGrams)} />
                      <ImpactDetailMetric isLight={isLight} label={t('workspace.impact.table.credits', 'Est. credits')} tone="#10b981" value={formatCredits(projectCredits)} />
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: muted }}>
                        {t('workspace.impact.perMeeting.title', 'Meeting impact breakdown')}
                      </p>
                      {projectMeetings.length ? projectMeetings.map((meeting) => (
                        <MeetingCalculationDetails
                          body={body}
                          border={border}
                          heading={heading}
                          isLight={isLight}
                          key={meeting.id}
                          labels={tableLabels}
                          locale={locale}
                          meeting={meeting}
                          muted={muted}
                          calculationLabel={t('workspace.impact.calculation.title', 'How it is calculated')}
                          estimatedEmissionValue={t('workspace.impact.calculation.estimatedEmissionValue', 'participant minutes x {rate} g/min / 1000 = {carbon}')}
                          trackedEmissionValue={t('workspace.impact.calculation.trackedEmissionValue', 'tracked room telemetry = {carbon}')}
                          waterResultValue={t('workspace.impact.calculation.waterResultValue', 'emitted kg CO2 x {factor} L/kg = {water}')}
                          ewasteResultValue={t('workspace.impact.calculation.ewasteResultValue', 'emitted kg CO2 x {factor} g/kg = {ewaste}')}
                          creditsResultValue={t('workspace.impact.calculation.creditsResultValue', 'emitted kg CO2 / 1000 = {credits} estimated credits')}
                          estimatedLabel={t('workspace.impact.badges.estimated', 'Estimated')}
                          trackedLabel={t('workspace.impact.badges.tracked', 'Tracked')}
                        />
                      )) : (
                        <p className="rounded-2xl border px-4 py-4 text-sm font-semibold" style={{ borderColor: border, color: muted }}>
                          {loading ? t('workspace.impact.loading', 'Loading impact data...') : t('workspace.impact.empty', 'No meeting impact data is available for this view yet.')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ImpactMetric({
  info,
  isLight,
  label,
  note,
  tone,
  value,
}: {
  info?: {
    body: string;
    close: string;
    label: string;
    title: string;
  };
  isLight: boolean;
  label: string;
  note: string;
  tone: string;
  value: string;
}) {
  const [infoOpen, setInfoOpen] = React.useState(false);

  return (
    <div className="relative rounded-2xl border p-3.5" style={{ background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.04)', borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }}>
      {info ? (
        <button
          aria-expanded={infoOpen}
          aria-label={info.label}
          className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border text-[11px] font-black leading-none transition hover:scale-105"
          onClick={() => setInfoOpen((current) => !current)}
          style={{
            background: isLight ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.12)',
            borderColor: isLight ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.28)',
            color: '#10b981',
          }}
          title={info.label}
          type="button"
        >
          i
        </button>
      ) : null}
      <p className="pr-8 text-xs font-black uppercase tracking-[0.14em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{label}</p>
      <p className="mt-2 break-words text-2xl font-black leading-none" style={{ color: tone }}>{value}</p>
      <p className="mt-2 text-xs font-semibold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{note}</p>
      {info && infoOpen ? (
        <div
          className="absolute right-3 top-11 z-20 w-[min(18rem,calc(100vw-3rem))] rounded-2xl border p-3 shadow-xl"
          style={{
            background: isLight ? '#ffffff' : '#0f172a',
            borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.14)',
            color: isLight ? '#334155' : '#cbd5e1',
          }}
        >
          <p className="text-sm font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{info.title}</p>
          <p className="mt-2 text-xs font-semibold leading-5">{info.body}</p>
          <button
            className="mt-3 h-8 rounded-full px-4 text-xs font-black"
            onClick={() => setInfoOpen(false)}
            style={{ background: 'rgb(0,229,186)', color: '#061018' }}
            type="button"
          >
            {info.close}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ImpactDetailMetric({ isLight, label, tone, value }: { isLight: boolean; label: string; tone: string; value: string }) {
  return (
    <div
      className="rounded-2xl border px-3 py-3"
      style={{
        background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.045)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{label}</p>
      <p className="mt-1 break-words text-lg font-black" style={{ color: tone }}>{value}</p>
    </div>
  );
}

function FormulaLine({ border, heading, isLight, label, value }: { border: string; heading: string; isLight: boolean; label: string; value: string }) {
  return (
    <div className="rounded-2xl border px-3 py-3" style={{ borderColor: border, background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }}>
      <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6" style={{ color: heading }}>{value}</p>
    </div>
  );
}

function MeetingCalculationDetails({
  body,
  border,
  calculationLabel,
  creditsResultValue,
  estimatedEmissionValue,
  estimatedLabel,
  ewasteResultValue,
  heading,
  isLight,
  labels,
  locale,
  meeting,
  muted,
  trackedLabel,
  trackedEmissionValue,
  waterResultValue,
}: {
  body: string;
  border: string;
  calculationLabel: string;
  creditsResultValue: string;
  estimatedEmissionValue: string;
  estimatedLabel: string;
  ewasteResultValue: string;
  heading: string;
  isLight: boolean;
  labels: {
    carbon: string;
    credits: string;
    ewaste: string;
    participants: string;
    water: string;
  };
  locale: string;
  meeting: MeetingImpact;
  muted: string;
  trackedLabel: string;
  trackedEmissionValue: string;
  waterResultValue: string;
}) {
  const dateLabel = new Date(meeting.startsAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const sourceLabel = meeting.isTracked ? trackedLabel : estimatedLabel;
  const formulaBackground = isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.035)';
  const emissionFormula = meeting.isTracked
    ? replaceTokens(trackedEmissionValue, { carbon: formatKg(meeting.emittedKg) })
    : replaceTokens(estimatedEmissionValue, {
      carbon: formatKg(meeting.emittedKg),
      minutes: meeting.participantMinutes.toFixed(0),
      rate: TOTAL_G_PER_MIN.toFixed(4),
    });

  return (
    <details className="group overflow-hidden rounded-2xl border" style={{ borderColor: border, background: formulaBackground }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-sm font-black" style={{ color: heading }}>{meeting.title}</span>
            <span className="rounded-full px-2 py-0.5 text-xs font-black" style={{ background: meeting.isTracked ? 'rgba(16,185,129,0.14)' : 'rgba(14,165,233,0.14)', color: meeting.isTracked ? '#10b981' : '#0ea5e9' }}>
              {sourceLabel}
            </span>
          </span>
          <span className="mt-1 block text-xs font-semibold" style={{ color: muted }}>{dateLabel} | {meeting.participants} {labels.participants}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm font-black sm:block" style={{ color: body }}>{formatKg(meeting.emittedKg)}</span>
          <span className="grid h-8 w-8 place-items-center rounded-full border text-lg font-black" style={{ borderColor: border, color: heading }}>
            <span className="group-open:hidden">+</span>
            <span className="hidden group-open:block">-</span>
          </span>
        </span>
      </summary>

      <div className="border-t px-4 py-4" style={{ borderColor: border }}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ImpactDetailMetric isLight={isLight} label={labels.carbon} tone="#f97316" value={formatKg(meeting.emittedKg)} />
          <ImpactDetailMetric isLight={isLight} label={labels.water} tone="#0ea5e9" value={formatLiters(meeting.waterLiters)} />
          <ImpactDetailMetric isLight={isLight} label={labels.ewaste} tone="#ec4899" value={formatEwaste(meeting.eWasteGrams)} />
          <ImpactDetailMetric isLight={isLight} label={labels.credits} tone="#10b981" value={formatCredits(meeting.estimatedCredits)} />
        </div>

        <p className="mt-4 text-xs font-black uppercase tracking-[0.14em]" style={{ color: muted }}>{calculationLabel}</p>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <FormulaLine border={border} heading={heading} isLight={isLight} label={labels.carbon} value={emissionFormula} />
          <FormulaLine
            border={border}
            heading={heading}
            isLight={isLight}
            label={labels.water}
            value={replaceTokens(waterResultValue, {
              factor: WATER_L_PER_KG_CO2.toFixed(1),
              water: formatLiters(meeting.waterLiters),
            })}
          />
          <FormulaLine
            border={border}
            heading={heading}
            isLight={isLight}
            label={labels.ewaste}
            value={replaceTokens(ewasteResultValue, {
              ewaste: formatEwaste(meeting.eWasteGrams),
              factor: E_WASTE_G_PER_KG_CO2.toFixed(1),
            })}
          />
          <FormulaLine
            border={border}
            heading={heading}
            isLight={isLight}
            label={labels.credits}
            value={replaceTokens(creditsResultValue, {
              credits: formatCredits(meeting.estimatedCredits),
            })}
          />
        </div>
      </div>
    </details>
  );
}
