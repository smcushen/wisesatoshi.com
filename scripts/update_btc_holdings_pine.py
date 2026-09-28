#!/usr/bin/env python3
"""
Keeps the TradingView "MSTR BTC Holdings (WiseSatoshi)" indicator in sync
with data/strategy-fundamentals.json.

1. Reads btcHeld + lastUpdated from data/strategy-fundamentals.json.
2. If btcHeld differs from the most recent entry in
   data/btc-holdings-history.json, appends {date, btcHeld}
   (or corrects the value if that date is already recorded).
3. Regenerates tradingview/mstr-btc-holdings.pine from the full history.

Safe to run repeatedly: if nothing changed, nothing is written.
"""
import json
import os
import sys

FUNDAMENTALS = "data/strategy-fundamentals.json"
HISTORY = "data/btc-holdings-history.json"
PINE_OUT = "tradingview/mstr-btc-holdings.pine"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def update_history():
    f = load_json(FUNDAMENTALS)
    held = f.get("btcHeld")
    date = str(f.get("lastUpdated", ""))[:10]
    if not isinstance(held, (int, float)) or len(date) != 10:
        sys.exit(f"Missing or invalid btcHeld/lastUpdated in {FUNDAMENTALS}")
    held = int(round(held))

    hist = load_json(HISTORY)
    entries = sorted(hist["entries"], key=lambda e: e["date"])

    same_date = next((e for e in entries if e["date"] == date), None)
    if same_date:
        if same_date["btcHeld"] == held:
            print(f"History already has {date}: {held:,} (no change)")
            return hist, False
        print(f"Correcting {date}: {same_date['btcHeld']:,} -> {held:,}")
        same_date["btcHeld"] = held
    elif entries and entries[-1]["btcHeld"] == held:
        print(f"Holdings unchanged at {held:,} (no new entry)")
        return hist, False
    elif entries and date < entries[-1]["date"]:
        sys.exit(f"lastUpdated {date} is older than the latest history entry "
                 f"{entries[-1]['date']}; refusing to insert out of order")
    else:
        print(f"Adding {date}: {held:,}")
        entries.append({"date": date, "btcHeld": held})

    hist["entries"] = sorted(entries, key=lambda e: e["date"])
    with open(HISTORY, "w", encoding="utf-8") as out:
        json.dump(hist, out, indent=2)
        out.write("\n")
    return hist, True


def build_pine(entries):
    first, last = entries[0]["date"], entries[-1]["date"]
    pushes = "\n".join(
        f'    array.push(dDate, timestamp("{e["date"]}"))\n'
        f'    array.push(dHeld, {e["btcHeld"]})'
        for e in entries
    )
    return f'''//@version=5
indicator("MSTR BTC Holdings (WiseSatoshi)", overlay=false)

// -----------------------------------------------------------------
// AUTO-GENERATED -- do not hand-edit the data block below.
// Source: data/btc-holdings-history.json in the wisesatoshi.com repo,
// updated automatically whenever data/strategy-fundamentals.json
// changes. To update TradingView: copy this whole file into the
// Pine Editor, Save (and Update if published).
//
// Real cumulative BTC holdings after every disclosed purchase or
// sale, compiled from Strategy's 8-Ks, 10-Qs, and 10-Ks ({first}
// through {last}). Plotted as a stairstep since holdings only change
// on disclosed dates -- there's no real "in between."
// -----------------------------------------------------------------

var dDate = array.new<int>()
var dHeld = array.new<float>()

if barstate.isfirst
{pushes}

// Finds the most recent disclosed holdings figure at or before this
// bar's time -- a plain linear scan, since {len(entries)} entries is trivial
// for Pine's per-bar execution budget.
btcHeld = 0.0
for i = 0 to array.size(dDate) - 1
    if array.get(dDate, i) <= time
        btcHeld := array.get(dHeld, i)

// Color reflects the direction of the MOST RECENT actual change --
// green after a purchase, red after a sale. Declared with `var` so
// it only updates on a bar where holdings genuinely moved, and holds
// steady (keeping the last move's color) through every flat stretch
// in between, rather than resetting to some default each bar.
var color stepColor = color.new(color.lime, 0)
if btcHeld > btcHeld[1]
    stepColor := color.new(color.lime, 0)
else if btcHeld < btcHeld[1]
    stepColor := color.new(color.red, 0)

plot(btcHeld, title="BTC Held", color=stepColor, style=plot.style_stepline, linewidth=2)

// Colored value label at the right edge, matching the price-scale
// labels TradingView already shows for real symbols like MSTR and
// BTCUSD. Deleted and redrawn each time this is the last bar, so it
// always sits at the current right edge and shows the live figure
// rather than a static one left over from when the script loaded.
var label lastLabel = na
if barstate.islast
    label.delete(lastLabel)
    lastLabel := label.new(
         x=bar_index, y=btcHeld,
         text=str.tostring(btcHeld, "#,###"),
         xloc=xloc.bar_index, yloc=yloc.price,
         style=label.style_label_left,
         color=stepColor, textcolor=color.black,
         size=size.normal)
'''


def main():
    hist, _ = update_history()
    os.makedirs(os.path.dirname(PINE_OUT), exist_ok=True)
    new_pine = build_pine(sorted(hist["entries"], key=lambda e: e["date"]))
    old_pine = open(PINE_OUT, encoding="utf-8").read() if os.path.exists(PINE_OUT) else ""
    if new_pine != old_pine:
        with open(PINE_OUT, "w", encoding="utf-8") as out:
            out.write(new_pine)
        print(f"Wrote {PINE_OUT}")
    else:
        print(f"{PINE_OUT} already up to date")


if __name__ == "__main__":
    main()
