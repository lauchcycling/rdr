/**
 * Utility for fetching and parsing group ride activities from Joinride
 * Target Club: RC Dynamo Ruhr e.V.
 * URL: https://joinride.cc/pro/rc-dynamo-ruhr/activities
 */

export const JOINRIDE_CLUB_URL = "https://joinride.cc/pro/rc-dynamo-ruhr/activities";
export const JOINRIDE_API_URL = "https://joinride.cc/pro/rc-dynamo-ruhr/activities?_data=routes%2Fpro%2F%24slug%2Factivities";

export interface JoinrideRide {
  id: string;
  title: string;
  date: string; // ISO timestamp
  formattedDate: string; // e.g., "Samstag, 24. Mai 2026, 09:00 Uhr"
  slug: string;
  url: string; // direct link: https://joinride.cc/ride/{slug}
  meetingPoint: string;
  distanceKm: number | null;
  elevationM: number | null;
  pace: string | null;
  subType: string;
  subTypeLabel: string;
  info: string;
  isCanceled: boolean;
  maxParticipants: number | null;
  participantsCount: number;
}

export interface JoinrideStatus {
  hasActiveRide: boolean;
  ride: JoinrideRide | null;
  lastChecked: string;
  source: 'joinride' | 'fallback';
  error?: string;
}

/**
 * Strips HTML tags and normalizes whitespace
 */
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats ISO date string to German display format
 */
export function formatGermanDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' Uhr';
  } catch {
    return isoString;
  }
}

/**
 * Maps Joinride subType to German human-readable label
 */
export function getSubTypeLabel(subType?: string | null): string {
  switch ((subType || '').toUpperCase()) {
    case 'ROADBIKE':
      return 'Rennrad';
    case 'GRAVEL':
      return 'Gravel';
    case 'MOUNTAINBIKE':
      return 'Mountainbike';
    case 'VIRTUAL':
      return 'Zwift / Rollen-Ride';
    default:
      return 'Vereinsausfahrt';
  }
}

/**
 * Parses raw Joinride activity object into a typed JoinrideRide
 */
export function parseJoinrideActivity(item: any): JoinrideRide {
  const data = item?.data || item || {};
  const rideDetails = data.rideDetails || {};
  const road = rideDetails.roadbikeDetails || {};
  const gravel = rideDetails.gravelDetails || {};

  const distance = rideDetails.distance ?? null;
  const elevation = road.elevation ?? gravel.elevation ?? null;
  const velocity = road.averageVelocity ?? gravel.averageVelocity ?? null;

  const rawSubType = rideDetails.subType || 'ROADBIKE';
  const slug = data.slug || data.id || '';
  const url = slug ? `https://joinride.cc/ride/${slug}` : JOINRIDE_CLUB_URL;

  // Clean description or fallback
  let cleanInfo = stripHtml(data.description);
  if (cleanInfo.length > 280) {
    cleanInfo = cleanInfo.slice(0, 277) + '...';
  }
  if (!cleanInfo) {
    cleanInfo = 'Helmpflicht! Wir fahren zusammen und warten aufeinander. Niemand wird zurückgelassen.';
  }

  return {
    id: data.id || '',
    title: data.title || 'RC Dynamo Ruhr Groupride',
    date: data.date || '',
    formattedDate: formatGermanDate(data.date),
    slug,
    url,
    meetingPoint: data.meetingPoint || 'Siehe Joinride Beschreibung',
    distanceKm: distance ? Math.round(distance) : null,
    elevationM: elevation ? Math.round(elevation) : null,
    pace: velocity ? `${velocity} km/h` : null,
    subType: rawSubType,
    subTypeLabel: getSubTypeLabel(rawSubType),
    info: cleanInfo,
    isCanceled: Boolean(data.isCanceled),
    maxParticipants: data.maxParticipants ?? null,
    participantsCount: data.numberOfParticipants ?? (data.participants?.length || 0),
  };
}

/**
 * Fetches activities from Joinride API and checks for upcoming planned rides
 */
export async function getJoinrideStatus(): Promise<JoinrideStatus> {
  const now = new Date();
  const timestamp = now.toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(JOINRIDE_API_URL, {
      headers: {
        'User-Agent': 'DynamoRuhr/1.0 (+https://dynamoruhr.de)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Joinride responded with HTTP ${res.status}`);
    }

    const json = await res.json();
    const upcoming = Array.isArray(json?.upcoming) ? json.upcoming : [];

    // Filter valid upcoming rides: not canceled, date in future (or today up to 4 hours after start)
    const activeRides = upcoming
      .map(parseJoinrideActivity)
      .filter((ride: JoinrideRide) => {
        if (ride.isCanceled) return false;
        if (!ride.date) return false;
        const rideTime = new Date(ride.date).getTime();
        // Allow rides starting up to 4 hours ago for today's ongoing ride
        return !isNaN(rideTime) && rideTime >= Date.now() - 4 * 60 * 60 * 1000;
      })
      .sort((a: JoinrideRide, b: JoinrideRide) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (activeRides.length > 0) {
      return {
        hasActiveRide: true,
        ride: activeRides[0],
        lastChecked: timestamp,
        source: 'joinride',
      };
    }

    return {
      hasActiveRide: false,
      ride: null,
      lastChecked: timestamp,
      source: 'joinride',
    };
  } catch (err: any) {
    console.warn('[Joinride] Failed to fetch live data:', err?.message || err);
    return {
      hasActiveRide: false,
      ride: null,
      lastChecked: timestamp,
      source: 'fallback',
      error: err?.message || 'Network error',
    };
  }
}
