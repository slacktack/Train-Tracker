import { TrackingScreen } from './TrackingScreen';

export default function TrackPage({ params }: { params: { trainNumber: string } }) {
  return <TrackingScreen trainNumber={params.trainNumber} />;
}
