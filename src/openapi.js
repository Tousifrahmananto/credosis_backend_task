import { routes } from './routes.js';

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Dhaka Bus Tracker API',
    version: '0.1.0',
    description: 'Credosis backend demo, step 1: discover a fictional route and its ordered stops. All service data is simulated; coordinates are approximate. No live tracking, GPS updates or authentication is implemented yet.',
  },
  servers: [{ url: '/' }],
  paths: {
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
    schemas: {
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
