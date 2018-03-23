'use strict';

module.exports = {
  Route: require('./Route'),
  RouteBuilder: require('./RouteBuilder'),
  RouteRegistry: require('./RouteRegistry'),
  RouteCollection: require('./RouteCollection'),
  Controller: require('./Controller'),

  ControllerCompilerPass: require('../DependencyInjection/CompilerPass/ControllerCompilerPass'),
};
