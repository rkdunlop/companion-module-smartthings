import type {
	SmartThingsCapabilityDefinition,
	SmartThingsCommand,
	SmartThingsDevice,
	SmartThingsLocation,
	SmartThingsRule,
	SmartThingsRuleExecution,
} from './types.js'

export class SmartThingsApi {
	private readonly baseUrl = 'https://api.smartthings.com/v1'

	public constructor(private token: string) {}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const maxRetries = 5
		let attempt = 0

		while (true) {
			const response = await fetch(`${this.baseUrl}${path}`, {
				...options,
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${this.token}`,
					'Content-Type': 'application/json',
					...options.headers,
				},
			})

			if (response.ok) {
				if (response.status === 204) {
					return undefined as T
				}

				return (await response.json()) as T
			}

			const text = await response.text()

			// Handle rate limiting with retry/backoff when possible
			if (response.status === 429 && attempt < maxRetries) {
				attempt++

				// Try to parse suggested retry time from the API response body
				let waitMs = 500 * attempt
				try {
					const body = JSON.parse(text)
					const details = body?.error?.details
					if (Array.isArray(details) && details[0]?.message) {
						const m: string = details[0].message
						const match = m.match(/retry in (\d+)/)
						if (match) {
							waitMs = Number(match[1])
						}
					}
				} catch (_) {
					// ignore parse errors and use exponential backoff
				}

				await new Promise((resolve) => setTimeout(resolve, waitMs))
				continue
			}

			throw new Error(`SmartThings API error ${response.status}: ${text}`)
		}
	}

	public async getLocations(): Promise<SmartThingsLocation[]> {
		const response = await this.request<{
			items: SmartThingsLocation[]
			_links?: unknown
		}>('/locations')

		return response.items
	}

	public async getDevices(): Promise<SmartThingsDevice[]> {
		const response = await this.request<{
			items: SmartThingsDevice[]
			_links?: unknown
		}>('/devices')

		return response.items
	}

	public async getDevicesByLocation(locationId: string): Promise<SmartThingsDevice[]> {
		return this.request<{
			items: SmartThingsDevice[]
			_links?: unknown
		}>(`/devices?locationId=${encodeURIComponent(locationId)}`).then((response) => response.items)
	}

	public async getDeviceStatus(deviceId: string): Promise<unknown> {
		return this.request(`/devices/${encodeURIComponent(deviceId)}/status`)
	}

	public async getCapability(capability: string, version: number): Promise<SmartThingsCapabilityDefinition> {
		return this.request(`/capabilities/${encodeURIComponent(capability)}/${version}`)
	}

	public async executeCommands(deviceId: string, commands: SmartThingsCommand[]): Promise<void> {
		await this.request(`/devices/${encodeURIComponent(deviceId)}/commands`, {
			method: 'POST',
			body: JSON.stringify({ commands }),
		})
	}

	public async getRules(locationId?: string): Promise<SmartThingsRule[]> {
		const url = locationId ? `/rules?locationId=${encodeURIComponent(locationId)}` : '/rules'
		const response = await this.request<{
			items?: SmartThingsRule[]
			_links?: unknown
		}>(url)

		return response.items ?? []
	}

	public async executeRule(ruleId: string): Promise<SmartThingsRuleExecution> {
		return this.request(`/rules/${encodeURIComponent(ruleId)}/execute`, {
			method: 'POST',
		})
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
