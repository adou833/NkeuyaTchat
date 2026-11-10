'use client';

import ChatRoom from '@/components/ChatRoom';

export default function SalonPage() {
  return (
    <main className="fixed inset-0 w-full h-[100dvh] overflow-hidden flex flex-col">
      <ChatRoom />
    </main>
  );
}