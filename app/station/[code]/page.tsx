import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StationBoardScreen } from '@/components/Station/StationBoardScreen';

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  return { title: `${params.code.toUpperCase()} board · Train Tracker` };
}

export default function StationPage({ params, searchParams }: { params: { code: string }; searchParams: { train?: string } }) {
  if (!/^[A-Za-z0-9]{1,6}$/.test(params.code)) notFound();
  const train = /^\d{5}$/.test(searchParams.train ?? '') ? searchParams.train : undefined;
  return <StationBoardScreen code={params.code.toUpperCase()} train={train} />;
}
