export interface OAuthAuthorizationResponse {
	code: string
	state: string
}

export function decodeAuthorizationResponse(value: string): OAuthAuthorizationResponse {
	const trimmedValue = value.trim()

	if (!trimmedValue) {
		throw new Error('SmartThings authorization response is required')
	}

	let parsed: unknown
	try {
		const json = Buffer.from(trimmedValue, 'base64url').toString('utf8')
		parsed = JSON.parse(json)
	} catch {
		throw new Error('The SmartThings authorization response is invalid')
	}

	if (!isAuthorizationResponse(parsed)) {
		throw new Error('The SmartThings authorization response is invalid.')
	}
	return parsed
}

function isAuthorizationResponse(value: unknown): value is OAuthAuthorizationResponse {
	if (typeof value !== 'object' || value === null) {
		return false
	}

	if (!('code' in value) || !('state' in value)) {
		return false
	}

	return (
		typeof value.code === 'string' && value.code.length > 0 && typeof value.state === 'string' && value.state.length > 0
	)
}
