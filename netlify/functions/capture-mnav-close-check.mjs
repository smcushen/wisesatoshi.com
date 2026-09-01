import { captureIfNeeded } from './lib/mnav-close-core.mjs';

// Called from index.html's client-side JS after market close. Safe to call
// on every page load during that window — captureIfNeeded() exits almost
// immediately once today's snapshot already exists, so repeat calls from
// many visitors cost nothing beyond a quick check.
export default async () => {
  try {
    const result = await captureIfNeeded({ force: false });
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('On-visit mNAV capture failed:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
