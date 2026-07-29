export type SmartThingsDeviceStatus = {
	components?: Record<
		string,
		Record<
			string,
			Record<
				string,
				{
					value?: unknown
				}
			>
		>
	>
}

export type SwitchState = 'on' | 'off'

export function getAttribute(
	status: SmartThingsDeviceStatus | undefined,
	capability: string,
	attribute: string,
	component = 'main',
): unknown {
	return status?.components?.[component]?.[capability]?.[attribute]?.value
}

export function getSwitchState(
	status: SmartThingsDeviceStatus | undefined,
	component = 'main',
): 'on' | 'off' | undefined {
	const value = getAttribute(status, 'switch', 'switch', component)

	if (value === 'on' || value === 'off') {
		return value
	}

	return undefined
}

export function isSwitchOn(status: SmartThingsDeviceStatus | undefined, component = 'main'): boolean | undefined {
	return getSwitchState(status, component) === 'on'
}
