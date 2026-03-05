#!/bin/bash
# Avvia un server di sviluppo locale per testare edit.html.
# Legge la password da .env.local, calcola l'hash e serve da _dev/ (gitignored).
# Il repo non viene mai modificato.

set -e

if [ ! -f .env.local ]; then
  echo "Errore: file .env.local non trovato."
  echo "Crea il file con questo contenuto:"
  echo "  EDITOR_PASSWORD=latuapassword"
  exit 1
fi

source .env.local

if [ -z "$EDITOR_PASSWORD" ]; then
  echo "Errore: EDITOR_PASSWORD non impostata in .env.local"
  exit 1
fi

HASH=$(printf '%s' "$EDITOR_PASSWORD" | sha256sum | cut -d' ' -f1)

rm -rf _dev
mkdir -p _dev/assets

for f in edit.html edit.css edit.js favicon.ico README.md _config.yml; do
  [ -f "$f" ] && cp "$f" _dev/
done
[ -d assets ] && cp -r assets/. _dev/assets/

sed -i "s/__EDITOR_PASSWORD_HASH__/$HASH/" _dev/edit.js

echo "Dev server avviato: http://localhost:8000/edit.html"
echo "Premi Ctrl+C per fermare."
python -m http.server 8000 --directory _dev
