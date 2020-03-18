'use strict';

const Route = require('./Route');

class RouteBuilder {
  constructor() {
    this.pattern = null;

    // Defaults
    this.opts = {
      name: null,
      method: null,
      action: null,
      controller: null,
      middleware: [],
      parameter_converters: [],
    };
  }

  static get(route_pattern, opts = {}) {
    return RouteBuilder.start('get', route_pattern, opts);
  }

  static post(route_pattern, opts = {}) {
    return RouteBuilder.start('post', route_pattern, opts);
  }

  static delete(route_pattern, opts = {}) {
    return RouteBuilder.start('delete', route_pattern, opts);
  }

  static put(route_pattern, opts = {}) {
    return RouteBuilder.start('put', route_pattern, opts);
  }

  static patch(route_pattern, opts = {}) {
    return RouteBuilder.start('patch', route_pattern, opts);
  }

  static options(route_pattern, opts = {}) {
    return RouteBuilder.start('options', route_pattern, opts);
  }

  static head(route_pattern, opts = {}) {
    return RouteBuilder.start('head', route_pattern, opts);
  }

  static start(method, route_pattern, opts = {}) {
    const r = new RouteBuilder();
    r.pattern = route_pattern;
    r.opts.methods = [ method ];
    Object.assign(r.opts, opts);
    return r;
  }

  named(name) {
    this.opts.name = name;
    return this;
  }

  param(id, parameter_converter) {
    this.opts.parameter_converters.push({ id, parameter_converter });
    return this;
  }

  with() {
    this.opts.middleware = (this.opts.middleware || []).concat(Array.from(arguments));
    return this;
  }

  priority(priority) {
    this.opts.priority = priority;
    return this;
  }

  toAction(action) {
    this.opts.action = action;
    return this.build();
  }

  toControllerAction(controller, method_string) {
    this.opts.controller = controller;
    this.opts.action = method_string;
    return this.build();
  }

  toServiceAction(service, method_string, service_id) {
    this.opts.controller = service;
    this.opts.action = method_string;
    this.opts.controller_service_id = service_id;
    return this.build();
  }

  to() {
    if (arguments.length >= 2) {
      this.opts.controller = arguments[0];
      this.opts.action = arguments[1];
    } else {
      this.opts.action = arguments[0];
    }

    return this.build();
  }

  build() {
    return new Route(this.pattern, this.opts);
  }
}

module.exports = RouteBuilder;
