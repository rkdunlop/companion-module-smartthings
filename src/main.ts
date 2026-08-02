import { InstanceBase, InstanceStatus } from '@companion-module/base'

import {
	SmartThingsApi,
	type SmartThingsDevice,
	type SmartThingsLocation,
	type SmartThingsCapabilityDefinition,
	type SmartThingsDiscoveredCommand,
	type SmartThingsRule,
} from './api/api.js'
import type { ModuleConfig, ModuleSecrets } from './config.js'
import { GetConfigFields } from './config.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpdatePresets } from './presets.js'
import { UpgradeScripts } from './upgrades.js'
import type { ActionsSchema } from './actions.js'
import type { FeedbacksSchema } from './feedbacks.js'
import type { VariablesSchema } from './variables.js'
import type { SmartThingsDeviceStatus } from './device/index.js'
import { getSwitchState } from './device/index.js'

import { discoverCommands } from './discovery/commands.js'
import { PatTokenProvider } from './auth/pat-token-provider.js'

import { OAuthClient, type OAuthTokens } from './auth/oauth-client.js'
import { OAuthManager } from './auth/oauth-manager.js'
import { OAuthTokenProvider } from './auth/oauth-token-provider.js'
import { SMARTTHINGS_OAUTH_REDIRECT_URI } from './auth/constants.js'

import { decodeAuthorizationResponse } from './auth/authorization-response.js'
import { deserializeOAuthTokens, serializeOAuthTokens } from './auth/token-storage.js'

