import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeatsScreen } from '@/components/Trains/SeatsScreen';

export const metadata: Metadata = { title: 'Coaches & seats · Train Tracker' };

export default function SeatsPage({ params, searchParams }: { params: { trainNumber: string }; searchParams: { station?: string; date?: string } }) {
  if (!/^\d{5}$/.test(params.trainNumber)) notFound();
  return <SeatsScreen trainNumber={params.trainNumber} station={searchParams.station?.toUpperCase() ?? null} date={searchParams.date ?? null} />;
}
