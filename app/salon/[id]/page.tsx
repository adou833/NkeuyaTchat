'use client';

import { use } from 'react';
import ChatRoom from '@/components/ChatRoom';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function SalonPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const salonId = resolvedParams.id;

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ChatRoom salonId={salonId} />
    </main>
  );
}
