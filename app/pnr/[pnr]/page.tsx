import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PnrResultScreen } from '@/components/Pnr/PnrResult';

export const metadata: Metadata = { title: 'PNR status · Train Tracker' };

export default function PnrResultPage({ params }: { params: { pnr: string } }) {
  if (!/^\d{10}$/.test(params.pnr)) notFound();
  return <PnrResultScreen pnr={params.pnr} />;
}
