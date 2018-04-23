'use strict';

const { ServiceContainer } = require('service-container');
const { RouteRegistry } = require('express-route-registry');

const service_container = new ServiceContainer();

const registry = new RouteRegistry();
registry.setContainer(service_container);


module.exports = registry;
