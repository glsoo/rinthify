<script setup lang="ts">
// plugins page
import { EditIcon, FolderOpenIcon, PlusIcon, RefreshCwIcon, TrashIcon } from '@modrinth/assets'
import { Button, Toggle } from '@modrinth/ui'
import { computed, ref } from 'vue'

import { openPath } from '@/helpers/utils'
import { rinthify } from '@/rinthify'
import RinthifyEditor from '@/rinthify/RinthifyEditor.vue'

const editing = ref<string | null>(null)
const newName = ref('')
const confirmDelete = ref<string | null>(null)
const error = ref('')

// files to edit
const editingFiles = computed(() =>
	rinthify.files.filter(
		(f) => f.startsWith(`plugins/${editing.value}/`) && !f.startsWith(`plugins/${editing.value}/data/`),
	),
)

function template(id: string, name: string) {
	return `// ${name}: a Rinthify plugin. Saving this file reloads it live.
// api: vue, ui, icons, router, invoke, addRoute, addNavItem, addStyle, on, storage, files
export default {
\tstart(api) {
\t\tconst { h } = api.vue
\t\tconst page = api.addRoute('/', {
\t\t\trender: () =>
\t\t\t\th('div', { class: 'p-6' }, [
\t\t\t\t\th('h1', { class: 'm-0 text-2xl font-bold text-contrast' }, '${name}'),
\t\t\t\t\th('p', { class: 'text-secondary' }, 'Edit plugins/${id}/index.js to change this page.'),
\t\t\t\t]),
\t\t})
\t\tapi.addNavItem({ label: '${name}', icon: api.icons.PlugIcon, to: page })
\t},
\tstop() {},
}
`
}

async function create() {
	const name = newName.value.trim()
	const id = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
	if (!id) return
	if (rinthify.plugins.some((p) => p.id === id)) {
		error.value = `A plugin with the id "${id}" already exists.`
		return
	}
	error.value = ''
	const safeName = name.replace(/['\\]/g, '')
	await rinthify.write(`plugins/${id}/index.js`, template(id, safeName))
	const manifest = { id, name: safeName, version: '0.1.0', author: '', description: '', main: 'index.js' }
	await rinthify.write(`plugins/${id}/project.json`, JSON.stringify(manifest, null, '\t') + '\n')
	await rinthify.setEnabled(id, true)
	newName.value = ''
	editing.value = id
}

async function del(id: string) {
	if (confirmDelete.value !== id) {
		confirmDelete.value = id
		return
	}
	confirmDelete.value = null
	if (editing.value === id) editing.value = null
	await rinthify.setEnabled(id, false)
	await rinthify.remove(`plugins/${id}`)
}
</script>

<template>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<h2 class="m-0 text-lg font-semibold text-contrast">Plugins</h2>
			<p class="m-0 leading-tight text-secondary">
				A plugin is a folder in <code>{{ rinthify.dir }}/plugins</code> with a
				<code>project.json</code> and an <code>index.js</code>. Saving a file reloads the plugin
				live.
			</p>
			<p class="m-0 leading-tight text-orange">
				Plugins can do anything the app can, including reading and writing files. Only enable plugins
				you trust.
			</p>
			<p v-if="rinthify.safeMode" class="m-0 font-semibold text-orange">
				Safe mode is on (RINTHIFY_SAFE): no plugins run.
			</p>
		</div>

		<RinthifyEditor
			v-if="editing && editingFiles.length"
			:key="editing"
			:files="editingFiles"
			:initial="`plugins/${editing}/${rinthify.plugins.find((p) => p.id === editing)?.manifest.main ?? 'index.js'}`"
			@close="editing = null"
		/>

		<p v-if="!rinthify.plugins.length" class="m-0 text-secondary">No plugins yet.</p>
		<div
			v-for="p in rinthify.plugins"
			:key="p.id"
			class="flex flex-col gap-2 rounded-xl bg-button-bg p-3"
		>
			<div class="flex items-center gap-3">
				<Toggle
					:model-value="rinthify.config.enabled.includes(p.id)"
					:disabled="rinthify.safeMode"
					@update:model-value="(on: boolean) => rinthify.setEnabled(p.id, on)"
				/>
				<div class="flex flex-col">
					<span class="font-semibold text-contrast">
						{{ p.manifest.name ?? p.id }}
						<span class="text-sm font-normal text-secondary">
							{{ p.manifest.version }}{{ p.manifest.author ? ` by ${p.manifest.author}` : '' }}
						</span>
					</span>
					<span v-if="p.manifest.description" class="text-sm text-secondary">
						{{ p.manifest.description }}
					</span>
				</div>
				<div class="ml-auto flex gap-2">
					<Button :disabled="!p.running" @click="rinthify.reloadPlugin(p.id)">
						<RefreshCwIcon /> Reload
					</Button>
					<Button @click="editing = p.id"><EditIcon /> Edit</Button>
					<Button color="red" @click="del(p.id)">
						<TrashIcon /> {{ confirmDelete === p.id ? 'Confirm' : 'Delete' }}
					</Button>
				</div>
			</div>
			<pre v-if="p.error" class="m-0 whitespace-pre-wrap text-sm text-red">{{ p.error }}</pre>
			<component :is="p.settings" v-if="p.running && p.settings" />
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<input
				v-model="newName"
				type="text"
				placeholder="New plugin name"
				class="w-56"
				@keydown.enter="create"
			/>
			<Button :disabled="!newName.trim()" @click="create"><PlusIcon /> Create plugin</Button>
			<Button @click="openPath(`${rinthify.dir}/plugins`)"><FolderOpenIcon /> Open folder</Button>
		</div>
		<p v-if="error" class="m-0 text-red">{{ error }}</p>
	</div>
</template>
