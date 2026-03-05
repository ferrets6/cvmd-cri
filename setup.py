#!/usr/bin/env python3
"""
Setup script for the cvmd template.
Replaces {{PLACEHOLDER}} tokens in README.md and _config.yml with your personal details.

Usage:
    python setup.py             # full setup
    python setup.py --crop      # crop the profile image to a circle (requires Pillow)
    python setup.py --prompt    # regenerate cv-prompt.txt from the current README.md

Profile image:
    Place your photo as assets/profile.png, .jpg, .jpeg, or .webp before running setup.
    The image will be cropped to a circle and saved as assets/profile.png.
"""

import argparse
import os
import sys


def _w(text, bold=False):
    """Wrap text in yellow (+ optional bold) ANSI codes if stdout is a TTY."""
    if not sys.stdout.isatty():
        return text
    codes = "\033[33m" + ("\033[1m" if bold else "")
    return f"{codes}{text}\033[0m"


FILES_TO_UPDATE = ["README.md", "_config.yml"]
PROFILE_IMAGE = os.path.join("assets", "profile.png")
PROFILE_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".webp", ".png")
PROMPT_OUTPUT = "cv-prompt.txt"
PLACEHOLDER_IMAGE_HASH = "25623972cfa59e57c7bf87cf57a4109a20e5fd51da9f572a31d474e6e3f92327"
MAX_PROFILE_SIZE = 300
OG_IMAGE = os.path.join("assets", "og-image.png")
OG_WIDTH, OG_HEIGHT = 1200, 630
# Cayman theme gradient endpoints: #155799 → #159957
OG_COLOR_LEFT  = (21,  87,  153)
OG_COLOR_RIGHT = (21, 153,  87)


def prompt(label, default=None, required=True, validate=None, validate_msg="Invalid value, please try again."):
    hint = f" [{default}]" if default else (" (optional, press Enter to skip)" if not required else "")
    while True:
        value = input(f"  {label}{hint}: ").strip()
        if not value and default:
            return default
        if not value and not required:
            return ""
        if not value:
            print("  This field is required.")
            continue
        if validate and not validate(value):
            print(f"  {validate_msg}")
            continue
        return value


def find_profile_image():
    """Return the path of the first profile image found in assets/, or None."""
    for ext in PROFILE_IMAGE_EXTENSIONS:
        path = os.path.join("assets", f"profile{ext}")
        if os.path.isfile(path):
            return path
    return None


def image_sha256(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def make_circular_profile(image_path):
    """Center-crop a profile image to a circle with a transparent background.

    Always outputs to PROFILE_IMAGE (assets/profile.png). If the source image
    is a different format/name it is removed after conversion.
    """
    if image_path == PROFILE_IMAGE and image_sha256(image_path) == PLACEHOLDER_IMAGE_HASH:
        print(f"\n  {_w('─' * 54)}")
        print(f"  {_w('⚠  Profile photo: still using placeholder!', bold=True)}")
        print(f"  {_w('─' * 54)}")
        print(f"  {_w('Place your photo in assets/ (profile.png/jpg/jpeg/webp),')}")
        print(f"  {_w('then run:  python setup.py --crop')}")
        print(f"  {_w('─' * 54)}")
        return

    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print(f"\n  Skipping image crop — Pillow is not installed.")
        print(f"  To get a circular PNG, install it and re-run:")
        print(f"    pip install Pillow")
        return

    img = Image.open(image_path).convert("RGBA")

    # Center-crop to a square
    size = min(img.size)
    left = (img.width - size) // 2
    top = (img.height - size) // 2
    img = img.crop((left, top, left + size, top + size))

    # Create a circular mask
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)

    # Paste onto a transparent canvas and apply the mask
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(img, mask=mask)

    # Cap to MAX_PROFILE_SIZE
    if size > MAX_PROFILE_SIZE:
        result = result.resize((MAX_PROFILE_SIZE, MAX_PROFILE_SIZE), Image.LANCZOS)

    result.save(PROFILE_IMAGE, "PNG")

    # Remove the source file if it was not already profile.png
    if image_path != PROFILE_IMAGE:
        os.remove(image_path)

    print(f"  Cropped {image_path} → {PROFILE_IMAGE} ({min(size, MAX_PROFILE_SIZE)}x{min(size, MAX_PROFILE_SIZE)}, transparent circle)")


