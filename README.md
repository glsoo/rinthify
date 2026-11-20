# rinthify

themes and plugins for the [modrinth app](https://github.com/modrinth/code)

This adds a rinthify section to the application's options that permits you to make themes, compose plugins and set
them up from GitHub or a zip file. Changes take effect immediately on save

You should be fine with almost all your instances/accounts/apps remaining as is and while you run it on linux (fedora).

## install

```
curl -fsSL https://raw.githubusercontent.com/glsoo/rinthify/main/install.sh | sh
```

This installs node, gcc and the webkit dev package if you haven't installed them already, clones the repo to
`~/.local/share/rinthify` and adds rinthify to the app

To do it manually instead:

```
git clone https://github.com/glsoo/rinthify
cd rinthify
./rinthify.mjs inject
```

And then you can open the modrinth app as normal. `./rinthify.mjs uninject` will remove it

Rinthify updates itself. On each start up of the app, rinthify searches for a newer version in the background. The new
version is used the next time you launch the app. `./rinthify.mjs update` does the same by hand. It will not update if
you have local changes

There is also a Rinthify tab in settings to update, repair, turn off or uninstall it

Plugins can't use `import` in this mode, and they have their own copy of vue

Or download and run the installer for your system: `install.sh` (linux), `install.command` (macos, double click it) or
`install.exe` (windows, double click it; `install.ps1` and `install.cmd` do the same)

**Windows** (Node.js 22+): run `node rinthify.mjs inject` once from an **administrator** terminal. It sets a WebView2
policy that gives only the Modrinth App a debug port on localhost, and adds a hidden watcher to your Startup folder that
attaches to the app over it. Your Start menu entry and taskbar pin keep working as they are. While the app runs, other
programs on your PC could connect to that port. Safe mode: create an empty file named `safe` in `%APPDATA%\rinthify`

**macOS** (Xcode command line tools): `./rinthify.mjs inject` patches `/Applications/Modrinth App.app` in place and
re-signs it ad hoc (the original is backed up and `uninject` restores it). A Modrinth update undoes it, and it doesn't
update itself on launch here, so run `./rinthify.mjs update` (or `inject`) again after one. If macOS refuses to modify
the app, give your terminal "App Management" in System Settings > Privacy & Security

Windows and macOS injection are new and less tested than Linux

### building from source

This is the old way which builds the full app from modrinth's source with rinthify pre-included. It is slow (10+
minutes the first time) and does not update itself.

```
./rinthify.mjs doctor
./rinthify.mjs apply
```

On fedora this needs `webkit2gtk4.1-devel gtk3-devel libsoup3-devel librsvg2-devel openssl-devel`.
`./rinthify.mjs restore` gets rid of it

## files

everything is kept in `~/.config/rinthify`:

```
config.json
themes/<name>/project.json
themes/<name>/theme.css
themes/<name>/theme.js     (optional)
plugins/<id>/project.json
plugins/<id>/index.js
plugins/<id>/data/
```

You can modify these in the built in editor or in any other editor. The app checks for modifications every second

## themes

The simplest way to create a theme is the theme designer. Go to settings > themes, enter a name and hit create. You
can select a preset, or go advanced for colors, backgrounds, fonts and more.

Another way to do this is with css. It will be placed on top of the app's styles so you are able to overwrite its
variables:

```css
html.dark-mode, html.oled-mode, html.light-mode {
	--surface-1: #0b0e17;
	--color-brand: #7aa2f7;
}
```

To change more than colors, create a `theme.js`. It is used like a plugin but it only runs while the theme is active.
The app's styles are scoped so you will likely have to add `!important`

There are example themes in `examples/themes`. Green is the one which changes the layout.

## installing from github or a zip

Paste a link in the box on the themes or plugins page and click install. It can be `owner/repo`, a link to a
folder in a repo, or a link to a `.zip`. Or click zip file to pick one from your computer. It looks for a
`project.json` to know what to install. Installing again updates it

plugins installed this way start turned off

## project.json

This is the theme or plugin foundation

```json
{
	"name": "Hello",
	"version": "1.0.0",
	"author": "you",
	"description": "says hello",
	"main": "index.js",
	"options": [
		{ "id": "accent", "type": "color", "label": "Accent", "default": "#f2a93b" },
		{ "id": "blur", "type": "slider", "label": "Blur", "default": 8, "min": 0, "max": 20, "unit": "px" },
		{ "id": "clock", "type": "toggle", "label": "Clock", "default": true },
		{ "id": "side", "type": "select", "label": "Side", "default": "left", "choices": ["left", "right"] },
		{ "id": "title", "type": "text", "label": "Title", "default": "" }
	]
}
```

`options` (optional) are each displayed as a setting within the app

Within a theme's css each option is a variable and toggles set an attribute on `<html>`:

```css
html.dark-mode { --color-brand: var(--accent); }
html:not([data-clock]) #my-clock { display: none; }
```

plugins get them in `api.options`

## plugins

A plugin is a folder with a `project.json` (all plugin data), an `index.js` (the code), and optionally an `icon.png`.

```js
export default {
	start(api) {
		const { h } = api.vue
		const page = api.addRoute('/', { render: () => h('h1', 'Hello') })
		api.addNavItem({ label: 'Hello', icon: api.icons.plug, to: page })
		this.settings = { render: () => h('p', 'this shows up in the plugin settings') }
	},
	stop() {},
}
```

this is what `api` has:

- `id`
- `options` - the values from project.json
- `vue`, `icons`
- `app`, `router`
- `invoke(cmd, args)` - invoke any of the app's tauri commands, such as `plugin:instance|instance_list`
- `addRoute(path, component)` - add a page and return the page path
- `addNavItem({ label, icon, to })` - add a sidebar button
- `addStyle(css)`
- `on(type, handler)` - app events e.g. `process`, `instance`, `install_job` and `log`
- `onCleanup(fn)`
- `storage.get(key, fallback)`, `storage.set(key, value)`
- `fetch(url, { method, headers, body, save })` - http without the app's csp, `save` writes the response to `data/`
- `files.read(path)`, `files.write(path, text or Uint8Array)`, `files.bytes(path)`, `files.remove(path)`, `files.path(path)` - files in the plugin's `data/` folder

Everything you added through `api` will be taken away as soon as the plugin stops, so you usually don't need to call
`stop()`.

`examples/plugins` has example plugins (adblock, command palette, streamer mode, instance notes, curseforge)

## if something breaks

Launch the app with `RINTHIFY_SAFE=1` and nothing is loaded, then remove whatever broke it. `RINTHIFY_DEBUG=1` dumps
the console to the terminal

## warning

Plugins have the power to do everything that the app does, which means they can also read your files and access your
accounts. Only add plugins that you trust

## license

Copyright (c) 2026 glsoo. GPL-3.0, see [LICENSE](LICENSE). You can use, change and share it, but forks have to stay
open source under the same license and keep this copyright notice
