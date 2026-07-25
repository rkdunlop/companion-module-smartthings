import type { CompanionActionDefinitions, CompanionActionEvent, DropdownChoice } from '@companion-module/base'

import type { SmartThingsInstance } from './main.js'

export type ActionsSchema = {
	execute_discovered_command: {
		options: {
			commandKey: string
			argumentsJson: string
		}
	}
	execute_rule: {
		options: {
			ruleId: string
		}
	}
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

function parseArguments(value: string, expectedCount: number): unknown[] {
	const trimmed = value.trim()

	if (!trimmed) {
		if (expectedCount === 0) {
			return []
		}

		throw new Error(`This command expects ${expectedCount} argument(s)`)
	}

	let parsed: unknown

	try {
		parsed = JSON.parse(trimmed)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)

		throw new Error(`Arguments are not valid JSON: ${message}`, { cause: error })
	}

	if (!Array.isArray(parsed)) {
		throw new Error('Arguments must be a JSON array, such as [] or [50]')
	}

	return parsed
}

export function UpdateActions(self: SmartThingsInstance): void {
	const commandChoices: DropdownChoice[] = self.discoveredCommands.map((command) => ({
		id: command.key,
		label:
			`${command.deviceLabel} → ` +
			`${command.componentId} → ` +
			`${command.capabilityId}.${command.commandName} ` +
			`[${describeArguments(command.arguments)}]`,
	}))

	const actions: CompanionActionDefinitions<ActionsSchema> = {
		execute_discovered_command: {
			name: 'Execute SmartThings Command',
			description: 'Execute a command discovered from a SmartThings device capability',
			options: [
				{
					id: 'commandKey',
					type: 'dropdown',
					label: 'Device command',
					default: commandChoices[0]?.id ?? '',
					choices: commandChoices,
				},
				{
					id: 'argumentsJson',
					type: 'textinput',
					label: 'Arguments',
					default: '[]',
					tooltip: 'Enter a JSON array. Examples: [] for no arguments, [50] for a level, or ["heat"] for a mode.',
					useVariables: true,
				},
			],
			callback: async (event: CompanionActionEvent, _context) => {
				if (!self.api) {
					self.log('error', 'SmartThings API is not connected')
					return
				}

				const commandKey = typeof event.options.commandKey === 'string' ? event.options.commandKey : ''

				const command = self.getDiscoveredCommand(commandKey)

				if (!command) {
					self.log('error', 'The selected SmartThings command was not found. Re-select the command in the action.')
					return
				}

				try {
					const argumentsJson = typeof event.options.argumentsJson === 'string' ? event.options.argumentsJson : '[]'

					const commandArguments = parseArguments(argumentsJson, command.arguments.length)

					await self.api.executeCommands(command.deviceId, [
						{
							component: command.componentId,
							capability: command.capabilityId,
							command: command.commandName,
							arguments: commandArguments,
						},
					])

					self.log('debug', `Executed ${command.capabilityId}.${command.commandName} on ${command.deviceLabel}`)

					await self.refreshDeviceStatus(command.deviceId)
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)

					self.log('error', `SmartThings command failed: ${message}`)
				}
			},
		},
		execute_rule: {
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
			callback: async (event: CompanionActionEvent, _context) => {
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
		},
	}

	self.setActionDefinitions(actions)
}
