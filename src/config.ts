import { type SomeCompanionConfigField } from '@companion-module/base'
import { SMARTTHINGS_OAUTH_REDIRECT_URI } from './auth/constants.js'

export interface ModuleConfig {
	[key: string]: string | number | boolean

	authMode: 'oauth' | 'pat'
	pollInterval: number
	locationId: string

	oauthClientId: string
	oauthAuthorizationResponse: string
}

export interface ModuleSecrets {
	[key: string]: string
	oauthClientSecret: string
	patToken: string
	oauthTokens: string
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
		{
			type: 'textinput',
			id: 'oauthClientId',
			label: 'Client ID',
			width: 12,
			default: '',
		},
		{
			type: 'secret-text',
			id: 'oauthClientSecret',
			label: 'Client Secret',
			width: 12,
			default: '',
		},
		{
			type: 'textinput',
			id: 'oauthAuthorizationResponse',
			label: 'Authorization Response',
			width: 12,
			default: '',
		},
		{
			id: 'oauthRedirectURI',
			type: 'static-text',
			label: 'OAuth Redirect URI',
			value: SMARTTHINGS_OAUTH_REDIRECT_URI,
			width: 12,
		},
		{
			type: 'secret-text',
			id: 'oauthTokens',
			label: 'OAuth Tokens',
			width: 12,
			default: '',
			isVisibleExpression: 'false',
		},
	]
}
