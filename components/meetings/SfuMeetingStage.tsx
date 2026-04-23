'use client';

import * as React from 'react';
import {
  Participant,
  Room,
  Track,
} from 'livekit-client';
import { useAppTranslations } from '@/lib/utils/translations';
import type { SfuParticipantState } from '@/types/domain/sfu';

type SfuMeetingStageProps = {
  hostName: string;
  isLight: boolean;
  localParticipantId: string | null;
  participants: SfuParticipantState[];
  room: Room | null;
  title: string;
};

function findParticipant(room: Room | null, participantId: string) {
  if (!room) return null;
  if (room.localParticipant?.identity === participantId) {
    return room.localParticipant;
  }
  return room.remoteParticipants.get(participantId) ?? null;
}

function getVideoPublication(participant: Participant | null) {
  if (!participant) return undefined;

  const screenShare = participant.getTrackPublication(Track.Source.ScreenShare);
  if (screenShare?.track && !screenShare.isMuted) {
    return screenShare;
  }

  const camera = participant.getTrackPublication(Track.Source.Camera);
  if (camera?.track && !camera.isMuted) {
    return camera;
  }

  return undefined;
}

function getAudioPublication(participant: Participant | null) {
  if (!participant) return undefined;
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  if (microphone?.track && !microphone.isMuted) {
    return microphone;
  }
  return undefined;
}

function initialsFor(name: string) {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'Z';
}

function mediaSummary(participant: SfuParticipantState, isGerman: boolean) {
  if (participant.media.screenShare) return isGerman ? 'Praesentiert' : 'Presenting';
  if (participant.media.camera && participant.media.microphone) return isGerman ? 'Kamera + Mikro an' : 'Camera + mic on';
  if (participant.media.camera) return isGerman ? 'Kamera an' : 'Camera on';
  if (participant.media.microphone) return isGerman ? 'Mikro an' : 'Mic on';
  return isGerman ? 'Zuhoeren' : 'Listening';
}

