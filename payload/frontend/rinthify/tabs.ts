// our settings tabs
import { PaletteIcon, PlugIcon } from '@modrinth/assets'

import PluginsSettings from '@/rinthify/PluginsSettings.vue'
import ThemesSettings from '@/rinthify/ThemesSettings.vue'

const category = { id: 'rinthify.settings.category', defaultMessage: 'Rinthify' }

export const rinthifyTabs = [
	{
		name: { id: 'rinthify.settings.themes', defaultMessage: 'Themes' },
		category,
		icon: PaletteIcon,
		content: ThemesSettings,
	},
	{
		name: { id: 'rinthify.settings.plugins', defaultMessage: 'Plugins' },
		category,
		icon: PlugIcon,
		content: PluginsSettings,
	},
]
