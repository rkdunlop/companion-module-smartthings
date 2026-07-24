import { InstanceBase, InstanceStatus, type InstanceTypes } from '@companion-module/base'

import { SmartThingsApi, type SmartThingsDevice } from './api/api.js'
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

class SmartThingsInstance extends InstanceBase<ModuleSchema> {
	public config: ModuleConfig = {
		token: '',
		pollInterval: 5000,
	}

	public api?: SmartThingsApi
	public devices: SmartThingsDevice[] = []

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
			this.devices = await this.api.getDevices()

			this.initActions()
			this.initFeedbacks()
			this.initVariables()
			this.initPresets()

			await this.pollStatus()
			this.startPolling()

			this.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)

			this.log('error', message)
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
		}
	}

	public getConfigFields(): ReturnType<typeof GetConfigFields> {
		return GetConfigFields()
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

	private async pollStatus(): Promise<void> {
		// Populate device-state cache here.
		if (!this.api) {
			return
		}

		for (const device of this.devices) {
			await this.api.getDeviceStatus(device.deviceId)
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