export default function SfuMeetingStage(props: SfuMeetingStageProps) {
  const { isGerman } = useAppTranslations();
  const {
    hostName,
    isLight,
    localParticipantId,
    participants,
    room,
    title,
  } = props;

  const featuredParticipant = React.useMemo(() => (
    participants.find((participant) => participant.media.screenShare)
    ?? participants.find((participant) => !participant.isLocal && participant.media.camera)
    ?? participants.find((participant) => participant.id === localParticipantId)
    ?? participants[0]
    ?? null
  ), [localParticipantId, participants]);

  const thumbnailParticipants = React.useMemo(() => (
    participants
      .filter((participant) => participant.id !== featuredParticipant?.id)
      .slice(0, 4)
  ), [featuredParticipant?.id, participants]);

  const panelBorder = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)';
  const panelBg = isLight ? 'rgba(255,255,255,0.14)' : 'rgba(3,7,18,0.26)';
  const textPrimary = isLight ? '#0f172a' : '#f8fafc';
  const textSecondary = isLight ? '#334155' : 'rgba(226,232,240,0.8)';

  return (
    <div className="absolute inset-0">
      {participants
        .filter((participant) => !participant.isLocal && participant.media.microphone)
        .map((participant) => (
          <ParticipantAudioRenderer
            key={participant.id}
            participantId={participant.id}
            room={room}
          />
        ))}

      <div
        className="absolute inset-x-6 top-6 bottom-28 overflow-hidden rounded-[28px] border shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        style={{
          borderColor: panelBorder,
          background: 'linear-gradient(135deg,rgba(15,23,42,0.18),rgba(15,23,42,0.34))',
        }}
      >
        {featuredParticipant ? (
          <ParticipantVideoSurface
            isFeatured
            isLight={isLight}
            muted={featuredParticipant.isLocal}
            participant={featuredParticipant}
            room={room}
          />
        ) : null}

        <div className="pointer-events-none absolute left-5 top-5 flex max-w-[min(32rem,calc(100%-2.5rem))] flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]"
            style={{
              borderColor: 'rgba(16,185,129,0.28)',
              background: 'rgba(16,185,129,0.12)',
              color: '#6ee7b7',
            }}
          >
            {isGerman ? 'Live-Medien' : 'Live media'}
          </span>
          <span
            className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur"
            style={{ borderColor: panelBorder, background: panelBg, color: textPrimary }}
          >
            {title}
          </span>
          <span
            className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur"
            style={{ borderColor: panelBorder, background: panelBg, color: textSecondary }}
          >
            {isGerman ? `Host: ${hostName}` : `Hosted by ${hostName}`}
          </span>
        </div>

        {featuredParticipant ? (
          <div className="pointer-events-none absolute bottom-5 left-5 flex max-w-[min(24rem,calc(100%-2.5rem))] flex-col gap-1 rounded-2xl border px-4 py-3 backdrop-blur">
            <span className="text-sm font-black" style={{ color: textPrimary }}>
              {featuredParticipant.displayName}
            </span>
            <span className="text-xs" style={{ color: textSecondary }}>
              {mediaSummary(featuredParticipant, isGerman)}
            </span>
          </div>
        ) : null}

        {thumbnailParticipants.length ? (
          <div className="absolute bottom-5 right-5 flex max-w-[min(28rem,calc(100%-2.5rem))] gap-3 overflow-x-auto pb-1">
            {thumbnailParticipants.map((participant) => (
              <div
                key={participant.id}
                className="w-36 shrink-0 rounded-2xl border p-2 backdrop-blur"
                style={{ borderColor: panelBorder, background: panelBg }}
              >
                <ParticipantVideoSurface
                  isLight={isLight}
                  muted={participant.isLocal}
                  participant={participant}
                  room={room}
                />
                <div className="mt-2 px-1">
                  <div className="truncate text-xs font-black" style={{ color: textPrimary }}>
                    {participant.displayName}
                  </div>
                  <div className="truncate text-[11px]" style={{ color: textSecondary }}>
                    {mediaSummary(participant, isGerman)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ParticipantVideoSurface({
  isFeatured = false,
  isLight,
  muted,
  participant,
  room,
}: {
  isFeatured?: boolean;
  isLight: boolean;
  muted: boolean;
  participant: SfuParticipantState;
  room: Room | null;
}) {
  const { isGerman } = useAppTranslations();
  const videoElementRef = React.useRef<HTMLVideoElement | null>(null);
  const livekitParticipant = findParticipant(room, participant.id);
  const publication = getVideoPublication(livekitParticipant);
  const track = publication?.track;

  React.useEffect(() => {
    const element = videoElementRef.current;
    if (!element || !track || track.kind !== Track.Kind.Video) {
      if (element) {
        element.srcObject = null;
      }
      return undefined;
    }

    track.attach(element);
    return () => {
      track.detach(element);
      element.srcObject = null;
    };
  }, [track]);

  const hasVideoTrack = Boolean(track && track.kind === Track.Kind.Video);
  const roundedClass = isFeatured ? 'h-full w-full' : 'aspect-[4/3] w-full rounded-xl';
  const textPrimary = isLight ? '#0f172a' : '#f8fafc';
  const textSecondary = isLight ? '#475569' : 'rgba(226,232,240,0.78)';

  return hasVideoTrack ? (
    <video
      ref={videoElementRef}
      autoPlay
      className={`${roundedClass} object-cover`}
      muted={muted}
      playsInline
    />
  ) : (
    <div
      className={`${roundedClass} flex items-center justify-center overflow-hidden`}
      style={{
        background: isLight
          ? 'radial-gradient(circle at 30% 20%, rgba(52,211,153,0.75), rgba(14,165,233,0.58) 58%, rgba(15,23,42,0.82) 100%)'
          : 'radial-gradient(circle at 30% 20%, rgba(52,211,153,0.52), rgba(14,165,233,0.46) 58%, rgba(15,23,42,0.92) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/20 text-2xl font-black text-white">
          {initialsFor(participant.displayName)}
        </div>
        <div>
          <div className="text-sm font-black" style={{ color: textPrimary }}>
            {participant.displayName}
          </div>
          <div className="text-xs" style={{ color: textSecondary }}>
            {participant.media.microphone
              ? (isGerman ? 'Audio live' : 'Audio live')
              : (isGerman ? 'Warten auf Video' : 'Waiting for video')}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantAudioRenderer({
  participantId,
  room,
}: {
  participantId: string;
  room: Room | null;
}) {
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);
  const livekitParticipant = findParticipant(room, participantId);
  const publication = getAudioPublication(livekitParticipant);
  const track = publication?.track;

  React.useEffect(() => {
    const element = audioElementRef.current;
    if (!element || !track || track.kind !== Track.Kind.Audio) {
      if (element) {
        element.srcObject = null;
      }
      return undefined;
    }

    track.attach(element);
    return () => {
      track.detach(element);
      element.srcObject = null;
    };
  }, [track]);

  return <audio ref={audioElementRef} autoPlay className="hidden" playsInline />;
}
