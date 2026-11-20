<script setup lang="ts">
// code editor
import { SaveIcon, XIcon } from '@modrinth/assets'
import { Button, Toggle } from '@modrinth/ui'
import { onBeforeUnmount, ref, watch } from 'vue'

import { rinthify } from '@/rinthify'

const props = defineProps<{ files: string[]; initial?: string }>()
const emit = defineEmits<{ close: []; input: [path: string, text: string] }>()

const AUTOSAVE_MS = 600

const path = ref(props.initial ?? props.files[0] ?? '')
const text = ref('')
const savedText = ref('')
const status = ref('')
const autoSave = ref(true)
let timer: ReturnType<typeof setTimeout> | undefined

async function load(p: string) {
	status.value = ''
	try {
		text.value = savedText.value = await rinthify.read(p)
	} catch (e) {
		text.value = savedText.value = ''
		status.value = String(e)
	}
}

async function save() {
	clearTimeout(timer)
	if (text.value === savedText.value) return
	try {
		const content = text.value
		await rinthify.write(path.value, content)
		savedText.value = content
		status.value = `Saved ${new Date().toLocaleTimeString()}`
	} catch (e) {
		status.value = `Save failed: ${e}`
	}
}

async function switchTo(p: string) {
	await save()
	path.value = p
}

function onInput() {
	emit('input', path.value, text.value)
	clearTimeout(timer)
	if (autoSave.value) timer = setTimeout(save, AUTOSAVE_MS)
}

function onKey(e: KeyboardEvent) {
	const el = e.target as HTMLTextAreaElement
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault()
		void save()
	} else if (e.key === 'Tab' && !e.shiftKey) {
		// tab inserts a tab
		e.preventDefault()
		el.setRangeText('\t', el.selectionStart, el.selectionEnd, 'end')
		text.value = el.value
		onInput()
	}
}

async function close() {
	await save()
	emit('close')
}

watch(path, load, { immediate: true })
onBeforeUnmount(() => void save())
</script>

<template>
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center gap-2">
			<button
				v-for="f in files"
				:key="f"
				class="rounded-lg border-none px-2 py-1 font-mono text-sm cursor-pointer"
				:class="f === path ? 'bg-brand text-black' : 'bg-button-bg text-primary'"
				@click="switchTo(f)"
			>
				{{ f.split('/').pop() }}
			</button>
			<span class="ml-auto flex items-center gap-2 text-sm text-secondary">
				Auto-save
				<Toggle v-model="autoSave" small />
			</span>
			<Button :disabled="text === savedText" @click="save"><SaveIcon /> Save</Button>
			<Button @click="close"><XIcon /> Close</Button>
		</div>
		<textarea
			v-model="text"
			spellcheck="false"
			class="rinthify-editor"
			@input="onInput"
			@keydown="onKey"
		/>
		<p class="m-0 text-sm text-secondary">
			{{ path }} &middot; {{ text === savedText ? status || 'Saved' : 'Unsaved changes' }} &middot; Ctrl+S
			saves
		</p>
	</div>
</template>

<style scoped>
.rinthify-editor {
	min-height: 22rem;
	width: 100%;
	resize: vertical;
	font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
	font-size: 0.85rem;
	line-height: 1.45;
	tab-size: 4;
	white-space: pre;
	padding: 0.75rem;
	border-radius: 0.75rem;
	border: 1px solid var(--surface-5);
	background: var(--surface-1);
	color: var(--color-contrast, inherit);
}
</style>
