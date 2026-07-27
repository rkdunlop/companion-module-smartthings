import test from 'node:test'
import assert from 'node:assert/strict'

import {
	getDeviceLabel,
	getPrimaryComponent,
	hasCapability,
	getComponentWithCapability,
	getCapabilities,
} from '../dist/device/helpers.js'

function createDevice(overrides = {}) {
	return {
		deviceId: 'device-123',
		name: 'smartthings-device-name',
		label: 'Living Room Television',
		locationId: 'location-123',
		roomId: 'room-123',
		components: [
			{
				id: 'main',
				label: 'Main',
				capabilities: [
					{ id: 'switch', version: 1 },
					{ id: 'audioVolume', version: 1 },
				],
			},
			{
				id: 'secondary',
				label: 'Secondary',
				capabilities: [{ id: 'refresh', version: 1 }],
			},
		],
		...overrides,
	}
}

test('getDeviceLabel returns the device label when available', () => {
	const device = createDevice()

	assert.equal(getDeviceLabel(device), 'Living Room Television')
})

test('getDeviceLabel falls back to the device name when label is missing', () => {
	const device = createDevice({
		label: undefined,
		name: 'fallback-device-name',
	})

	assert.equal(getDeviceLabel(device), 'fallback-device-name')
})

test('getDeviceLabel falls back to the device ID when label and name are empty', () => {
	const device = createDevice({
		label: undefined,
		name: '',
		deviceId: 'fallback-device-id',
	})

	assert.equal(getDeviceLabel(device), 'fallback-device-id')
})

test('getPrimaryComponent returns the component named main', () => {
	const device = createDevice()

	assert.equal(getPrimaryComponent(device)?.id, 'main')
})

test('getPrimaryComponent returns the first component when main is absent', () => {
	const device = createDevice({
		components: [
			{
				id: 'component-one',
				capabilities: [],
			},
			{
				id: 'component-two',
				capabilities: [],
			},
		],
	})

	assert.equal(getPrimaryComponent(device)?.id, 'component-one')
})

test('getPrimaryComponent returns undefined when the device has no components', () => {
	const device = createDevice({
		components: [],
	})

	assert.equal(getPrimaryComponent(device), undefined)
})

test('hasCapability returns true when any component contains the capability', () => {
	const device = createDevice()

	assert.equal(hasCapability(device, 'switch'), true)
	assert.equal(hasCapability(device, 'refresh'), true)
})

test('hasCapability returns false when no component contains the capability', () => {
	const device = createDevice()

	assert.equal(hasCapability(device, 'lock'), false)
})

test('hasCapability returns false when the device has no components', () => {
	const device = createDevice({
		components: [],
	})

	assert.equal(hasCapability(device, 'switch'), false)
})

test('getComponentWithCapability returns the first matching component', () => {
	const device = createDevice()

	const component = getComponentWithCapability(device, 'refresh')

	assert.equal(component?.id, 'secondary')
})

test('getComponentWithCapability returns undefined when capability is absent', () => {
	const device = createDevice()

	assert.equal(getComponentWithCapability(device, 'lock'), undefined)
})

test('getCapabilities returns capability IDs from every component', () => {
	const device = createDevice()

	assert.deepEqual(getCapabilities(device), ['switch', 'audioVolume', 'refresh'])
})

test('getCapabilities removes duplicate capability IDs', () => {
	const device = createDevice({
		components: [
			{
				id: 'main',
				capabilities: [
					{ id: 'switch', version: 1 },
					{ id: 'refresh', version: 1 },
				],
			},
			{
				id: 'secondary',
				capabilities: [
					{ id: 'switch', version: 1 },
					{ id: 'battery', version: 1 },
				],
			},
		],
	})

	assert.deepEqual(getCapabilities(device), ['switch', 'refresh', 'battery'])
})

test('getCapabilities returns an empty array when there are no capabilities', () => {
	const device = createDevice({
		components: [],
	})

	assert.deepEqual(getCapabilities(device), [])
})
