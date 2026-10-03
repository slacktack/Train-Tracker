import { readDisk, writeDisk } from './disk-cache';
import { fetchJson } from './http';
import { getOfflineTrain } from './offline';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'TrainTracker/0.1 (localhost personal project)';
const FILE = 'train-photos.json';

export interface TrainPhoto {
  thumb: string;
  credit: string;
  license: string;
  pageUrl: string;
  /** true when the photo is of this exact train number, false for a representative photo of its type */
  exact: boolean;
}

interface Candidate {
  title: string;
  thumb: string;
  width: number;
  license: string;
  artist: string;
  pageUrl: string;
}

const TYPE_QUERY: Record<string, string[]> = {
  VNDB: ['Vande Bharat Express train'],
  RAJ: ['Rajdhani Express train India'],
  SHT: ['Shatabdi Express train India'],
  DRNT: ['Duronto Express train India'],
  TEJ: ['Tejas Express India train'],
  GBR: ['Garib Rath Express train'],
  JSH: ['Jan Shatabdi Express train'],
  AMTB: ['Amrit Bharat Express train'],
  SUF: ['Superfast Express train India WAP-7', 'Indian Railways superfast express'],
  MEX: ['Express train India WAP-7 locomotive', 'Indian Railways express train running'],
  PEXP: ['Indian Railways parcel train'],
  TOD: ['Indian Railways special train'],
  PAS: ['Indian Railways passenger train locomotive', 'WDM-3A passenger train India'],
  MEMU: ['MEMU train India'],
  DMU: ['DEMU train India'],
  SUB: ['Mumbai suburban railway EMU train'],
  EMU: ['Mumbai suburban railway EMU train'],
  PILT: ['Indian Railways locomotive WAP-7'],
};

const BAD = /\b(breakfast|lunch|dinner|meal|interiors?|inside|berth|toilet|cabin|passengers?|crowd|people|vendor|tea|cab|cockpit|map|logo|route|timetable|schedule|interior|seat|food|menu|ticket|diagram|chart|flag|icon|signal|bridge)\b|\.svg$|\.gif$|\.png$/i;
const NC = /\bNC\b|non-?commercial/i;
// Only accept photos that are clearly Indian rail; the search is fuzzy and returns foreign trains.
const INDIAN = /india|indian railways|\bwap-?\d|\bwag-?\d|\bwdp|\bwdm|\bwdg|\bmemu|\bdemu|rajdhani|shatabdi|duronto|vande|tejas|garib rath|humsafar|amrit bharat|jan shatabdi|intercity|mumbai|delhi|kolkata|howrah|chennai|bengaluru|bangalore|pune|jaipur|lucknow|nagpur|ahmedabad|bhopal|patna|\bjn\b|junction/i;
const FOREIGN = /pacific|australia|amtrak|japan|shinkansen|china|europe|germany|uk\b|russia|ghan|sri lanka|nepal|bangladesh|pakistan/i;

const memory = new Map<string, Candidate[]>();
let disk: Record<string, Candidate[]> | null = null;
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 10 * 60_000;

function diskCache(): Record<string, Candidate[]> {
  disk ??= readDisk<Record<string, Candidate[]>>(FILE) ?? {};
  return disk;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

interface CommonsPage {
  title: string;
  index?: number;
  imageinfo?: Array<{
    thumburl?: string;
    thumbwidth?: number;
    width?: number;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

async function search(q: string): Promise<Candidate[]> {
  const qs = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '960',
    format: 'json',
  });
  const json = await fetchJson<{ query?: { pages?: Record<string, CommonsPage> } }>('commons', `${API}?${qs}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    timeoutMs: 10_000,
  });
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const out: Candidate[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii?.thumburl || ii.mime !== 'image/jpeg' || BAD.test(p.title)) continue;
    if ((ii.width ?? 0) < 700) continue;
    if (!INDIAN.test(p.title) || FOREIGN.test(p.title)) continue;
    const license = ii.extmetadata?.LicenseShortName?.value ?? '';
    if (NC.test(license)) continue;
    out.push({
      title: p.title,
      thumb: ii.thumburl,
      width: ii.thumbwidth ?? 960,
      license,
      artist: stripTags(ii.extmetadata?.Artist?.value ?? 'Wikimedia Commons contributor'),
      pageUrl: ii.descriptionurl ?? '',
    });
  }
  return out;
}

// One search per train kind, kept on disk; the train number picks which photo of the kind to show.
async function candidatesFor(type: string): Promise<Candidate[]> {
  const key = `type:${type}`;
  const hit = memory.get(key) ?? diskCache()[key];
  if (hit) {
    memory.set(key, hit);
    return hit;
  }
  const last = failedAt.get(key);
  if (last && Date.now() - last < RETRY_AFTER_MS) return [];
  const all: Candidate[] = [];
  try {
    for (const q of TYPE_QUERY[type] ?? TYPE_QUERY.MEX) {
      for (const c of await search(q)) if (!all.some((x) => x.title === c.title)) all.push(c);
      if (all.length >= 6) break;
    }
  } catch {
    failedAt.set(key, Date.now());
    return [];
  }
  if (all.length === 0) {
    failedAt.set(key, Date.now());
    return [];
  }
  memory.set(key, all);
  const d = diskCache();
  d[key] = all;
  writeDisk(FILE, d);
  return all;
}

export async function getTrainPhoto(trainNo: string, typeHint?: string): Promise<TrainPhoto | null> {
  const type = (typeHint || getOfflineTrain(trainNo)?.type || 'MEX').toUpperCase();
  const list = await candidatesFor(type);
  if (list.length === 0) return null;
  const c = list[Number(trainNo) % list.length];
  return { thumb: c.thumb, credit: c.artist, license: c.license, pageUrl: c.pageUrl, exact: false };
}
