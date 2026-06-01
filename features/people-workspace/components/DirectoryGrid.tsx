'use client';

import type { WorkspaceUser } from '@/types/domain/workspace';
import ContactCard from './ContactCard';

export default function DirectoryGrid({
  isLight,
  people,
  onInvite,
  onMessage,
}: {
  isLight: boolean;
  people: WorkspaceUser[];
  onInvite: (user: WorkspaceUser) => void;
  onMessage: (user: WorkspaceUser) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => (
        <ContactCard key={person.id} isLight={isLight} onInvite={onInvite} onMessage={onMessage} user={person} />
      ))}
    </div>
  );
}
