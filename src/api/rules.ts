import type { SmartThingsClient } from './client.js'
import type { SmartThingsRule, SmartThingsRuleExecution } from './types.js'

interface SmartThingsRulesResponse {
	items?: SmartThingsRule[]
	_links?: unknown
}

export class SmartThingsRulesApi {
	public constructor(private readonly client: SmartThingsClient) {}

	public async getRules(locationId?: string): Promise<SmartThingsRule[]> {
		const path = locationId ? `/rules?locationId=${encodeURIComponent(locationId)}` : '/rules'

		const response = await this.client.request<SmartThingsRulesResponse>(path)

		return response.items ?? []
	}

	public async executeRule(ruleId: string): Promise<SmartThingsRuleExecution> {
		return this.client.request<SmartThingsRuleExecution>(`/rules/${encodeURIComponent(ruleId)}/execute`, {
			method: 'POST',
		})
	}
}
