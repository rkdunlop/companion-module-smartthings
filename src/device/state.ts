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

export async function getAttribute(
	deviceId: string,
	capability: string,
	attribute: string,
	component = 'main',
): unknown {
	const status = await api.getDeviceStatus(deviceId)

	return status?.components?.[component]?.[capability]?.[attribute]?.value
}
