import type { Metadata } from 'next';
import { StationHome } from '@/components/Station/StationHome';

export const metadata: Metadata = { title: 'Station boards · Train Tracker' };

export default function StationIndexPage() {
  return <StationHome />;
}
