import { InstanceBase, InstanceStatus } from '@companion-module/base'

import {
	SmartThingsApi,
	type SmartThingsDevice,
	type SmartThingsLocation,
	type SmartThingsCapabilityDefinition,
	type SmartThingsDiscoveredCommand,
	type SmartThingsRule,
} from './api/api.js'
import type { ModuleConfig } from './config.js'
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

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export class SmartThingsInstance extends InstanceBase<ModuleSchema> {
	public config: ModuleConfig = {
		token: '',
		pollInterval: 5000,
		locationId: '',
	}

	public api?: SmartThingsApi
	public devices: SmartThingsDevice[] = []
	public locations: SmartThingsLocation[] = []
	public capabilities = new Map<string, SmartThingsCapabilityDefinition>()
	public discoveredCommands: SmartThingsDiscoveredCommand[] = []
	public rules: SmartThingsRule[] = []

	public deviceStatus: Map<string, SmartThingsDeviceStatus> = new Map()

	private pollTimer?: NodeJS.Timeout

	public async init(config: ModuleConfig, _isFirstInit: boolean, _secrets: undefined): Promise<void> {
		await this.configUpdated(config, _secrets)
	}

	public async configUpdated(config: ModuleConfig, _secrets: undefined): Promise<void> {
		this.config = config
		this.stopPolling()
		this.devices = []
		this.locations = []
		this.capabilities.clear()
		this.discoveredCommands = []
		this.rules = []
		this.deviceStatus.clear()

		if (!config.token) {
			this.updateStatus(InstanceStatus.BadConfig, 'Token required')
			return
		}

		this.api = new SmartThingsApi(config.token)

		try {
			this.updateStatus(InstanceStatus.Connecting)
			//Fetch all locations
			this.locations = await this.api.getLocations()

			if (config.locationId) {
				const selectedLocation = this.locations.find((location) => location.locationId === config.locationId)
				if (!selectedLocation) {
					throw new Error('Selected location is not available. Please choose a valid location.')
				}
				this.devices = await this.api.getDevicesByLocation(config.locationId)
			} else {
				this.devices = await this.api.getDevices()
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
}

export default SmartThingsInstance
export { UpgradeScripts }
