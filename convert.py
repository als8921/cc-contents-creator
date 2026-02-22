#!/usr/bin/env python3
"""Convert card news HTML files to PNG images using Playwright."""

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RATIOS = {
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


def convert_html_to_png(project_dir: Path, width: int, height: int, scale: int = 1) -> None:
    html_dir = project_dir / "html"
    images_dir = project_dir / "images"

    if not html_dir.exists():
        # Fallback: look for HTML files directly in project_dir
        html_dir = project_dir

    html_files = sorted(html_dir.glob("*.html"))

    if not html_files:
        print(f"No HTML files found in {html_dir}")
        sys.exit(1)

    images_dir.mkdir(exist_ok=True)

    print(f"Found {len(html_files)} HTML file(s) in {html_dir}")
    print(f"Viewport: {width}x{height} (scale {scale}x → {width*scale}x{height*scale}px output)")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=scale,
        )
        page = context.new_page()

        for html_file in html_files:
            png_file = images_dir / html_file.with_suffix(".png").name
            file_url = html_file.resolve().as_uri()

            page.goto(file_url, wait_until="networkidle")
            page.screenshot(path=str(png_file))

            print(f"  {html_file.name} -> images/{png_file.name}")

        browser.close()

    print(f"Done. {len(html_files)} PNG(s) saved to {images_dir}")


def main():
    parser = argparse.ArgumentParser(description="Convert card news HTML to PNG")
    parser.add_argument(
        "project",
        nargs="?",
        help="Project name (subdirectory in output/). If omitted, converts most recent.",
    )
    parser.add_argument(
        "--ratio",
        default="1:1",
        choices=list(RATIOS.keys()),
        help="Aspect ratio: 1:1 (1080x1080) or 4:5 (1080x1350) (default: 1:1)",
    )
    parser.add_argument(
        "--scale",
        type=int,
        default=1,
        choices=[1, 2, 3],
        help="Device scale factor for retina output (default: 1)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "output",
        help="Base output directory (default: output/)",
    )
    args = parser.parse_args()

    if args.project:
        target_dir = args.output_dir / args.project
    else:
        subdirs = [d for d in args.output_dir.iterdir() if d.is_dir()]
        if not subdirs:
            print("No project directories found in output/")
            sys.exit(1)
        target_dir = max(subdirs, key=lambda d: d.stat().st_mtime)
        print(f"Auto-selected most recent project: {target_dir.name}")

    if not target_dir.exists():
        print(f"Directory not found: {target_dir}")
        sys.exit(1)

    width, height = RATIOS[args.ratio]
    convert_html_to_png(target_dir, width, height, scale=args.scale)


if __name__ == "__main__":
    main()
