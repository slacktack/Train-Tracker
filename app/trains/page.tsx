import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TrainsScreen } from '@/components/Trains/TrainsScreen';

export const metadata: Metadata = { title: 'Find trains · Train Tracker' };

export default function TrainsPage() {
  return (
    <Suspense fallback={null}>
      <TrainsScreen />
    </Suspense>
  );
}
