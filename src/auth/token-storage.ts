import type { OAuthTokens } from './oauth-client.js'

export function serializeOAuthTokens(tokens: OAuthTokens): string {
	return JSON.stringify(tokens)
}

export function deserializeOAuthTokens(value: string | undefined): OAuthTokens | undefined {
	if (!value?.trim()) {
		return undefined
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(value)
	} catch {
		throw new Error('Stored SmartThings OAuth tokens are invalid.')
	}
	if (!isOAuthTokens(parsed)) {
		throw new Error('Stored SmartThings OAuth tokens are invalid.')
	}

	return parsed
}

function isOAuthTokens(value: unknown): value is OAuthTokens {
	if (typeof value !== 'object' || value === null) {
		return false
	}

	return (
		'accessToken' in value &&
		typeof value.accessToken === 'string' &&
		value.accessToken.length > 0 &&
		'refreshToken' in value &&
		typeof value.refreshToken === 'string' &&
		value.refreshToken.length > 0 &&
		'expiresAt' in value &&
		typeof value.expiresAt === 'number'
	)
}
