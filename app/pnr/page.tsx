import type { Metadata } from 'next';
import { PnrLookup } from '@/components/Pnr/PnrLookup';

export const metadata: Metadata = { title: 'PNR status · Train Tracker' };

export default function PnrPage() {
  return <PnrLookup />;
}
