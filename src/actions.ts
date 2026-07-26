import type {
	CompanionActionContext,
	CompanionActionDefinitions,
	CompanionActionEvent,
	DropdownChoice,
} from '@companion-module/base'

import type { SmartThingsInstance } from './main.js'

export type DeviceActionOptions = {
	commandKey: string
	argumentsJson: string
}
export type DeviceActionId = `device_${string}`
export type ActionsSchema = {
	execute_rule: {
		options: {
			ruleId: string
		}
	}
} & Record<
	DeviceActionId,
	{
		options: DeviceActionOptions
	}
>

type CompanionActionContextWithParse = CompanionActionContext & {
	parseVariablesInString(value: string): Promise<string>
}

function describeArguments(
	argumentsList: Array<{
		name: string
		optional?: boolean
		schema?: {
			type: string
			minimum?: number
			maximum?: number
			enum?: unknown[]
		}
	}>,
): string {
	if (argumentsList.length === 0) {
		return 'No arguments'
	}

	return argumentsList
		.map((argument) => {
			const type = argument.schema?.type ?? 'unknown'
			const optional = argument.optional ? '?' : ''

			let description = `${argument.name}${optional}: ${type}`

			if (argument.schema?.minimum !== undefined || argument.schema?.maximum !== undefined) {
				description += ` [${argument.schema.minimum ?? ''}-${argument.schema.maximum ?? ''}]`
			}

			if (argument.schema?.enum?.length) {
				description += ` (${argument.schema.enum.join(', ')})`
			}

			return description
		})
		.join(', ')
}

function parseArguments(value: string): unknown[] {
	const trimmed = value.trim()

	if (!trimmed) {
		return []
	}

	let parsed: unknown

	try {
		parsed = JSON.parse(trimmed)
	} catch (_error) {
		// If it's not valid JSON, try wrapping it in brackets to auto-convert single values
		try {
			parsed = JSON.parse(`[${trimmed}]`)
		} catch (innerError) {
			const message = innerError instanceof Error ? innerError.message : String(innerError)
			throw new Error(`Arguments are not valid JSON: ${message}`, { cause: innerError })
		}
	}

	if (!Array.isArray(parsed)) {
		throw new Error('Arguments must be a JSON array, such as [] or [50]')
	}

	return parsed
}

export function UpdateActions(self: SmartThingsInstance): void {
	const actions = {} as CompanionActionDefinitions<ActionsSchema>

	for (const device of self.devices) {
		const deviceLabel = device.label || device.name || device.deviceId

		const deviceCommands = self.discoveredCommands.filter((command) => command.deviceId === device.deviceId)

		if (deviceCommands.length === 0) {
			continue
		}

		const commandChoices: DropdownChoice[] = deviceCommands.map((command) => ({
			id: command.key,
			label: `${command.capabilityId}.${command.commandName} ` + `[${describeArguments(command.arguments)}]`,
		}))

		const actionId: DeviceActionId = `device_${device.deviceId}`

		actions[actionId] = {
			name: deviceLabel,
			description: `Execute a command on ${deviceLabel}`,
			options: [
				{
					id: 'commandKey',
					type: 'dropdown',
					label: 'Command',
					default: commandChoices[0]?.id ?? '',
					choices: commandChoices,
				},
				{
					id: 'argumentsJson',
					type: 'textinput',
					label: 'Arguments',
					default: '[]',
					tooltip: 'Enter a JSON array. Examples: [], [50], or ["heat"].',
					useVariables: true,
				},
			],
			callback: async (event: CompanionActionEvent<DeviceActionOptions>, context: CompanionActionContext) => {
				if (!self.api) {
					self.log('error', 'SmartThings API is not connected')
					return
				}

				const commandKey = typeof event.options.commandKey === 'string' ? event.options.commandKey : ''

				const command = self.getDiscoveredCommand(commandKey)

				if (!command) {
					self.log('error', 'The selected SmartThings command was not found.')
					return
				}

				if (command.deviceId !== device.deviceId) {
					self.log('error', 'The selected command does not belong to this device.')
					return
				}

				try {
					const rawArguments = typeof event.options.argumentsJson === 'string' ? event.options.argumentsJson : '[]'

					const expandedArguments = await (context as CompanionActionContextWithParse).parseVariablesInString(
						rawArguments,
					)

					const commandArguments = parseArguments(expandedArguments)

					await self.api.executeCommands(device.deviceId, [
						{
							component: command.componentId,
							capability: command.capabilityId,
							command: command.commandName,
							arguments: commandArguments,
						},
					])

					await self.refreshDeviceStatus(device.deviceId)
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)

					self.log('error', `SmartThings command failed: ${message}`)
				}
			},
		}
	}

	actions.execute_rule = {
		name: 'Execute SmartThings Rule',
		description: 'Execute a rule from SmartThings',
		options: [
			{
				id: 'ruleId',
				type: 'dropdown',
				label: 'Rule',
				default: self.rules[0]?.id ?? '',
				choices: self.rules.map((rule) => ({
					id: rule.id,
					label: `${rule.name}${rule.description ? ` - ${rule.description}` : ''}`,
				})),
			},
		],
		callback: async (event: CompanionActionEvent<{ ruleId: string }>, _context: CompanionActionContext) => {
			if (!self.api) {
				self.log('error', 'SmartThings API is not connected')
				return
			}

			const ruleId = typeof event.options.ruleId === 'string' ? event.options.ruleId : ''

			const rule = self.getRule(ruleId)

			if (!rule) {
				self.log('error', 'The selected SmartThings rule was not found. Re-select the rule in the action.')
				return
			}

			try {
				await self.api.executeRule(ruleId)

				self.log('debug', `Executed rule: ${rule.name}`)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)

				self.log('error', `SmartThings rule execution failed: ${message}`)
			}
		},
	}
	self.setActionDefinitions(actions)
}
