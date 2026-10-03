import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StationBoardScreen } from '@/components/Station/StationBoardScreen';

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  return { title: `${params.code.toUpperCase()} board · Train Tracker` };
}

export default function StationPage({ params }: { params: { code: string } }) {
  if (!/^[A-Za-z0-9]{1,6}$/.test(params.code)) notFound();
  return <StationBoardScreen code={params.code.toUpperCase()} />;
}
