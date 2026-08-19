#!/usr/bin/env python3
"""
Daily Breakdown Bot for @WiseSatoshi

Reads pre-written content from daily_content.txt, fetches the live BTC
price, calculates the % change vs. the previous UTC close, builds the post,
and publishes it to X.

Usage:
    python post_daily_breakdown.py           # builds and posts for real
    python post_daily_breakdown.py --dry-run # builds and prints, doesn't post
"""

import os
import sys
from datetime import datetime, timezone

import requests
import tweepy

CONTENT_FILE = "daily_content.txt"
# X Premium allows up to 25,000 characters for long-form posts in the web/app UI.
# Untested here: whether the API's create_tweet() call automatically honors that
# same entitlement, or needs different handling. Set generously; if a real post
# ever fails or gets rejected for length, that's the signal to look into it further.
MAX_CHARS = 25000


def load_content(path):
    """Parse simple KEY=VALUE lines from the content file. Ignores blank lines and comments."""
    data = {}
    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip("\n")
            if not line or line.strip().startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            data[key.strip()] = value.strip()
    return data


def get_live_btc_price():
    """Fetch current BTC/USD price from CoinGecko (free, no API key required)."""
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {"ids": "bitcoin", "vs_currencies": "usd"}
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return float(resp.json()["bitcoin"]["usd"])


def build_post(content, live_price):
    if "PREVIOUS_CLOSE" not in content or not content["PREVIOUS_CLOSE"]:
        raise ValueError(
            "PREVIOUS_CLOSE is missing from daily_content.txt. "
            "Refusing to post without it -- fill it in and try again."
        )

    previous_close = float(content["PREVIOUS_CLOSE"])
    pct_change = (live_price - previous_close) / previous_close * 100
    arrow = "\u25B2" if pct_change >= 0 else "\u25BC"  # ▲ or ▼
    sign = "+" if pct_change >= 0 else ""

    today_str = datetime.now(timezone.utc).strftime("%B %d").replace(" 0", " ")

    lines = []
    lines.append(f"\U0001F4CA Bitcoin Daily Breakdown \u2014 {today_str}")
    lines.append("")
    lines.append(f"BTC: ${live_price:,.0f} ({arrow} {sign}{pct_change:.2f}% from previous UTC close)")

    today_in_bitcoin = content.get("TODAY_IN_BITCOIN", "").strip()
    if today_in_bitcoin:
        lines.append("")
        lines.append(f"\U0001F570\uFE0F On this day: {today_in_bitcoin}")

    treasury_items = []
    for i in range(1, 4):
        item = content.get(f"TREASURY_{i}", "").strip()
        if item:
            treasury_items.append(item)

    if treasury_items:
        lines.append("")
        lines.append("Treasury Watch:")
        for item in treasury_items:
            lines.append(f"\U0001F539 {item}")

    lines.append("")
    lines.append("wisesatoshi.com")

    return "\n".join(lines)


def post_to_x(text):
    client = tweepy.Client(
        consumer_key=os.environ["X_CONSUMER_KEY"],
        consumer_secret=os.environ["X_CONSUMER_SECRET"],
        access_token=os.environ["X_ACCESS_TOKEN"],
        access_token_secret=os.environ["X_ACCESS_TOKEN_SECRET"],
    )
    return client.create_tweet(text=text)


def main():
    dry_run = "--dry-run" in sys.argv

    content = load_content(CONTENT_FILE)
    live_price = get_live_btc_price()
    post_text = build_post(content, live_price)

    print("----- POST PREVIEW -----")
    print(post_text)
    print(f"----- ({len(post_text)} characters) -----")

    if len(post_text) > MAX_CHARS:
        print(
            f"WARNING: post exceeds {MAX_CHARS} characters. "
            "It may be rejected unless your account has long-post access."
        )

    if dry_run:
        print("Dry run -- nothing was posted.")
        return

    result = post_to_x(post_text)
    print("Posted successfully:", result)


if __name__ == "__main__":
    main()
