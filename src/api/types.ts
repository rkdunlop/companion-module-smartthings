export interface SmartThingsCapabilityReference {
	id: string
	version: number
}

export interface SmartThingsDeviceComponent {
	id: string
	label?: string
	capabilities: SmartThingsCapabilityReference[]
	categories?: Array<{
		name: string
		categoryType?: string
	}>
}

export interface SmartThingsDevice {
	deviceId: string
	name: string
	label?: string
	locationId?: string
	roomId?: string
	components: SmartThingsDeviceComponent[]
}

export interface SmartThingsCommandArgument {
	name: string
	optional?: boolean
	schema?: {
		type: string
		minimum?: number
		maximum?: number
		enum?: unknown[]
		default?: unknown
		properties?: Record<string, unknown>
		items?: Record<string, unknown>
	}
}

export interface SmartThingsCapabilityCommand {
	name?: string
	arguments?: SmartThingsCommandArgument[]
}

export interface SmartThingsCapabilityDefinition {
	id: string
	version: number
	status?: string
	name?: string
	attributes?: Record<string, unknown>
	commands?: Record<string, SmartThingsCapabilityCommand>
}

export interface SmartThingsCommand {
	component: string
	capability: string
	command: string
	arguments?: unknown[]
}

export interface SmartThingsDiscoveredCommand {
	key: string
	deviceId: string
	deviceLabel: string
	componentId: string
	capabilityId: string
	capabilityVersion: number
	commandName: string
	arguments: SmartThingsCommandArgument[]
}

export interface SmartThingsLocation {
	locationId: string
	name: string
}
