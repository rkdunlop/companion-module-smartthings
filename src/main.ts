import { InstanceBase, InstanceStatus, type InstanceTypes } from '@companion-module/base'

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

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
} & InstanceTypes

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

	public deviceStatus: Map<string, unknown> = new Map()

	private pollTimer?: NodeJS.Timeout

	public async init(config: ModuleConfig, _isFirstInit: boolean, _secrets: undefined): Promise<void> {
		await this.configUpdated(config, _secrets)
	}

	public async configUpdated(config: ModuleConfig, _secrets: undefined): Promise<void> {
		this.config = config
		this.stopPolling()

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

			await Promise.all([this.discoverCommands(), this.loadRules(config.locationId)])

			this.initActions()
			this.initFeedbacks()
			this.initVariables()
			this.initPresets()

			await this.pollStatus()
			this.startPolling()

			this.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			const badConfig = message === 'Selected location is not available. Please choose a valid location.'

			this.log('error', message)
			this.updateStatus(badConfig ? InstanceStatus.BadConfig : InstanceStatus.ConnectionFailure, message)
		}
	}

	public getConfigFields(): ReturnType<typeof GetConfigFields> {
		const fields = GetConfigFields()
		const locationField = fields.find((field) => field.id === 'locationId')
		if (locationField && this.locations.length > 0 && 'choices' in locationField) {
			locationField.choices = this.locations.map((location) => ({
				id: location.locationId,
				label: location.name,
			}))
		}
		return fields
	}

	public async destroy(): Promise<void> {
		this.stopPolling()
	}

	private startPolling(): void {
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

	private async discoverCommands(): Promise<void> {
		if (!this.api) {
			return
		}
		this.capabilities.clear()
		this.discoveredCommands = []

		const requiredCapabilities = new Map<string, { id: string; version: number }>()

		/* Build a unique list of required capabilities and their versions from all devices and components */
		for (const device of this.devices) {
			for (const component of device.components) {
				for (const capabilityRef of component.capabilities) {
					const key = `${capabilityRef.id}:${capabilityRef.version}`
					if (!requiredCapabilities.has(key)) {
						requiredCapabilities.set(key, { id: capabilityRef.id, version: capabilityRef.version })
					}
				}
			}
		}

		/* Fetch the capability definitions for all required capabilities */
		const results = await Promise.allSettled(
			[...requiredCapabilities.entries()].map(async ([cacheKey, capability]) => {
				const definition = await this.api!.getCapability(capability.id, capability.version)
				return { cacheKey, definition }
			}),
		)

		for (const result of results) {
			if (result.status === 'fulfilled') {
				this.capabilities.set(result.value.cacheKey, result.value.definition)
				continue
			}
			const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
			this.log('warn', `Failed to fetch capability definition: ${message}`)
		}
		/* Build one flat list of device commands for use by companion actions and feedbacks */
		for (const device of this.devices) {
			const deviceLabel = device.label || device.name || device.deviceId
			for (const component of device.components ?? []) {
				for (const capability of component.capabilities ?? []) {
					const cacheKey = `${capability.id}:${capability.version}`
					const definition = this.capabilities.get(cacheKey)

					if (!definition?.commands) {
						continue
					}

					for (const [commandName, commandDefinition] of Object.entries(definition.commands)) {
						const key = [device.deviceId, component.id, capability.id, String(capability.version), commandName].join(
							'|',
						)

						this.discoveredCommands.push({
							key,
							deviceId: device.deviceId,
							deviceLabel,
							componentId: component.id,
							capabilityId: capability.id,
							capabilityVersion: capability.version,
							commandName,
							arguments: commandDefinition.arguments ?? [],
						})
					}
				}
			}
		}
		this.discoveredCommands.sort((a, b) => {
			return (
				a.deviceLabel.localeCompare(b.deviceLabel) ||
				a.capabilityId.localeCompare(b.capabilityId) ||
				a.commandName.localeCompare(b.commandName)
			)
		})

		this.log('info', `Discovered ${this.discoveredCommands.length} SmartThings commands`)
	}

	public getDiscoveredCommand(commandKey: string): SmartThingsDiscoveredCommand | undefined {
		return this.discoveredCommands.find((command) => command.key === commandKey)
	}

	public getRule(ruleId: string): SmartThingsRule | undefined {
		return this.rules.find((rule) => rule.id === ruleId)
	}

	private async loadRules(locationId?: string): Promise<void> {
		if (!this.api) {
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

	private async pollStatus(): Promise<void> {
		// Populate device-state cache here.
		if (!this.api) {
			return
		}

		for (const device of this.devices) {
			try {
				const status = await this.api.getDeviceStatus(device.deviceId)
				this.deviceStatus.set(device.deviceId, status)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				this.log('warn', `Failed to load status for device ${device.deviceId}: ${message}`)
			}
		}
	}

	public async refreshDeviceStatus(deviceId: string): Promise<void> {
		if (!this.api) {
			return
		}
		try {
			const status = await this.api.getDeviceStatus(deviceId)
			this.deviceStatus.set(deviceId, status)
			this.checkFeedbacks('*')
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.log('warn', `Failed to refresh device status for ${deviceId}: ${message}`)
		}
	}
	public getAttribute(deviceId: string, capability: string, attribute: string, component = 'main'): unknown {
		const status = this.deviceStatus.get(deviceId) as
			| {
					components?: Record<
						string,
						Record<
							string,
							Record<
								string,
								{
									value?: unknown
								}
							>
						>
					>
			  }
			| undefined

		return status?.components?.[component]?.[capability]?.[attribute]?.value
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
