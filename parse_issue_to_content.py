#!/usr/bin/env python3
"""
Parses a GitHub Issue Form submission (the issue body) and writes the
extracted values into daily_content.txt in the KEY=VALUE format the
Daily Breakdown posting script expects.
"""

import os
import re

FIELD_MAP = {
    "Previous UTC Close": "PREVIOUS_CLOSE",
    "Today in Bitcoin": "TODAY_IN_BITCOIN",
    "Treasury Watch - Item 1": "TREASURY_1",
    "Treasury Watch - Item 2": "TREASURY_2",
    "Treasury Watch - Item 3": "TREASURY_3",
}


def parse_issue_body(body):
    """GitHub renders each form field as '### Label' followed by the entered value."""
    sections = re.split(r"^### (.+)$", body, flags=re.MULTILINE)
    result = {}
    for i in range(1, len(sections), 2):
        label = sections[i].strip()
        value = sections[i + 1].strip() if i + 1 < len(sections) else ""
        if value == "_No response_":
            value = ""
        result[label] = value
    return result


def main():
    body = os.environ["ISSUE_BODY"]
    parsed = parse_issue_body(body)

    lines = [
        "# This file is updated automatically from GitHub Issue Form submissions.",
        "# You can still edit it directly here if you ever need to.",
        "",
    ]
    for label, key in FIELD_MAP.items():
        value = parsed.get(label, "")
        lines.append(f"{key}={value}")

    with open("daily_content.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("Updated daily_content.txt:")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
