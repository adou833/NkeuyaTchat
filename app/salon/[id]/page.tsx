'use client';

import { useParams } from 'next/navigation';
import ChatRoom from '../ChatRoom';

export default function SalonPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const resolvedId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!resolvedId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#111b21] text-sm font-bold text-blue-400">
        Chargement du salon...
      </div>
    );
  }

  return <ChatRoom salonId={resolvedId} />;
}