'use strict';

const routeregistry = {
  // Default exports
  Route: require('./Route'),
  RouteBuilder: require('./RouteBuilder'),
  RouteRegistry: require('./RouteRegistry'),
  RouteCollection: require('./RouteCollection'),
  JsonLoader: require('../Loader/JsonLoader'),
};

// Conditional exports made only available when useContainer is called
routeregistry.useContainer = service_container => {
  const container_provider = require('../DependencyInjection/ContainerProvider');
  container_provider.use(service_container);

  routeregistry.Controller = require('../DependencyInjection/Controller');
  routeregistry.ControllerCompilerPass = require('../DependencyInjection/ControllerCompilerPass');
};


module.exports = routeregistry;