const SMARTTHINGS_OAUTH_SCOPES = ['r:locations:*', 'r:devices:*', 'x:devices:*', 'r:scenes:*', 'x:scenes:*']

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export class SmartThingsInstance extends InstanceBase<ModuleSchema> {
	public config: ModuleConfig = {
		authMode: 'pat',
		pollInterval: 5000,
		locationId: '',
		oauthClientId: '',
		oauthAuthorizationResponse: '',
	}

	public api?: SmartThingsApi
	public devices: SmartThingsDevice[] = []
	public locations: SmartThingsLocation[] = []
	public capabilities = new Map<string, SmartThingsCapabilityDefinition>()
	public discoveredCommands: SmartThingsDiscoveredCommand[] = []
	public rules: SmartThingsRule[] = []

	public deviceStatus: Map<string, SmartThingsDeviceStatus> = new Map()

	private pollTimer?: NodeJS.Timeout

	private oauthClient?: OAuthClient
	private oauthTokenProvider?: OAuthTokenProvider
	private oauthManager?: OAuthManager

	private secrets: ModuleSecrets = {
		patToken: '',
		oauthClientSecret: '',
		oauthTokens: '',
	}

	public async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		await this.configUpdated(config, secrets)
	}

	public async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		config.oauthClientId ??= ''
		config.oauthAuthorizationResponse ??= ''

		this.secrets = {
			patToken: secrets.patToken ?? '',
			oauthClientSecret: secrets.oauthClientSecret ?? '',
			oauthTokens: secrets.oauthTokens ?? '',
		}

		this.config = config
		this.stopPolling()
		this.devices = []
		this.locations = []
		this.capabilities.clear()
		this.discoveredCommands = []
		this.rules = []
		this.deviceStatus.clear()

		try {
			if (config.authMode === 'pat') {
				const patToken = secrets.patToken?.trim()
				if (!patToken) {
					this.updateStatus(InstanceStatus.BadConfig, 'SmartThings PAT required')
					return
				}
				const tokenProvider = new PatTokenProvider(secrets.patToken)
				this.api = new SmartThingsApi(tokenProvider)
			} else {
				const authenticated = await this.initializeOAuth(config, secrets)

				if (!authenticated) {
					this.beginOAuthAuthorization()
					this.updateStatus(InstanceStatus.BadConfig, 'Open the authorization URL shown in the log')
					return
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)

			this.updateStatus(InstanceStatus.BadConfig, message)
			return
		}

		try {
			this.updateStatus(InstanceStatus.Connecting)

			const api = this.api

			if (!api) {
				throw new Error('SmartThings API has not been initialized')
			}
			//Fetch all locations
			this.locations = await api.getLocations()

			if (config.locationId) {
				const selectedLocation = this.locations.find((location) => location.locationId === config.locationId)
				if (!selectedLocation) {
					throw new Error('Selected location is not available. Please choose a valid location.')
				}
				this.devices = await api.getDevicesByLocation(config.locationId)
			} else {
				this.devices = await api.getDevices()
			}

			this.initActions()
			this.initFeedbacks()
			this.initVariables()
			this.initPresets()

			this.updateStatus(InstanceStatus.Ok)

			void this.finishInitialization(config.locationId)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			const badConfig = message === 'Selected location is not available. Please choose a valid location.'

			this.log('error', message)
			this.updateStatus(badConfig ? InstanceStatus.BadConfig : InstanceStatus.ConnectionFailure, message)
		}
	}

	private async initializeOAuth(config: ModuleConfig, secrets: ModuleSecrets): Promise<boolean> {
		const clientId = config.oauthClientId?.trim()
		const clientSecret = secrets.oauthClientSecret?.trim()

		if (!clientId) {
			throw new Error('SmartThings OAuth Client ID required')
		}

		if (!clientSecret) {
			throw new Error('SmartThings OAuth Client Secret Required')
		}

		this.oauthClient = new OAuthClient(clientId, clientSecret, SMARTTHINGS_OAUTH_REDIRECT_URI, SMARTTHINGS_OAUTH_SCOPES)

		const savedTokens = deserializeOAuthTokens(this.secrets.oauthTokens)

		this.config.oauthAuthenticated = savedTokens !== undefined

		this.oauthTokenProvider = new OAuthTokenProvider(this.oauthClient, savedTokens, (tokens) => {
			this.persistOAuthTokens(tokens)
		})

		this.oauthManager = new OAuthManager(this.oauthClient, this.oauthTokenProvider, clientSecret)

		this.api = new SmartThingsApi(this.oauthTokenProvider)

		if (this.oauthTokenProvider.isAuthenticated()) {
			return true
		}

		const authorizationResponse = config.oauthAuthorizationResponse?.trim()

		if (!authorizationResponse) {
			return false
		}

		const { code, state } = decodeAuthorizationResponse(authorizationResponse)

		await this.oauthManager.completeAuthorization(code, state)
		this.config.oauthAuthenticated = true

		this.config = {
			...this.config,
			oauthAuthorizationResponse: '',
		}
		this.saveConfig(this.config, undefined)
		return true
	}

	public beginOAuthAuthorization(): URL {
		if (!this.oauthManager) {
			throw new Error('SmartThings OAuth is not configured')
		}

		const pending = this.oauthManager.beginAuthorization()

		this.log('info', `Open this URL to authorize SmartThings:\n${pending.authorizationUrl.toString()}`)

		this.updateStatus(InstanceStatus.Connecting, 'Waiting for SmartThings authorization')

		return pending.authorizationUrl
	}

	private async finishInitialization(locationId?: string): Promise<void> {
		try {
			const discoverResultPromise = discoverCommands(this.api!, this.devices, (message) => this.log('warn', message))

			const [discoverResult] = await Promise.all([discoverResultPromise, this.loadRules(locationId)])

			this.capabilities = discoverResult.capabilities
			this.discoveredCommands = discoverResult.commands

			this.initActions()
			this.initFeedbacks()
			this.initVariables()
			this.initPresets()

			await this.pollStatus()
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.log('error', `Background initialization failed: ${message}`)
		} finally {
			this.startPolling()
		}
	}

	public getConfigFields(): ReturnType<typeof GetConfigFields> {
		const fields = GetConfigFields()
		const locationField = fields.find((field) => field.id === 'locationId')

		if (locationField && 'choices' in locationField) {
			locationField.choices = [
				{ id: '', label: 'All locations' },
				...this.locations.map((location) => ({
					id: location.locationId,
					label: location.name,
				})),
			]

			const savedLocationId = this.config.locationId

			const savedLocationExists = locationField.choices.some((choice) => choice.id === savedLocationId)

			if (savedLocationId && !savedLocationExists) {
				locationField.choices.push({
					id: savedLocationId,
					label: `Previously selected location (${savedLocationId})`,
				})
			}
		}
		return fields
	}

	public async destroy(): Promise<void> {
		this.stopPolling()
	}

	private startPolling(): void {
		this.stopPolling()
		const interval = Math.max(1000, this.config.pollInterval || 5000)

		this.pollTimer = setInterval(() => {
			void this.pollStatus()
		}, interval)
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	public getDiscoveredCommand(commandKey: string): SmartThingsDiscoveredCommand | undefined {
		return this.discoveredCommands.find((command) => command.key === commandKey)
	}

	public getRule(ruleId: string): SmartThingsRule | undefined {
		return this.rules.find((rule) => rule.id === ruleId)
	}

	private async loadRules(locationId?: string): Promise<void> {
		if (!this.api || !locationId) {
			this.rules = []
			this.log('debug', 'No locationId provided, skipping rule loading')
			return
		}

		try {
			this.rules = await this.api.getRules(locationId)

			this.log('info', `Loaded ${this.rules.length} SmartThings rules`)
		} catch (error) {
			this.rules = []
			const message = error instanceof Error ? error.message : String(error)

			this.log('warn', `Failed to load rules: ${message}`)
		}
	}

	private pollInProgress = false
	private async pollStatus(): Promise<void> {
		// Populate device-state cache here.
		if (!this.api || this.pollInProgress) {
			return
		}

		this.pollInProgress = true
		try {
			for (const device of this.devices) {
				try {
					const status = await this.api.getDeviceStatus(device.deviceId)
					this.deviceStatus.set(device.deviceId, status)
					this.updateDeviceVariables(device.deviceId)
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					this.log('warn', `Failed to load status for device ${device.deviceId}: ${message}`)
				}
			}
			this.checkAllFeedbacks()
		} finally {
			this.pollInProgress = false
		}
	}

	public async refreshDeviceStatus(deviceId: string): Promise<void> {
		if (!this.api) {
			return
		}
		try {
			const status = await this.api.getDeviceStatus(deviceId)
			this.deviceStatus.set(deviceId, status)
			this.updateDeviceVariables(deviceId)
			this.checkFeedbacks('switch_is_on')
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.log('warn', `Failed to refresh device status for ${deviceId}: ${message}`)
		}
	}

	private updateDeviceVariables(deviceId: string): void {
		const status = this.deviceStatus.get(deviceId)
		const state = getSwitchState(status)
		this.setVariableValues({
			[`device_${deviceId}_switch`]: state ?? 'unknown',
		})
	}

	public initActions(): void {
		UpdateActions(this)
	}

	public initFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	public initVariables(): void {
		UpdateVariableDefinitions(this)
	}

	public initPresets(): void {
		UpdatePresets(this)
	}

	private persistOAuthTokens(tokens: OAuthTokens): void {
		this.secrets = {
			...this.secrets,
			oauthTokens: serializeOAuthTokens(tokens),
		}
		this.saveConfig(undefined, this.secrets)
	}

	public disconnectOAuth(): void {
		this.oauthTokenProvider?.clearTokens()

		this.secrets = {
			...this.secrets,
			oauthTokens: '',
		}
		this.config.oauthAuthenticated = false

		this.stopPolling()

		this.api = undefined
		this.oauthClient = undefined
		this.oauthTokenProvider = undefined
		this.oauthManager = undefined

		this.devices = []
		this.locations = []
		this.capabilities.clear()
		this.discoveredCommands = []
		this.rules = []
		this.deviceStatus.clear()

		this.saveConfig(this.config, this.secrets)

		this.updateStatus(
			InstanceStatus.BadConfig,
			'SmartThings OAuth disconnected. Save the configuration to authorize again.',
		)

		this.log('info', 'SmartThings OAuth authorization was removed.')
	}
}

export default SmartThingsInstance
export { UpgradeScripts }
