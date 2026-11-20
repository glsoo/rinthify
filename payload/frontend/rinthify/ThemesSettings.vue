<script setup lang="ts">
// themes page
import { CheckIcon, EditIcon, FolderOpenIcon, PlusIcon, TrashIcon } from '@modrinth/assets'
import { Button } from '@modrinth/ui'
import { ref } from 'vue'

import { openPath } from '@/helpers/utils'
import { rinthify } from '@/rinthify'
import RinthifyEditor from '@/rinthify/RinthifyEditor.vue'

const TEMPLATE = `/* New Rinthify theme. Edits apply live; see the app's variables in packages/assets/styles/variables.scss. */
html.dark-mode,
html.oled-mode,
html.light-mode {
\t--color-brand: #7aa2f7;
}
`

const editing = ref<string | null>(null)
const newName = ref('')
const confirmDelete = ref<string | null>(null)
const error = ref('')

async function create() {
	const name = newName.value.trim().replace(/[^\w.-]+/g, '-')
	if (!name) return
	if (rinthify.themes.includes(name)) {
		error.value = `A theme named "${name}" already exists.`
		return
	}
	error.value = ''
	await rinthify.write(`themes/${name}/project.json`, JSON.stringify({ name }, null, '\t') + '\n')
	await rinthify.write(`themes/${name}/theme.css`, TEMPLATE)
	newName.value = ''
	await rinthify.setTheme(name)
	editing.value = name
}

async function del(name: string) {
	if (confirmDelete.value !== name) {
		confirmDelete.value = name
		return
	}
	confirmDelete.value = null
	if (editing.value === name) editing.value = null
	if (rinthify.config.theme === name) await rinthify.setTheme(null)
	await rinthify.remove(`themes/${name}`)
}

function onInput(path: string, css: string) {
	rinthify.previewTheme(path.split('/')[1], css)
}
</script>

<template>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<h2 class="m-0 text-lg font-semibold text-contrast">Themes</h2>
			<p class="m-0 leading-tight text-secondary">
				A theme is a CSS file in <code>{{ rinthify.dir }}/themes</code>. Edits apply live, here or
				in any editor.
			</p>
			<p v-if="rinthify.safeMode" class="m-0 font-semibold text-orange">
				Safe mode is on (RINTHIFY_SAFE): themes are not applied.
			</p>
		</div>

		<RinthifyEditor
			v-if="editing"
			:key="editing"
			:files="[`themes/${editing}/theme.css`]"
			@input="onInput"
			@close="editing = null"
		/>

		<div class="flex flex-col gap-2">
			<div
				class="flex items-center gap-3 rounded-xl bg-button-bg p-3"
				:class="{ 'outline outline-2 outline-brand': !rinthify.config.theme }"
			>
				<span class="font-semibold text-contrast">Default</span>
				<span class="text-secondary text-sm">The app's own look</span>
				<Button class="ml-auto" :disabled="!rinthify.config.theme" @click="rinthify.setTheme(null)">
					<CheckIcon /> {{ rinthify.config.theme ? 'Use' : 'Active' }}
				</Button>
			</div>
			<div
				v-for="name in rinthify.themes"
				:key="name"
				class="flex items-center gap-3 rounded-xl bg-button-bg p-3"
				:class="{ 'outline outline-2 outline-brand': rinthify.config.theme === name }"
			>
				<span class="font-semibold text-contrast">{{ name }}</span>
				<div class="ml-auto flex gap-2">
					<Button :disabled="rinthify.config.theme === name" @click="rinthify.setTheme(name)">
						<CheckIcon /> {{ rinthify.config.theme === name ? 'Active' : 'Use' }}
					</Button>
					<Button @click="editing = name"><EditIcon /> Edit</Button>
					<Button color="red" @click="del(name)">
						<TrashIcon /> {{ confirmDelete === name ? 'Confirm' : 'Delete' }}
					</Button>
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<input
				v-model="newName"
				type="text"
				placeholder="New theme name"
				class="w-56"
				@keydown.enter="create"
			/>
			<Button :disabled="!newName.trim()" @click="create"><PlusIcon /> Create theme</Button>
			<Button @click="openPath(`${rinthify.dir}/themes`)"><FolderOpenIcon /> Open folder</Button>
		</div>
		<p v-if="error" class="m-0 text-red">{{ error }}</p>
	</div>
</template>
