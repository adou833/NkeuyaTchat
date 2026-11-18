'use client';

import { use, Suspense } from 'react';
import ChatRoom from '../ChatRoom';

interface PageProps {
  params: Promise<{ id: string }>;
}

function SalonContent({ id }: { id: string }) {
  return <ChatRoom salonId={id} />;
}

export default function SalonPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const salonId = resolvedParams.id;

  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0b141a] text-[#8696a0]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent"></div>
          <p className="text-sm font-medium">Chargement du salon...</p>
        </div>
      </div>
    }>
      <SalonContent id={salonId} />
    </Suspense>
  );
}