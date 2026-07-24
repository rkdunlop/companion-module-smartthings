import { type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	token: string
	pollInterval: number
	locationId: string
	[x: string]: string | number | boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'token',
			label: 'SmartThings Access Token',
			width: 12,
			default: '',
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
			choices: [],
			default: '',
			allowCustom: false,
		},
	]
}
