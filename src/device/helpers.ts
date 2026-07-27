import type { SmartThingsDevice, SmartThingsDeviceComponent } from '../api/types.js'

export function getDeviceLabel(device: SmartThingsDevice): string {
	return getDeviceLabel(device)
}

export function getPrimaryComponent(device: SmartThingsDevice): undefined | SmartThingsDeviceComponent {
	if (device.components.length === 0) {
		return undefined
	}

	return device.components.find((component) => component.id === 'main') || device.components[0]
}

export function hasCapability(device: SmartThingsDevice, capabilityId: string): boolean {
	return (
		device.components?.some((component) =>
			component.capabilities?.some((capability) => capability.id === capabilityId),
		) ?? false
	)
}

export function getComponentWithCapability(
	device: SmartThingsDevice,
	capabilityId: string,
): undefined | SmartThingsDeviceComponent {
	return device.components?.find((component) =>
		component.capabilities?.some((capability) => capability.id === capabilityId),
	)
}

export function getCapabilities(device: SmartThingsDevice): string[] {
	return [
		...new Set(
			device.components?.flatMap((component) => component.capabilities?.map((capability) => capability.id) ?? []) ?? [],
		),
	]
}

export function isTV(device: SmartThingsDevice): boolean {
	return hasCapability(device, 'mediaInputSource') && hasCapability(device, 'audioVolume')
}

export function isLight(device: SmartThingsDevice): boolean {
	return hasCapability(device, 'switch') && hasCapability(device, 'light')
}

export function isLock(device: SmartThingsDevice): boolean {
	return hasCapability(device, 'lock')
}

export function isOutlet(device: SmartThingsDevice): boolean {
	return hasCapability(device, 'switch') && hasCapability(device, 'outlet')
}
