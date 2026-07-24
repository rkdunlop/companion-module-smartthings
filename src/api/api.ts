export interface SmartThingsDevice {
	deviceId: string
	name: string
	label?: string
	locationId?: string
	roomId?: string
	components?: Array<{
		id: string
		capabilities: Array<{
			id: string
			version: number
		}>
	}>
}

export interface SmartThingsCommand {
	component: string
	capability: string
	command: string
	arguments?: unknown[]
}

export class SmartThingsApi {
	private readonly baseUrl = 'https://api.smartthings.com/v1'

	public constructor(private token: string) {}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			...options,
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/json',
				...options.headers,
			},
		})

		if (!response.ok) {
			const text = await response.text()

			throw new Error(`SmartThings API error ${response.status}: ${text}`)
		}

		if (response.status === 204) {
			return undefined as T
		}

		return (await response.json()) as T
	}

	public async getDevices(): Promise<SmartThingsDevice[]> {
		const response = await this.request<{
			items: SmartThingsDevice[]
			_links?: unknown
		}>('/devices')

		return response.items
	}

	public async getDeviceStatus(deviceId: string): Promise<unknown> {
		return this.request(`/devices/${encodeURIComponent(deviceId)}/status`)
	}

	public async executeCommands(deviceId: string, commands: SmartThingsCommand[]): Promise<void> {
		await this.request(`/devices/${encodeURIComponent(deviceId)}/commands`, {
			method: 'POST',
			body: JSON.stringify({ commands }),
		})
	}
}
