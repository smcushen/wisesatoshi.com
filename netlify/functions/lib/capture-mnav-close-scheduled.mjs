import { captureIfNeeded } from './lib/mnav-close-core.mjs';

// A single attempt is enough here, unlike the four-attempt spread the old
// GitHub Actions version needed — Netlify's scheduler runs on dedicated
// infrastructure (not a shared queue like GitHub's), so it's expected to
// fire within a minute or two of this time, not hours late. The on-visit
// check function is still the real safety net if this one ever does fail.
//
// 20 20 * * 1-5 = 4:20pm ET on weekdays, while ET is UTC-4 (EDT).
// Once ET shifts to UTC-5 (EST, ~early Nov), change to '20 21 * * 1-5'.
export default async () => {
  try {
    const result = await captureIfNeeded({ force: false });
    console.log('Scheduled mNAV capture:', result);
  } catch (err) {
    console.error('Scheduled mNAV capture failed:', err);
  }
};

export const config = {
  schedule: '20 20 * * 1-5',
};
