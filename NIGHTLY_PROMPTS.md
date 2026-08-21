Here are your two updated prompts for tomorrow's Daily Breakdown, incorporating last night's workflow and the actual data points we used:

Prompt 1 — Today in Bitcoin:

For August 21, 2026: give me an 'on this day in Bitcoin history' fact — only include it if you're confident it's accurate, and name what you're basing it on. If nothing solidly verifiable exists for this date, say so rather than including a weak or uncertain fact.

Prompt 2 — Treasury Watch:

Give me up to 3 of the most significant developments in the Bitcoin treasury company space from the past 24 hours. For each one, provide the specific source (SEC 8-K, company press release, or named news outlet), the date, and a direct URL to that source. If you can't provide a working link to a primary source, don't include the claim — fewer than 3 verified items is fine. Quote any dollar figures or share counts exactly as stated in the source, never paraphrased or estimated. Flag anything you're not fully confident in explicitly, rather than presenting it with the same tone as verified facts.

Prompt 3 — Previous Close Price:

Retrieve the Bitcoin price at 00:00 UTC on August 21, 2026 for use as the previous close in tomorrow's Daily Breakdown post.

Your nightly checklist before submitting:

Send Prompt 1 → verify the fact, trim if needed
Send Prompt 2 → verify sources, keep only confirmed items
Send Prompt 3 → lock in the 00:00 UTC close price
Fill in the Issue Form with all three pieces and submit
Script fires at 9 AM Eastern → fetches live BTC price, calculates % change, posts automatically

Here's the full walkthrough, now that you've got real content ready:

1. Start a new issue — in your repo, click the Issues tab, then the green "New issue" button.
2. Choose the "Daily Breakdown Content" form — it should appear as an option; click it to open the labeled fields (not the blank freeform issue option).
3. Fill in your real values — Previous UTC Close (tonight's real number from a UTC-set chart), Today in Bitcoin (your fact, or leave blank), and up to three Treasury Watch items — your real, sourced content this time.
4. Click "Submit new issue" — this creates the issue, which should trigger the automation within a few seconds.
5. Check the Actions tab — look for a new "Daily content" run; a green checkmark confirms it processed correctly (should work smoothly now that the label fix is in).
6. Verify daily_content.txt updated — open it in your repo and confirm your real values are sitting there correctly, same check we just did with the test data.
7. That's it — no further action needed. Tomorrow's 9 AM Eastern scheduled job picks up this real content automatically. Nothing to click, trigger, or remember after this.
