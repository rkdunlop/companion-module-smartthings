export interface OAuthTokens {
	accessToken: string
	refreshToken: string
	expiresAt: number
	installedAppId: string
	grantedScopes: string[]
}

interface SmartThingsTokenResponse {
	access_token: string
	token_type: string
	refresh_token: string
	expires_in: number
	scope: string
	installed_app_id: string
}
const TOKEN_EXPIRY_MARGIN_MS = 60000
export class OAuthClient {
	public constructor(
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly redirectUri: string,
		private readonly scopes: string[],
	) {}

	public buildAuthorizationUrl(state: string): URL {
		const url = new URL('https://api.smartthings.com/v1/oauth/authorize')

		url.searchParams.set('client_id', this.clientId)
		url.searchParams.set('scope', this.scopes.join(' '))
		url.searchParams.set('redirect_uri', this.redirectUri)
		url.searchParams.set('response_type', 'code')
		url.searchParams.set('state', state)

		return url
	}

	public async exchangeAuthorizationCode(code: string): Promise<OAuthTokens> {
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
		})

		const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

		const response = await fetch('https://api.smartthings.com/v1/oauth/token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				Authorization: `Basic ${credentials}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body,
		})

		if (!response.ok) {
			const responseBody = await response.text()

			throw new Error(`SmartThings OAuth token exchange failed: ${response.status} ${responseBody}`)
		}

		const result = (await response.json()) as SmartThingsTokenResponse

		return {
			accessToken: result.access_token,
			refreshToken: result.refresh_token,
			expiresAt: Date.now() + result.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
			installedAppId: result.installed_app_id,
			grantedScopes: result.scope.split(' '),
		}
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const body = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: this.clientId,
		})

		const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

		const response = await fetch('https://api.smartthings.com/v1/oauth/token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				Authorization: `Basic ${credentials}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body,
		})

		if (!response.ok) {
			const responseBody = await response.text()

			throw new Error(`SmartThings OAuth token refresh failed: ${response.status} ${responseBody}`)
		}

		const result = (await response.json()) as SmartThingsTokenResponse

		return {
			accessToken: result.access_token,
			refreshToken: result.refresh_token,
			expiresAt: Date.now() + result.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
			installedAppId: result.installed_app_id,
			grantedScopes: result.scope.split(' '),
		}
	}
}
