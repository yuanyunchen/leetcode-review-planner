#!/usr/bin/env python3
"""
Trim near-solid outer borders from PNG screenshots.

This is intended for README demo images where screenshots may include
extra gray margins around the main content.

Usage:
  python3 scripts/trim_image_borders.py --dir images
"""

from __future__ import annotations

import argparse
from pathlib import Path
import tkinter as tk


def parse_rgb(value):
    if isinstance(value, tuple):
        return tuple(int(v) for v in value[:3])
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("#") and len(value) == 7:
            return (int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16))
        parts = value.split()
        if len(parts) >= 3 and all(p.isdigit() for p in parts[:3]):
            return (int(parts[0]), int(parts[1]), int(parts[2]))
    return (0, 0, 0)


def color_distance(c1, c2):
    return max(abs(c1[0] - c2[0]), abs(c1[1] - c2[1]), abs(c1[2] - c2[2]))


def median_corner_color(corners):
    rs = sorted(c[0] for c in corners)
    gs = sorted(c[1] for c in corners)
    bs = sorted(c[2] for c in corners)
    mid = len(corners) // 2
    return (rs[mid], gs[mid], bs[mid])


def trim_one(path: Path, tolerance: int, border_ratio: float, step: int) -> tuple[bool, str]:
    img = tk.PhotoImage(file=str(path))
    w = int(img.width())
    h = int(img.height())

    if w < 20 or h < 20:
        return False, "too small"

    corners = [
        parse_rgb(img.get(0, 0)),
        parse_rgb(img.get(w - 1, 0)),
        parse_rgb(img.get(0, h - 1)),
        parse_rgb(img.get(w - 1, h - 1)),
    ]
    border_color = median_corner_color(corners)

    def is_border(px):
        return color_distance(parse_rgb(px), border_color) <= tolerance

    def row_is_border(y):
        total = 0
        border_hits = 0
        for x in range(0, w, step):
            total += 1
            if is_border(img.get(x, y)):
                border_hits += 1
        return (border_hits / max(1, total)) >= border_ratio

    def col_is_border(x, y0, y1):
        total = 0
        border_hits = 0
        for y in range(y0, y1 + 1, step):
            total += 1
            if is_border(img.get(x, y)):
                border_hits += 1
        return (border_hits / max(1, total)) >= border_ratio

    top = 0
    while top < h - 1 and row_is_border(top):
        top += 1

    bottom = h - 1
    while bottom > top and row_is_border(bottom):
        bottom -= 1

    left = 0
    while left < w - 1 and col_is_border(left, top, bottom):
        left += 1

    right = w - 1
    while right > left and col_is_border(right, top, bottom):
        right -= 1

    # If nothing meaningful to trim, skip.
    if top == 0 and left == 0 and right == w - 1 and bottom == h - 1:
        return False, "no border detected"

    # Keep a 1px safety padding to avoid over-cropping.
    top = max(0, top - 1)
    left = max(0, left - 1)
    right = min(w - 1, right + 1)
    bottom = min(h - 1, bottom + 1)

    new_w = right - left + 1
    new_h = bottom - top + 1
    if new_w < 10 or new_h < 10:
        return False, "crop result invalid"

    cropped = tk.PhotoImage(width=new_w, height=new_h)
    cropped.tk.call(
        cropped,
        "copy",
        img,
        "-from",
        left,
        top,
        right + 1,
        bottom + 1,
        "-to",
        0,
        0,
    )
    cropped.write(str(path), format="png")
    return True, f"trimmed to {new_w}x{new_h}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="images", help="Directory containing PNG files")
    parser.add_argument("--tolerance", type=int, default=14, help="Color tolerance for border match")
    parser.add_argument("--ratio", type=float, default=0.985, help="Row/column border ratio threshold")
    parser.add_argument("--step", type=int, default=2, help="Sampling step size")
    args = parser.parse_args()

    image_dir = Path(args.dir).resolve()
    files = sorted(image_dir.glob("*.png"))
    if not files:
        print(f"No PNG files found in {image_dir}")
        return

    root = tk.Tk()
    root.withdraw()

    changed = 0
    for path in files:
        ok, msg = trim_one(path, args.tolerance, args.ratio, args.step)
        print(f"{path.name}: {msg}")
        if ok:
            changed += 1

    root.destroy()
    print(f"\nDone. {changed}/{len(files)} files updated.")


if __name__ == "__main__":
    main()
