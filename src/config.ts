import { type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	[key: string]: string | number | boolean

	authMode: 'oauth' | 'pat'
	pollInterval: number
	locationId: string

	oauthClientId: string
	oauthAuthorizationResponse: string
	isOauthAuthenticated: boolean
	isOauthDisconnectAccount: boolean
	oauthRedirectUri: string
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
			type: 'dropdown',
			id: 'authMode',
			label: 'Authentication method',
			width: 12,
			default: 'pat',
			choices: [
				{ id: 'oauth', label: 'SmartThings account' },
				{ id: 'pat', label: 'Development PAT' },
			],
			disableAutoExpression: true,
		},
		{
			type: 'secret-text',
			id: 'patToken',
			label: 'SmartThings Development Token',
			width: 12,
			default: '',
			isVisibleExpression: `$(options:authMode) == 'pat'`,
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
			isVisibleExpression: `$(options:authMode) == 'oauth'`,
		},
		{
			type: 'secret-text',
			id: 'oauthClientSecret',
			label: 'Client Secret',
			width: 12,
			default: '',
			isVisibleExpression: `$(options:authMode) == 'oauth'`,
		},
		{
			type: 'textinput',
			id: 'oauthAuthorizationResponse',
			label: 'Authorization Response',
			width: 12,
			default: '',
			isVisibleExpression: `$(options:authMode) == 'oauth' && $(options:isOauthAuthenticated) != true`,
		},
		{
			id: 'oauthRedirectUri',
			type: 'static-text',
			label: 'OAuth Redirect URI',
			value: 'https://rkdunlop.github.io/companion-module-smartthings/oauth/callback/',
			width: 12,
			isVisibleExpression: `$(options:authMode) == 'oauth'`,
		},
		{
			id: 'oauthAuthorizationUrl',
			type: 'static-text',
			label: 'Authorization URL',
			value: '',
			width: 12,
			isVisibleExpression: `$(options:authMode) == 'oauth' && $(options:isOauthAuthenticated) != true`,
		},
		{
			id: 'isOauthDisconnectAccount',
			label: 'Disconnect SmartThings Account',
			type: 'checkbox',
			default: false,
			width: 12,
			isVisibleExpression: `$(options:authMode) == 'oauth' && $(options:isOauthAuthenticated) == true`,
		},
		{
			id: 'isOauthAuthenticated',
			label: 'Is Authenticated',
			type: 'checkbox',
			default: false,
			isVisibleExpression: 'false',
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
