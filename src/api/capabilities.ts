import type { SmartThingsClient } from './client.js'
import type { SmartThingsCapabilityDefinition } from './types.js'

export class SmartThingsCapabilityApi {
	public constructor(private readonly client: SmartThingsClient) {}

	public async getCapability(capability: string, version: number): Promise<SmartThingsCapabilityDefinition> {
		return this.client.request<SmartThingsCapabilityDefinition>(
			`/capabilities/${encodeURIComponent(capability)}/${version}`,
		)
	}
}
