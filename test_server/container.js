'use strict';

require('../index.js').useContainer(require('service-container'));

const { ServiceContainer } = require('service-container');
const container = new ServiceContainer();

require('./controller_services')(container);

container.compile();

module.exports = container;
