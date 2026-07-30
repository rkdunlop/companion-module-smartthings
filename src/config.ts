import { type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	[key: string]: string | number | boolean

	authMode: 'oauth' | 'pat'
	patToken: string
	pollInterval: number
	locationId: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'secret-text',
			id: 'patToken',
			label: 'SmartThings Development Token',
			width: 12,
			default: '',
		},
		{
			type: 'dropdown',
			id: 'authMode',
			label: 'Authentication method',
			width: 12,
			default: 'pat',
			choices: [
				{ id: 'oauth', label: 'SmartThings account' },
				{ id: 'pat', label: 'Development PAT' },
			],
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Status polling interval',
			width: 6,
			min: 1000,
			max: 60000,
			default: 5000,
		},
		{
			type: 'dropdown',
			id: 'locationId',
			label: 'Location',
			width: 12,
			choices: [{ id: '', label: 'All locations' }],
			default: '',
			allowCustom: false,
		},
	]
}
