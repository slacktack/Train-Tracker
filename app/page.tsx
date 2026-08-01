import { SearchBar } from '@/components/SearchBar';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4x bg-surface px-3x">
      <h1 className="text-2xl font-semibold">Train-Tracker</h1>
      <SearchBar />
    </main>
  );
}
