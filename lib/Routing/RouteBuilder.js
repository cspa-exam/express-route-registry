'use strict';

const Route = require('./Route');

class RouteBuilder {
  constructor() {
    this.pattern = null;

    // Defaults
    this.options = {
      name: null,
      method: null,
      action: null,
      controller: null,
      middleware: [],
      parameter_converters: [],
    };
  }

  static get(route_pattern, options = {}) {
    return RouteBuilder.start('get', route_pattern, options);
  }

  static post(route_pattern, options = {}) {
    return RouteBuilder.start('post', route_pattern, options);
  }

  static delete(route_pattern, options = {}) {
    return RouteBuilder.start('delete', route_pattern, options);
  }

  static put(route_pattern, options = {}) {
    return RouteBuilder.start('put', route_pattern, options);
  }

  static patch(route_pattern, options = {}) {
    return RouteBuilder.start('patch', route_pattern, options);
  }

  static start(method, route_pattern, options = {}) {
    const r = new RouteBuilder();
    r.pattern = route_pattern;
    r.options.methods = [ method ];
    Object.assign(r.options, options);
    return r;
  }

  named(name) {
    this.options.name = name;
    return this;
  }

  param(id, parameter_converter) {
    this.options.parameter_converters.push({ id, parameter_converter });
    return this;
  }

  with() {
    this.options.middleware = (this.options.middleware || []).concat(Array.from(arguments));
    return this;
  }

  toAction(action) {
    this.options.action = action;
    return this.build();
  }

  toControllerAction(controller, method_string) {
    this.options.controller = controller;
    this.options.action = method_string;
    return this.build();
  }

  toServiceAction(service, method_string, service_id) {
    this.options.controller = service;
    this.options.action = method_string;
    this.options.controller_service_id = service_id;
    return this.build();
  }

  to() {
    if (arguments.length >= 2) {
      this.options.controller = arguments[0];
      this.options.action = arguments[1];
    } else {
      this.options.action = arguments[0];
    }

    return this.build();
  }

  build() {
    return new Route(this.pattern, this.options);
  }
}

module.exports = RouteBuilder;
