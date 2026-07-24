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
	const deviceChoices = self.devices.map((device) => ({
		id: device.deviceId,
		// use label if available, otherwise fall back to deviceId
		label: device.label || device.deviceId,
	}))

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

		switch_on: {
			name: 'Switch On',
			options: [
				{
					id: 'deviceId',
					type: 'dropdown',
					label: 'Device',
					default: deviceChoices[0]?.id ?? '',
					choices: deviceChoices,
				},
			],
			callback: async (event: CompanionActionEvent) => {
				console.log('Switching on', event.options.deviceId)
			},
		},
	})
}
