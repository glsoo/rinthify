#!/bin/sh
# install rinthify
set -e

dir="${RINTHIFY_DIR:-$HOME/.local/share/rinthify}"

if ! command -v node >/dev/null || ! command -v cc >/dev/null || ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
	echo "Installing node, gcc and webkit2gtk (needs sudo)"
	if command -v dnf >/dev/null; then sudo dnf install -y nodejs gcc git pkgconf webkit2gtk4.1-devel
	elif command -v apt-get >/dev/null; then sudo apt-get install -y nodejs gcc git pkg-config libwebkit2gtk-4.1-dev
	elif command -v pacman >/dev/null; then sudo pacman -S --needed nodejs gcc git pkgconf webkit2gtk-4.1
	else echo "Install node, gcc, git and the webkit2gtk 4.1 dev package yourself, then run this again."; exit 1
	fi
fi

if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only
else git clone https://github.com/glsoo/rinthify "$dir"
fi

node "$dir/rinthify.mjs" inject
