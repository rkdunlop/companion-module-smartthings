import { SmartThingsClient } from './client.js'
import { SmartThingsCapabilityApi } from './capabilities.js'
import { SmartThingsDevicesApi } from './devices.js'
import { SmartThingsRulesApi } from './rules.js'
import type {
	SmartThingsCapabilityDefinition,
	SmartThingsCommand,
	SmartThingsCommandResponse,
	SmartThingsDevice,
	SmartThingsLocation,
	SmartThingsRule,
	SmartThingsRuleExecution,
} from './types.js'
import type { SmartThingsDeviceStatus } from '../device/index.js'

export class SmartThingsApi {
	private readonly devicesApi: SmartThingsDevicesApi
	private readonly capabilitiesApi: SmartThingsCapabilityApi
	private readonly rulesApi: SmartThingsRulesApi

	public constructor(token: string) {
		const client = new SmartThingsClient(token)

		this.devicesApi = new SmartThingsDevicesApi(client)
		this.capabilitiesApi = new SmartThingsCapabilityApi(client)
		this.rulesApi = new SmartThingsRulesApi(client)
	}

	public async getLocations(): Promise<SmartThingsLocation[]> {
		return this.devicesApi.getLocations()
	}

	public async getDevices(): Promise<SmartThingsDevice[]> {
		return this.devicesApi.getDevices()
	}

	public async getDevicesByLocation(locationId: string): Promise<SmartThingsDevice[]> {
		return this.devicesApi.getDevicesByLocation(locationId)
	}

	public async getDeviceStatus(deviceId: string): Promise<SmartThingsDeviceStatus> {
		return this.devicesApi.getDeviceStatus(deviceId)
	}

	public async getCapability(capability: string, version: number): Promise<SmartThingsCapabilityDefinition> {
		return this.capabilitiesApi.getCapability(capability, version)
	}

	public async executeCommands(deviceId: string, commands: SmartThingsCommand[]): Promise<SmartThingsCommandResponse> {
		return this.devicesApi.executeCommands(deviceId, commands)
	}

	public async getRules(locationId?: string): Promise<SmartThingsRule[]> {
		return this.rulesApi.getRules(locationId)
	}

	public async executeRule(ruleId: string): Promise<SmartThingsRuleExecution> {
		return this.rulesApi.executeRule(ruleId)
	}
}

export type {
	SmartThingsCapabilityDefinition,
	SmartThingsCommand,
	SmartThingsDevice,
	SmartThingsDiscoveredCommand,
	SmartThingsLocation,
	SmartThingsRule,
	SmartThingsRuleExecution,
} from './types.js'
