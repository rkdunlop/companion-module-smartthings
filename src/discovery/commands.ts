import { getDeviceLabel } from '../device/index.js'
import type {
	SmartThingsApi,
	SmartThingsCapabilityDefinition,
	SmartThingsDevice,
	SmartThingsDiscoveredCommand,
} from '../api/api.js'

export type CommandDiscoveryResult = {
	capabilities: Map<string, SmartThingsCapabilityDefinition>
	commands: SmartThingsDiscoveredCommand[]
}

export async function discoverCommands(
	api: SmartThingsApi,
	devices: SmartThingsDevice[],
	onWarning?: (message: string) => void,
): Promise<CommandDiscoveryResult> {
	const capabilities = new Map<string, SmartThingsCapabilityDefinition>()
	const discoveredCommands: SmartThingsDiscoveredCommand[] = []

	const requiredCapabilities = new Map<string, { id: string; version: number }>()

	/* Build a unique list of required capabilities and their versions from all devices and components */
	for (const device of devices) {
		for (const component of device.components ?? []) {
			for (const capabilityRef of component.capabilities ?? []) {
				const key = `${capabilityRef.id}:${capabilityRef.version}`
				if (!requiredCapabilities.has(key)) {
					requiredCapabilities.set(key, { id: capabilityRef.id, version: capabilityRef.version })
				}
			}
		}
	}

	/* Fetch the capability definitions for all required capabilities */
	const results = await Promise.allSettled(
		[...requiredCapabilities.entries()].map(async ([cacheKey, capability]) => {
			const definition = await api.getCapability(capability.id, capability.version)
			return { cacheKey, definition }
		}),
	)

	for (const result of results) {
		if (result.status === 'fulfilled') {
			capabilities.set(result.value.cacheKey, result.value.definition)
			continue
		}

		const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
		onWarning?.(`Failed to fetch capability definition: ${message}`)
	}

	/* Build one flat list of device commands for use by companion actions and feedbacks */
	for (const device of devices) {
		const deviceLabel = getDeviceLabel(device)
		for (const component of device.components ?? []) {
			for (const capability of component.capabilities ?? []) {
				const cacheKey = `${capability.id}:${capability.version}`
				const definition = capabilities.get(cacheKey)

				if (!definition?.commands) {
					continue
				}

				for (const [commandName, commandDefinition] of Object.entries(definition.commands)) {
					const key = [device.deviceId, component.id, capability.id, String(capability.version), commandName].join('|')

					discoveredCommands.push({
						key,
						deviceId: device.deviceId,
						deviceLabel,
						componentId: component.id,
						capabilityId: capability.id,
						capabilityVersion: capability.version,
						commandName,
						arguments: commandDefinition.arguments ?? [],
					})
				}
			}
		}
	}

	discoveredCommands.sort((a, b) => {
		return (
			a.deviceLabel.localeCompare(b.deviceLabel) ||
			a.capabilityId.localeCompare(b.capabilityId) ||
			a.commandName.localeCompare(b.commandName)
		)
	})

	return { capabilities, commands: discoveredCommands }
}
