# How to use this template

Hi everyone! This repository is a template and it's meant to be used as a starting point for your Curriculum Vitae.

Come on, updating the CV is already boring by itself, imagine having to take care of its formatting as well. So the idea is to update a single Markdown file (the README), and a Github Action will take care of the rest. It will:

- Put the CV online on **Github Pages**, built with Jekyll. You can even use a custom domain if you'd like. You don't need to worry too much about the formatting. Feel free to move from Jekyll to [one of these](https://github.com/pages-themes).
- Convert it to a **PDF**, which is uploaded as the `latest` Release. A link to it can be found at the top of the CV, so it can be easily downloaded from the online version.

At every commit into the `main` branch, everything will be rebuilt and updated.

## Getting started

1. Replace `assets/profile.png` with your own photo.
2. Run `python setup.py` to fill in your personal details (name, email, social handles, etc.) and generate a `cv-prompt.txt` you can feed to any LLM to draft your CV content.
3. Replace the placeholder content in `README.md` with your own (manually or using the LLM output).
4. Enable Github Pages for your repo. Go to *Settings*, *Pages*, then under *Build and deployment* set the source to **Github Actions**.
5. Commit and push. If the Action fails because Pages wasn't enabled yet, simply re-run it from the Actions tab.

## Tips

**Forcing a page break in the PDF** — use the following HTML element anywhere in `README.md`:

```html
<div class="page-break"></div>
```

**Circular profile picture** — `setup.py` automatically crops your photo to a circle and saves it as `assets/profile.png` (requires Pillow — install it with `pip install -r requirements.txt`). Place your photo in `assets/` before running setup — any of these formats is accepted: `.png`, `.jpg`, `.jpeg`, `.webp`. If you didn't have Pillow installed at the time, install it and re-run:

```bash
python setup.py --crop
```

**Social sharing image (og:image)** — `setup.py` automatically generates `assets/og-image.png`, a 1200×630 image used when your CV is shared on LinkedIn, Twitter/X, iMessage, etc. It places your circular profile photo centred on a gradient background. This requires Pillow and runs together with `--crop`.

If you'd rather use a custom image (e.g. a banner you designed in Canva or Figma), just place it as `assets/og-image.png` before running setup — it will be detected and the auto-generation skipped. To regenerate the auto image later, delete `og-image.png` and re-run:

```bash
python setup.py --crop
```

**Custom domain** — if you enter a custom URL during setup (e.g. `https://cv.example.com`), `setup.py` automatically creates a `CNAME` file in the repo root, which GitHub Pages requires. You still need to:

1. Go to your repo's *Settings* > *Pages* > *Custom domain*, enter your domain, and save.
2. Configure your DNS provider:
   - **Subdomain** (e.g. `cv.example.com`): add a `CNAME` record pointing to `yourusername.github.io`.
   - **Apex domain** (e.g. `example.com`): add four `A` records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

**Changing the theme** — edit `theme:` in `_config.yml`. GitHub Pages natively supports: `cayman` (default), `minima`, `minimal`, `slate`, `midnight`, `hacker`, `architect`, `dinky`, `leap-day`, `merlot`, `modernist`, `tactile`, `time-machine`. To use any theme hosted on GitHub instead, swap `theme:` for `remote_theme:`:

```yaml
remote_theme: owner/repo-name
```

Good places to find themes: [jekyllthemes.io](https://jekyllthemes.io/github-pages-themes) and the [jekyll-theme GitHub topic](https://github.com/topics/jekyll-theme). Note: when switching theme, review `assets/css/style.scss` — the CSS class names for the page header may differ and the print styles may need updating.

**Regenerating the LLM prompt** — if you edit `README.md` after the initial setup and want a fresh `cv-prompt.txt` reflecting the current state of your CV:

```bash
python setup.py --prompt
```

That's it, see ya! 👋
