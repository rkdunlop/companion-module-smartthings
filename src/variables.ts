import type SmartThingsInstance from './main.js'
export type VariablesSchema = {
	[key: string]: string
}

function switchVariableId(deviceId: string): string {
	return `device_${deviceId}_switch`
}

export function UpdateVariableDefinitions(self: SmartThingsInstance): void {
	const definitions = Object.fromEntries(
		self.devices
			.filter((device) =>
				device.components?.some((component) =>
					component.capabilities?.some((capability) => capability.id === 'switch'),
				),
			)
			.map((device) => [
				switchVariableId(device.deviceId),
				{
					name: `${device.label || device.name || device.deviceId} switch state`,
				},
			]),
	)

	self.setVariableDefinitions(definitions)
}
