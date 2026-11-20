#!/bin/sh
# install rinthify on macos, double click this in finder
set -e
dir="$HOME/.local/share/rinthify"

if ! xcode-select -p >/dev/null 2>&1; then
	echo "Installing the Xcode command line tools, run this again when that finishes"
	xcode-select --install
	exit 1
fi
if ! command -v node >/dev/null; then
	if command -v brew >/dev/null; then brew install node
	else echo "Install Node.js 22+ from https://nodejs.org then run this again"; exit 1
	fi
fi

if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only
else git clone https://github.com/glsoo/rinthify "$dir"
fi
node "$dir/rinthify.mjs" inject
echo "Done. Start the Modrinth App as usual."
