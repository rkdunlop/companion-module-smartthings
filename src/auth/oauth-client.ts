export interface OAuthTokens {
	accessToken: string
	refreshToken: string
	expiresAt: number
}

export class OAuthClient {
	public constructor(
		private readonly clientId: string,
		//private readonly _clientSecret: string,
		private readonly redirectUri: string,
	) {}

	public buildAuthorizationUrl(): string {
		const url = new URL('https://api.smarthings.com/oauth/authorize')

		url.searchParams.set('client_id', this.clientId)
		url.searchParams.set('redirect_uri', this.redirectUri)
		url.searchParams.set('response_type', 'code')

		return url.toString()
	}

	public async exchangeAuthorizationCode(_code: string): Promise<OAuthTokens> {
		throw new Error('Not Implemented')
	}

	public async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
		throw new Error('Not Implemented')
	}
}
