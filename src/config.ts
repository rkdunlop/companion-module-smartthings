import { type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	authmode: 'oauth' | 'token'
	token: string
	pollInterval: number
	locationId: string
	[x: string]: string | number | boolean
}

export interface ModuleSecrets {
	patToken?: string
	accessToken?: string
	refreshToken?: string
	expiresAt?: number
}

export interface PatSecrets {
	type: 'pat'
	token: string
}

export interface OauthSecrets {
	type: 'oauth'
	accessToken: string
	refreshToken: string
	expiresAt: number
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
			choices: [{ id: '', label: 'All locations' }],
			default: '',
			allowCustom: false,
		},
	]
}
