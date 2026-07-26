export class SmartThingsClient {
	private readonly baseUrl = 'https://api.smartthings.com/v1'
	private readonly token: string

	public constructor(token: string) {
		this.token = token.trim()
	}

	public async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const maxRetries = 5
		let attempt = 0

		while (true) {
			const response = await fetch(`${this.baseUrl}${path}`, {
				...options,
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${this.token}`,
					'Content-Type': 'application/json',
					...options.headers,
				},
			})

			if (response.ok) {
				if (response.status === 204) {
					return undefined as T
				}

				if (response.status === 429) {
					const resetHeader = response.headers.get('x-ratelimit-reset')
					const resetMs = Number(resetHeader)

					throw new Error(
						`SmartThings rate limit reached; reset in ${Number.isFinite(resetMs) ? resetMs : 'unknown'} ms`,
					)
				}

				return (await response.json()) as T
			}

			const text = await response.text()

			// Handle rate limiting with retry/backoff when possible
			if (response.status === 429 && attempt < maxRetries) {
				attempt++

				// Try to parse suggested retry time from the API response body
				let waitMs = 500 * attempt
				try {
					const body = JSON.parse(text)
					const details = body?.error?.details
					if (Array.isArray(details) && details[0]?.message) {
						const m: string = details[0].message
						const match = m.match(/retry in (\d+)/)
						if (match) {
							waitMs = Number(match[1])
						}
					}
				} catch (_) {
					// ignore parse errors and use exponential backoff
				}

				await new Promise((resolve) => setTimeout(resolve, waitMs))
				continue
			}
			if (response.status === 401) {
				throw new Error(
					'SmartThings authorization failed. The token may be invalid or expired. Personal Access Tokens expire after 24 hours.',
				)
			}
			throw new Error(`SmartThings API error ${response.status}: ${text}`)
		}
	}
}
