import type SmartThingsInstance from './main.js'
import type {
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackContext,
	CompanionFeedbackSchema,
	CompanionOptionValues,
	DropdownChoice,
} from '@companion-module/base'

import { getDeviceLabel } from './device/index.js'

export type SwitchStateFeedbackOptions = CompanionOptionValues & {
	deviceId: string
	componentId: string
}

export type FeedbacksSchema = {
	switch_is_on: CompanionFeedbackSchema<SwitchStateFeedbackOptions>
}

export function UpdateFeedbacks(self: SmartThingsInstance): void {
	const switchDevices = self.devices.filter((device) =>
		device.components?.some((component) => component.capabilities?.some((capability) => capability.id === 'switch')),
	)
	const deviceChoices: DropdownChoice[] = switchDevices.map((device) => ({
		id: device.deviceId,
		label: getDeviceLabel(device),
	}))

	self.setFeedbackDefinitions({
		switch_is_on: {
			name: 'Device switch is on',
			description: 'Changes the button style when the selected SmartThings device reports that it is on.',
			type: 'boolean',

			defaultStyle: {
				bgcolor: 0x008000,
				color: 0xffffff,
			},
			options: [
				{
					id: 'deviceId',
					type: 'dropdown',
					label: 'Device',
					default: deviceChoices[0]?.id ?? '',
					choices: deviceChoices,
				},
				{
					id: 'componentId',
					type: 'textinput',
					label: 'Component',
					default: 'main',
				},
			],
			callback: (
				feedback: CompanionFeedbackBooleanEvent<SwitchStateFeedbackOptions>,
				_context: CompanionFeedbackContext,
			) => {
				const deviceId = typeof feedback.options.deviceId === 'string' ? feedback.options.deviceId : ''

				const componentId =
					typeof feedback.options.componentId === 'string' && feedback.options.componentId
						? feedback.options.componentId
						: 'main'

				const switchState = self.getAttribute(deviceId, 'switch', 'switch', componentId)
				return switchState === 'on'
			},
		},
	})
}
