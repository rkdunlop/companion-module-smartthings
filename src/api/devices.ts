import type { SmartThingsCommand, SmartThingsCommandResponse, SmartThingsDevice, SmartThingsLocation } from './types.js'

import type { SmartThingsClient } from './client.js'

interface SmartThingsListResponse<T> {
	items: T[]
	_links?: unknown
}

export class SmartThingsDevicesApi {
	public constructor(private readonly client: SmartThingsClient) {}

	public async getLocations(): Promise<SmartThingsLocation[]> {
		const response = await this.client.request<SmartThingsListResponse<SmartThingsLocation>>('/locations')

		return response.items
	}

	public async getDevices(): Promise<SmartThingsDevice[]> {
		const response = await this.client.request<SmartThingsListResponse<SmartThingsDevice>>('/devices')

		return response.items
	}

	public async getDevicesByLocation(locationId: string): Promise<SmartThingsDevice[]> {
		const response = await this.client.request<SmartThingsListResponse<SmartThingsDevice>>(
			`/devices?locationId=${encodeURIComponent(locationId)}`,
		)
		return response.items
	}

	public async getDeviceStatus(deviceId: string): Promise<unknown> {
		return this.client.request(`/devices/${encodeURIComponent(deviceId)}/status`)
	}

	public async executeCommands(deviceId: string, commands: SmartThingsCommand[]): Promise<SmartThingsCommandResponse> {
		return this.client.request<SmartThingsCommandResponse>(`/devices/${encodeURIComponent(deviceId)}/commands`, {
			method: 'POST',
			body: JSON.stringify({ commands }),
		})
	}
}
