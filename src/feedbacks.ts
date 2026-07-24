import type SmartThingsInstance from './main.js'
import type { CompanionFeedbackBooleanEvent, CompanionFeedbackContext } from '@companion-module/base'

export type FeedbacksSchema = {
	sample_feedback: {
		type: 'boolean'
		options: {
			num: number
		}
	}
}

export function UpdateFeedbacks(self: SmartThingsInstance): void {
	self.setFeedbackDefinitions({
		sample_feedback: {
			name: 'Example Feedback',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0xff0000,
				color: 0x000000,
			},
			options: [
				{
					id: 'num',
					type: 'number',
					label: 'Test',
					default: 5,
					min: 0,
					max: 10,
					clampValues: true,
				},
			],
			callback: (feedback: CompanionFeedbackBooleanEvent<{ num: number }>, _context: CompanionFeedbackContext) => {
				console.log('Hello world!', feedback.options.num)
				if (feedback.options.num > 5) {
					return true
				} else {
					return false
				}
			},
		},
	} as any)
}