def generate_og_image():
    """Generate a 1200x630 og:image from the circular profile on a Cayman-gradient background.

    Skipped if og-image.png already exists (user-provided image takes priority).
    Delete og-image.png and re-run with --crop to regenerate.
    """
    if not os.path.isfile(PROFILE_IMAGE):
        print(f"  Skipping og-image — {PROFILE_IMAGE} not found.")
        return

    if image_sha256(PROFILE_IMAGE) == PLACEHOLDER_IMAGE_HASH:
        print(f"  Skipping og-image — profile is still the placeholder.")
        return

    if os.path.isfile(OG_IMAGE):
        print(f"  Skipping og-image — {OG_IMAGE} already exists (delete it to regenerate).")
        return

    try:
        from PIL import Image
    except ImportError:
        print(f"  Skipping og-image — Pillow is not installed.")
        return

    # Build a left-to-right gradient background
    strip = Image.new("RGB", (OG_WIDTH, 1))
    px = strip.load()
    for x in range(OG_WIDTH):
        t = x / (OG_WIDTH - 1)
        px[x, 0] = tuple(int(OG_COLOR_LEFT[i] + (OG_COLOR_RIGHT[i] - OG_COLOR_LEFT[i]) * t) for i in range(3))
    bg = strip.resize((OG_WIDTH, OG_HEIGHT), Image.NEAREST).convert("RGBA")

    # Centre the circular profile on the canvas
    profile = Image.open(PROFILE_IMAGE).convert("RGBA")
    pos = ((OG_WIDTH - profile.width) // 2, (OG_HEIGHT - profile.height) // 2)
    bg.paste(profile, pos, mask=profile)

    bg.convert("RGB").save(OG_IMAGE, "PNG")
    print(f"  Generated {OG_IMAGE} ({OG_WIDTH}×{OG_HEIGHT}, Cayman gradient)")


def generate_prompt():
    """Write cv-prompt.txt: a ready-to-use LLM prompt for rewriting the CV content."""
    with open("README.md", "r", encoding="utf-8") as f:
        template_section = f.read()

    prompt_text = f"""\
You are helping me write my Curriculum Vitae in Markdown, following a specific template.

## Your task

Rewrite the CV content in the template below using MY personal information, which I will
provide at the end of this prompt.

## Rules

- Output ONLY the CV content (from `<div class="page-break"></div>` to the end of the
  document) — no explanation, no preamble.
- In the **first block** (name, profile picture, tagline, contact links, PDF download link),
  keep the name, picture, contact links, and PDF download link exactly as-is — but
  **rewrite the tagline** (the italic line below the picture) to reflect my actual profile.
- Freely rewrite everything after the first block (experience, education, skills, etc.)
  to reflect my background.
- Rename, add, or remove sections as needed to best represent my profile.
- Mirror the Markdown formatting: `##` for sections, `**Role** @ [Company](url) *(dates)*`
  for entries, bullet points for highlights, `***Technologies used:***` where relevant.
- Place `<div class="page-break"></div>` at natural page-break points (roughly every
  1-1.5 pages of content).
- Do not invent or infer details I have not provided.

## Template

{template_section}
---

## My information

[Paste your existing CV, describe your experience, education, skills, etc.
You can also attach a PDF or share a LinkedIn URL if your LLM supports it.]
"""

    with open(PROMPT_OUTPUT, "w", encoding="utf-8") as f:
        f.write(prompt_text)
    print(f"  Generated {PROMPT_OUTPUT}")


def replace_in_file(path, replacements):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for old, new in replacements.items():
        content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Updated {path}")


def generate_cname(site_url, default_url):
    """Write a CNAME file if the user provided a custom domain."""
    if site_url == default_url:
        return
    from urllib.parse import urlparse
    hostname = urlparse(site_url).netloc
    if hostname:
        with open("CNAME", "w", encoding="utf-8") as f:
            f.write(hostname + "\n")
        print(f"  Generated CNAME → {hostname}")


def setup():
    """Run the full interactive setup: replace placeholders, crop image, generate prompt."""
    script_dir = os.path.dirname(os.path.abspath(__file__))

    missing = [f for f in FILES_TO_UPDATE if not os.path.isfile(f)]
    if missing:
        print(f"Error: could not find {', '.join(missing)}. Make sure you run this script from the repo root.")
        sys.exit(1)

    print("\n=== CV Setup ===")
    print("Answer the prompts below to personalise your CV template.")
    print("You can always edit README.md manually afterwards.\n")

    full_name = prompt("Full name (e.g. Jane Doe)")
    email = prompt(
        "Email address",
        validate=lambda v: "@" in v and "." in v.split("@")[-1],
        validate_msg="Please enter a valid email address.",
    )
    github_username = prompt("GitHub username")
    repo_name = prompt("Repository name", default=os.path.basename(script_dir))
    linkedin_username = prompt("LinkedIn username (the part after linkedin.com/in/)")
    instagram_username = prompt("Instagram username", required=False)
    default_url = f"https://{github_username}.github.io/{repo_name}"
    site_url = prompt(
        "Site URL (leave blank to use GitHub Pages default)",
        default=default_url,
        required=False,
        validate=lambda v: v.startswith("http://") or v.startswith("https://"),
        validate_msg="URL must start with http:// or https://",
    )
    description = prompt("Short description (used in browser tab as 'Name | description')", default=f"{full_name}'s CV", required=False)
    og_description = prompt("Social preview description (richer, shown in search results and link previews)", default=description, required=False)

    replacements = {
        "{{FULL_NAME}}": full_name,
        "{{EMAIL}}": email,
        "{{GITHUB_USERNAME}}": github_username,
        "{{REPO_NAME}}": repo_name,
        "{{LINKEDIN_USERNAME}}": linkedin_username,
        "{{URL}}": site_url,
        "{{DESCRIPTION}}": description,
        "{{OG_DESCRIPTION}}": og_description,
    }

    if instagram_username:
        replacements["{{INSTAGRAM_USERNAME}}"] = instagram_username
    else:
        # Remove the entire Instagram link (including the separator) from the contacts line
        replacements[" / [Instagram](https://www.instagram.com/{{INSTAGRAM_USERNAME}})"] = ""

    print("\nApplying changes...")
    for filepath in FILES_TO_UPDATE:
        replace_in_file(filepath, replacements)
    generate_cname(site_url, default_url)

    found = find_profile_image()
    photo_missing = False
    if found:
        make_circular_profile(found)
        # make_circular_profile prints its own warning if it's still the placeholder
        photo_missing = found == PROFILE_IMAGE and image_sha256(found) == PLACEHOLDER_IMAGE_HASH
        generate_og_image()
    else:
        photo_missing = True
        print(f"\n  {_w('─' * 54)}")
        print(f"  {_w('⚠  Profile photo: no image found in assets/!', bold=True)}")
        print(f"  {_w('─' * 54)}")
        print(f"  {_w('Place your photo in assets/ (profile.png/jpg/jpeg/webp),')}")
        print(f"  {_w('then run:  python setup.py --crop')}")
        print(f"  {_w('─' * 54)}")

    generate_prompt()

    print("\nDone! Next steps:")
    if photo_missing:
        print(f"  {_w('0. *** Add your profile photo and run: python setup.py --crop ***', bold=True)}")
    print(f"  1. Open {PROMPT_OUTPUT}, add your details at the bottom, and paste it into")
    print(f"     your LLM of choice (attach your old CV or LinkedIn URL if it supports it).")
    print(f"  2. Replace the CV content in README.md with the LLM output.")
    print(f"  3. Enable GitHub Pages: Settings > Pages > Source: GitHub Actions.")
    print(f"  4. Commit and push — the Action will build the site and generate the PDF.")
    print(f"     If the Action fails because Pages was not yet enabled, re-run it from the Actions tab.")


def main():
    # Enable ANSI escape codes on Windows (no-op on other platforms)
    if os.name == "nt":
        os.system("")

    # Always run from the directory where this script lives
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    parser = argparse.ArgumentParser(description="Setup script for the cvmd CV template.")
    parser.add_argument("--crop", action="store_true", help="Crop the profile image to a circle (requires Pillow).")
    parser.add_argument("--prompt", action="store_true", help="Regenerate cv-prompt.txt from the current README.md.")
    args = parser.parse_args()

    if args.crop or args.prompt:
        if args.crop:
            found = find_profile_image()
            if found:
                make_circular_profile(found)
                generate_og_image()
            else:
                print(f"Error: no profile image found in assets/. Add your photo as assets/profile.png (or .jpg/.jpeg/.webp).")
        if args.prompt:
            generate_prompt()
    else:
        setup()


if __name__ == "__main__":
    main()
