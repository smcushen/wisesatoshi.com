import { captureIfNeeded } from './lib/mnav-close-core.mjs';
// Four attempts across the close window: two right at the bell (16:00/16:01
// ET) to catch cases where the data source already has the final close
// instantly, two more 15 minutes later (16:15/16:16 ET) as a fallback.
// allowOverwrite:true means each later attempt re-fetches and replaces the
// prior snapshot rather than skipping -- "most recent attempt wins."
//
// DST-proof: the schedule fires in BOTH the 20:00 and 21:00 UTC hours
// (4 PM ET in summer and in winter), and the guard below only lets the run
// through when it is actually the 4 PM hour in New York. No more editing
// this file each March and November.
export default async () => {
  const etHour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', hour12: false,
  }).format(new Date()));
  if (etHour !== 16) {
    console.log('Scheduled mNAV capture: skipped, ET hour is ' + etHour + ' (not the 4 PM close window)');
    return;
  }
  try {
    const result = await captureIfNeeded({ force: false, allowOverwrite: true });
    console.log('Scheduled mNAV capture:', result);
  } catch (err) {
    console.error('Scheduled mNAV capture failed:', err);
  }
};
export const config = {
  schedule: '0,1,15,16 20,21 * * 1-5',
};
