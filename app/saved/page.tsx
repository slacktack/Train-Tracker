import type { Metadata } from 'next';
import { SavedScreen } from '@/components/Saved/SavedScreen';

export const metadata: Metadata = { title: 'Saved · Train Tracker' };

export default function SavedPage() {
  return <SavedScreen />;
}
