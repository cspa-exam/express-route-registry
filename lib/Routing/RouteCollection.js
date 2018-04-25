'use strict';

class RouteCollection {
  constructor() {
    this.routes = {};
  }

  add(route_name, route) {
    delete this.routes[route_name];
    this.routes[route_name] = route;
  }

  get(route_name) {
    return this.routes[route_name];
  }

  addCollection(route_collection) {
    // we need to remove all routes with the same names first because just replacing them
    // would not place the new route at the end of the merged array
    Object.keys(route_collection.all()).forEach(route_name => {
      this.add(route_name, route_collection.all()[route_name]);
    });
  }

  prependMiddleware(middleware) {
    Object.keys(this.routes).forEach(route_name => {
      const route = this.routes[route_name];
      const next_middleware = route.getMiddleware();
      next_middleware.unshift(middleware);
      route.setMiddleware(next_middleware);
    });
  }

  addMiddleware(middleware) {
    Object.keys(this.routes).forEach(route_name => {
      const route = this.routes[route_name];
      const next_middleware = route.getMiddleware();
      next_middleware.push(middleware);
      route.setMiddleware(next_middleware);
    });
  }

  addAllMiddleware(middlewares) {
    middlewares.forEach(middleware => {
      this.addMiddleware(middleware);
    })
  }

  addErrorHandler(error_handler) {
    Object.keys(this.routes).forEach(route_name => {
      const route = this.routes[route_name];
      const error_handlers = route.getErrorHandlers();
      error_handlers.push(error_handler);
      route.setErrorHandlers(error_handlers);
    });
  }

  addAllErrorHandlers(error_handlers) {
    error_handlers.forEach(error_handler => this.addErrorHandler(error_handler));
  }

  /**
   * Adds the given middleware to all registered routes in the collection in the given order, but also
   * prepends them to any existing middleware on those routes, designating these middleware as strictly
   * higher in priority.
   */
  prependAllMiddleware(middlewares) {
    middlewares.slice().reverse().forEach(middleware => {
      this.prependMiddleware(middleware);
    });
  }

  addParameterConverter(id, parameter_converter) {
    Object.keys(this.routes).forEach(route_name => {
      const route = this.routes[route_name];
      const next_parameter_converters = route.getParameterConverters();
      next_parameter_converters.push({ parameter_converter, id });
      route.setParameterConverters(next_parameter_converters);
    });
  }

  addPrefix(prefix) {
    prefix = prefix.trim();
    prefix = trimStuff(prefix, '/');

    if ('' === prefix) {
      return;
    }

    Object.keys(this.routes).forEach(route_name => {
      const route = this.routes[route_name];

      route.setPattern(`/${prefix}${route.getPattern()}`);
    });

    function trimStuff(s, mask) {
      while (~mask.indexOf(s[0])) {
        s = s.slice(1);
      }
      while (~mask.indexOf(s[s.length - 1])) {
        s = s.slice(0, -1);
      }
      return s;
    }
  }

  all() {
    return this.routes;
  }
}

module.exports = RouteCollection;
