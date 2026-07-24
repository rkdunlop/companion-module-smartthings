import type SmartThingsInstance from './main.js'
import type { CompanionActionEvent } from '@companion-module/base'

export type ActionsSchema = {
	sample_action: {
		options: {
			num: number
		}
	}
}

export function UpdateActions(self: SmartThingsInstance): void {
	self.setActionDefinitions({
		sample_action: {
			name: 'My First Action',
			options: [
				{
					id: 'num',
					type: 'number',
					label: 'Test',
					default: 5,
					min: 0,
					max: 100,
				},
			],
			callback: async (event: CompanionActionEvent) => {
				console.log('Hello world!', event.options.num)
			},
		},
	})
}
