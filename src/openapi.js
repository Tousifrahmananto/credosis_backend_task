import { routes } from './routes.js';

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Dhaka Bus Tracker API',
    version: '0.1.0',
    description: 'Credosis backend demo: routes, bus locations, stale-data flags and per-bus authenticated GPS updates. Simulated bus readings persist in a local SQLite database across restarts.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/buses/{id}/location': {
      post: {
        operationId: 'updateBusLocation',
        summary: 'Update one demo bus location',
        description: 'Requires the target bus tracker token (minimum 32 characters), configured in the server environment. Use Authorize with the token only. Accepts at most 1 KB of JSON. recordedAt must be UTC ISO with milliseconds, no later than server time and strictly newer than the saved reading. Unknown fields are rejected. SQLite saves accepted updates across restarts. The timestamp condition is enforced atomically in SQL. Never paste tracker tokens into public recordings.',
        tags: ['Buses'],
        security: [{ TrackerToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'demo-bus-01' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationUpdate' } } },
        },
        responses: {
          200: {
            description: 'Updated simulated bus location.',
            content: { 'application/json': { schema: {
              type: 'object', required: ['dataMode', 'bus'],
              properties: { dataMode: { type: 'string', enum: ['simulated'] }, bus: { $ref: '#/components/schemas/BusLocation' } },
            } } },
          },
          ...Object.fromEntries([
            [400, 'Invalid coordinates, fields or timestamp; malformed JSON'],
            [401, 'Missing or incorrect token for this bus'],
            [404, 'Bus not found'],
            [409, 'Reading is older than or equal to the saved timestamp'],
            [413, 'Request body exceeds 1 KB'],
            [415, 'Unsupported content type or encoding'],
            [503, 'Bus token missing/too short, or location storage temporarily unavailable'],
          ].map(([status, description]) => [status, {
            description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          }])),
        },
      },
    },
    '/routes/{id}/buses': {
      get: {
        operationId: 'listRouteBuses',
        summary: 'Get sample bus locations and freshness',
        description: 'Public read-only endpoint. Returns saved bus locations and computed isStale flags. Readings at least 120 seconds old are stale. Timestamps survive restarts and change only after an accepted GPS update. Existing routes with no assigned buses return an empty array. No arrival predictions are provided.',
        tags: ['Buses'],
        parameters: [{
          name: 'id', in: 'path', required: true,
          description: 'Route ID from GET /routes.',
          schema: { type: 'string' }, example: 'demo-mirpur-farmgate',
        }],
        responses: {
          200: {
            description: 'Sample bus locations with server-calculated freshness.',
            headers: { 'Cache-Control': { schema: { type: 'string', example: 'no-store' } } },
            content: { 'application/json': {
              schema: { $ref: '#/components/schemas/BusLocationsResponse' },
              example: {
                dataMode: 'simulated',
                notice: 'Simulated bus locations saved in SQLite. Not live bus locations.',
                routeId: 'demo-mirpur-farmgate',
                checkedAt: '2026-11-05T10:00:00.000Z',
                staleAfterSeconds: 120,
                buses: [{
                  id: 'demo-bus-01', routeId: 'demo-mirpur-farmgate',
                  latitude: 23.8021, longitude: 90.3705,
                  lastUpdated: '2026-11-05T09:59:30.000Z', isStale: false,
                }],
              },
            } },
          },
          404: {
            description: 'The requested route does not exist.',
            content: { 'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Route not found' },
            } },
          },
          503: {
            description: 'Location storage is temporarily unavailable.',
            content: { 'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Location storage is temporarily unavailable' },
            } },
          },
        },
      },
    },
    '/routes': {
      get: {
        operationId: 'listRoutes',
        summary: 'List demo routes with ordered stops',
        description: 'Public read-only endpoint. No parameters or request body. Stops are returned in travel order. The demo currently contains one fictional service.',
        tags: ['Routes'],
        responses: {
          200: {
            description: 'Simulated routes and ordered stops. Not live transit information.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RoutesResponse' },
                example: {
                  dataMode: 'simulated',
                  notice: 'Fictional demo service with approximate stop coordinates. Not live transit information.',
                  routes,
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      TrackerToken: { type: 'http', scheme: 'bearer', description: 'Per-bus tracker token. Paste the token only, without the Bearer prefix.' },
    },
    schemas: {
      LocationUpdate: {
        type: 'object', additionalProperties: false,
        required: ['latitude', 'longitude', 'recordedAt'],
        properties: {
          latitude: { type: 'number', minimum: -90, maximum: 90, example: 23.799 },
          longitude: { type: 'number', minimum: -180, maximum: 180, example: 90.371 },
          recordedAt: { type: 'string', format: 'date-time', description: 'Replace with the current UTC timestamp, e.g. new Date().toISOString(). Must be strictly newer than the saved reading and not in the future.', example: '2026-11-05T10:00:00.000Z' },
        },
      },
      BusLocation: {
        type: 'object',
        required: ['id', 'routeId', 'latitude', 'longitude', 'lastUpdated', 'isStale'],
        properties: {
          id: { type: 'string', example: 'demo-bus-01' },
          routeId: { type: 'string', example: 'demo-mirpur-farmgate' },
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          lastUpdated: { type: 'string', format: 'date-time', description: 'UTC reading timestamp from the seed or last accepted GPS update. Not refreshed when queried.' },
          isStale: { type: 'boolean', description: 'True when the reading is at least 120 seconds old at checkedAt.' },
        },
      },
      BusLocationsResponse: {
        type: 'object',
        required: ['dataMode', 'notice', 'routeId', 'checkedAt', 'staleAfterSeconds', 'buses'],
        properties: {
          dataMode: { type: 'string', enum: ['simulated'] },
          notice: { type: 'string' },
          routeId: { type: 'string' },
          checkedAt: { type: 'string', format: 'date-time', description: 'UTC time when freshness was evaluated.' },
          staleAfterSeconds: { type: 'integer', enum: [120] },
          buses: { type: 'array', items: { $ref: '#/components/schemas/BusLocation' } },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' } },
      },
      Stop: {
        type: 'object',
        required: ['id', 'name', 'latitude', 'longitude'],
        properties: {
          id: { type: 'string', example: 'mirpur-10' },
          name: { type: 'string', example: 'Mirpur 10' },
          latitude: { type: 'number', minimum: -90, maximum: 90, example: 23.8069 },
          longitude: { type: 'number', minimum: -180, maximum: 180, example: 90.3687 },
        },
      },
      Route: {
        type: 'object',
        required: ['id', 'name', 'stops'],
        properties: {
          id: { type: 'string', example: 'demo-mirpur-farmgate' },
          name: { type: 'string', example: 'Mirpur 10 to Farmgate (demo)' },
          stops: {
            type: 'array',
            description: 'Stops ordered from the start to the end of the route.',
            items: { $ref: '#/components/schemas/Stop' },
          },
        },
      },
      RoutesResponse: {
        type: 'object',
        required: ['dataMode', 'notice', 'routes'],
        properties: {
          dataMode: { type: 'string', enum: ['simulated'] },
          notice: { type: 'string' },
          routes: { type: 'array', items: { $ref: '#/components/schemas/Route' } },
        },
      },
    },
  },
};
