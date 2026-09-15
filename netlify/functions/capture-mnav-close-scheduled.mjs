import { captureIfNeeded } from './lib/mnav-close-core.mjs';
// Four attempts across the close window: two right at the bell (16:00/16:01
// ET) to catch cases where the data source already has the final close
// instantly, two more 15 minutes later (16:15/16:16 ET) as a fallback.
// allowOverwrite:true means each later attempt re-fetches and replaces the
// prior snapshot rather than skipping — the goal is "most recent attempt
// wins," since a later fetch is never less likely to be settled than an
// earlier one. The on-visit check function is untouched and still skips
// once captured, so it won't re-fire repeatedly all evening.
//
// 0,1,15,16 20 * * 1-5 = :00,:01,:15,:16 past 4pm ET on weekdays, while ET
// is UTC-4 (EDT). Once ET shifts to UTC-5 (EST, ~early Nov), change the
// hour to 21: '0,1,15,16 21 * * 1-5'.
export default async () => {
  try {
    const result = await captureIfNeeded({ force: false, allowOverwrite: true });
    console.log('Scheduled mNAV capture:', result);
  } catch (err) {
    console.error('Scheduled mNAV capture failed:', err);
  }
};
export const config = {
  schedule: '0,1,15,16 20 * * 1-5',
};
