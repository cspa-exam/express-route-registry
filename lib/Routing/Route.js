'use strict';

const pathToRegexp = require('path-to-regexp');
const RouteRegistryError = require('./RouteRegistryError');
const { HTTP_METHODS } = require('./constants');

/**
 * An encapsulation of an HTTP route, to make registering, testing, and moving routes around easier.
 *
 * Creating a Route:
 *
 *   Route.get('/my/:route').to((req, res, next) => res.send('hi!'));
 *
 * Creating a Route to a Controller action:
 *
 *   Route.get('/other').to(ActionController, 'controller_method_name');
 *
 * Creating a Route with inline Middleware:
 *
 *   Route.get('/some_other').with(Middleware1, Middleware2).to( ... );
 *
 * Creating a Route with a parameter converter:
 *
 *   Route.get('/foo/:id(\\d+)').param('id', (req, res, next, id) => { ... }).to( ... );
 *
 *
 * Adding Route to Route Registry:
 *
 *   registry.add(route);
 *
 *
 * Registering a Route to Express:
 *
 *   route.register(express_router);
 *
 *   // -- OR --
 *
 *   registry.registerAll(express_router);
 *
 *
 * Using a Route to generate a Path with parameters:
 *
 *   const route = RouteBuilder.get('/foo/:id/bar').to( ... );
 *   route.generate({ id: 5 });  // Returns "/foo/5/bar"
 *
 *
 * Using the RouteRegistry to generate path
 *
 *   registry.generate('route_name', { id: 5 });   // Returns "/foo/5/bar" (more details to read in RouteRegistry)
 */
class Route {
  constructor(route_pattern, options = {}) {
    if (typeof route_pattern !== 'string') {
      throw new RouteRegistryError('route_pattern_invalid', 'Route pattern must be string.');
    }
    this.pattern = route_pattern;

    this.action = options.action || (function defaultAction(req, res, next) { res.status(500).send('Under construction.') });
    this.methods = options.methods || [ 'get' ];
    this.controller = options.controller || null;
    this.controller_service_id = options.controller_service_id || null;
    this.controller_action = options.controller_action || null;

    this.middleware = options.middleware || [];
    this.parameter_converters = options.parameter_converters || [];
    this.error_handlers = options.error_handlers || [];

    this.name = options.name;
    this.priority = options.priority || 0;

    this.compiled_route = null;
    this.canonical_route_path = null;

    this.compile();
  }

  validate() {
    if (!this.name) {
      throw new RouteRegistryError('route_missing_name', 'No name generated for route!');
    }
    const exception_prefix = `Exception on route: "${this.name}";`;

    this.methods.forEach(method => {
      if (!HTTP_METHODS.includes(method)) {
        throw new RouteRegistryError(
          'route_invalid_http_method',
          `${exception_prefix} Invalid method specified; must be one of: (get, post, put, patch, delete).`
        );
      }
    });

    if (this.priority) {
      if (typeof this.priority !== 'number') {
        throw new RouteRegistryError('route_invalid_priority', `${exception_prefix} Invalid route priority specified.`);
      }
    }

    //
    // Validate the controller and action
    //
    if (this.controller) {
      if (typeof this.controller !== 'object') {
        throw new RouteRegistryError('route_invalid_controller', `${exception_prefix} Invalid controller specified.`);
      }
      if (typeof this.action !== 'string') {
        throw new RouteRegistryError('route_invalid_action_string', `${exception_prefix} Controller action must be a string.`);
      }
      if (typeof this.controller[this.action] !== 'function') {
        throw new RouteRegistryError('route_action_not_callable', `${exception_prefix} Controller action is not callable.`);
      }
      if (this.controller[this.action].length !== 3) {
        throw new RouteRegistryError(
          'route_controller_action_incorrect_argument_count',
          `${exception_prefix} Controller action definition accepts wrong number of arguments: Must be 3 (req, res, next).`
        );
      }
    } else {
      if (typeof this.action !== 'function') {
        throw new RouteRegistryError('route_invalid_function_action', `${exception_prefix} Invalid action specified.`);
      }
      if (this.action.length !== 3) {
        throw new RouteRegistryError(
          'route_function_action_incorrect_argument_count',
          `${exception_prefix} Action definition accepts wrong number of arguments: Must be 3 (req, res, next).`
        );
      }
    }

    //
    // Validate the middleware
    //   It needs to be an array of functions with 3 arguments; (req, res, next)
    //

    if (!Array.isArray(this.middleware)) {
      throw new RouteRegistryError('route_middleware_not_array', `${exception_prefix} Middleware is not an array.`);
    }

    this.middleware.forEach((_middleware, _index) => {
      if (typeof _middleware !== 'function') {
        throw new RouteRegistryError('route_invalid_middleware', `${exception_prefix} Middleware at index ${_index} is invalid.`);
      }
      if (_middleware.length !== 3) {
        throw new RouteRegistryError(
          'route_middleware_incorrect_argument_count',
          `${exception_prefix} Middleware at index ${_index} accepts the wrong number of arguments; must be 3 (req, res, next).`
        );
      }
    });

    //
    // Validate the parameter converters
    //

    // Parameter converters needs to be an array of objects with keys id + parameter_converter
    if (!Array.isArray(this.parameter_converters)) {
      throw new RouteRegistryError('route_parameter_converter_not_array', `${exception_prefix} Parameter Converters is not an array.`);
    }

    this.parameter_converters.forEach((_parameter_converter, _index) => {
      if (typeof _parameter_converter === 'object') {
        if (!('id' in _parameter_converter) || !('parameter_converter' in _parameter_converter)) {
          throw new RouteRegistryError(
            'route_invalid_parameter_converter',
            `${exception_prefix} Parameter converter at ${_index} is invalid.`
          );
        }

        const id = _parameter_converter.id;
        const func = _parameter_converter.parameter_converter;
        if (typeof id !== 'string') {
          throw new RouteRegistryError(
            'route_invalid_parameter_converter_id',
            `${exception_prefix} Parameter converter at ${_index} is invalid.`
          );
        }
        if (typeof func !== 'function') {
          throw new RouteRegistryError(
            'route_invalid_parameter_converter_function',
            `${exception_prefix} Parameter converter at ${_index} is invalid.`
          );
        }
        if (func.length !== 4) {
          throw new RouteRegistryError(
            'route_invalid_parameter_converter_argument_count',
            `${exception_prefix} Parameter converter at ${_index} accepts the wrong number of arguments; Must be 4 (req, res, next, id).`
          );
        }
      }
      else {
        throw new RouteRegistryError(
          'route_invalid_parameter_converter_unknown',
          `${exception_prefix} Parameter converter at ${_index} is invalid.`
        );
      }
    });

    //
    // Validate your error handlers
    //   It needs to be an array of functions with 4 arguments, (err, req, res, next)
    //
    if (!Array.isArray(this.error_handlers)) {
      throw new RouteRegistryError('error_handlers_not_array', `${exception_prefix} Error Handlers is not an array.`);
    }

    this.error_handlers.forEach((_error_handler, _index) => {
      if (typeof _error_handler !== 'function') {
        throw new RouteRegistryError('route_invalid_error_handler', `${exception_prefix} Error Handler at index ${_index} is invalid.`);
      }
      if (_error_handler.length !== 4) {
        throw new RouteRegistryError(
          'route_error_handler_incorrect_argument_count',
          `${exception_prefix} Error Handler at index ${_index} accepts the wrong number of arguments; Must be 4 (err, req, res, next).`
        );
      }
    });
  }

  register(express_router) {
    const action = this.getRouteDestination();

    // Annoying, but parameter converters are global to the whole application/current router. In order to prevent
    // the parameter converter from bleeding into a higher-level router context, we need to create a sub-router
    // Similarly, error handlers are global to the current router.
    if (this.parameter_converters.length > 0 || this.error_handlers.length > 0) {
      // FIXME (derek) Hack; this inline express dependency messes up my original intention to make this
      // class not depend on express at all (and thus be OK to use on the React app). How to fix this?
      const sub_router = require('express').Router();
      this.parameter_converters.forEach(c => {
        sub_router.param(c.id, c.parameter_converter);
      });

      this.methods.forEach(method => {
        sub_router[method](this.pattern, ...this.middleware, action);
      });

      this.error_handlers.forEach(error_handler => {
        sub_router.use(error_handler);
      });

      express_router.use(sub_router);
    }

    // While we do not use a sub-router here, it is unlikely that middleware will bleed into unintended places
    // since the matched route pattern is final
    else {
      this.methods.forEach(method => {
        express_router[method](this.pattern, ...this.middleware, action);
      });
    }
  }

  /**
   * Generates the URL
   *
   * @param parameters
   */
  generate(parameters) {
    return this.compiled_route(parameters); // This will raise exceptions if it's missing parameters
  }

  getPattern() {
    return this.pattern;
  }

  setPattern(pattern) {
    this.pattern = pattern;
    this.compiled_route = null;
    this.canonical_route_path = null;

    this.compile();

    return this;
  }

  setPriority(priority) {
    this.priority = priority;
    this.validate();
    return this;
  }

  getPriority() {
    return this.priority;
  }

  getName() {
    return this.name;
  }

  getMethods() {
    return this.methods;
  }

  getCanonicalRoutePath() {
    return this.canonical_route_path;
  }

  setMiddleware(middleware) {
    this.middleware = middleware;
    this.validate();
    return this;
  }

  getMiddleware() {
    return this.middleware;
  }

  getErrorHandlers() {
    return this.error_handlers;
  }

  setErrorHandlers(error_handlers) {
    this.error_handlers = error_handlers;
    this.validate();
    return this;
  }

  getRouteDestination() {
    if (this.controller && this.controller.constructor && this.action) {
      // Bind 'this' to the controller to prevent problems later on
      return this.controller[this.action].bind(this.controller);
    } else if (typeof this.action === 'function') {
      return this.action;
    }
  }

  setParameterConverters(parameter_converters) {
    this.parameter_converters = parameter_converters;
    this.validate();
    return this;
  }

  getParameterConverters() {
    return this.parameter_converters;
  }

  isMatch(route) {
    // FIXME (derek) I *think* this is how it works but I'm not 100% clear
    return null !== pathToRegexp(this.pattern).exec(route);
  }

  compile() {
    if (this.compiled_route !== null) {
      return this.compiled_route;
    }

    // Chew up the URL's structural pattern so we can make sense of it and do cool stuff with it later
    // https://www.npmjs.com/package/path-to-regexp
    this.compiled_route = pathToRegexp.compile(this.pattern);
    this.canonical_route_path = this._generateCanonicalRoutePath();
    this.name = this.name || this._generateName();

    this.validate();
  }

  _generateCanonicalRoutePath() {
    const parts = pathToRegexp.parse(this.pattern);
    return parts.map(_part => {
      if (typeof _part === 'string') {
        return _part;
      } else {
        return `${_part.prefix}:${_part.name}`;
      }
    }).join('');
  }

  _generateName() {
    // If we do not have a name, we can make one up depending on the controller it came from or

    // If this route resolves to a controller + action (string), then we do this;
    if (this.controller && this.controller.constructor && this.action) {
      const controller_part = this.controller.constructor.name.toLowerCase();
      const action_part = this.action.toLowerCase();
      return `${controller_part}_${action_part}`;
    }

    // If it only has an action (a function), and the function is named, then we do this;
    else if (typeof this.action === 'function' && this.action.name) {
      return `${this.action.name.toLowerCase()}`;
    }

    // If the action provided is an anonymous function...
    // Otherwise I guess we can figure it out from the route parameters
    // it is generally undesirable to use this route name as it can subtly change when the URL path changes,
    // as opposed to the others. The BEST thing to do is be explicit about route names.
    else {
      const tokens = pathToRegexp.parse(this.pattern);
      const bits = [ this.methods.join('|') ];
      tokens.forEach(_token => {
        if (typeof _token === 'string') {
          // strip out slashes /
          // the g is necessary to replace all instances
          bits.push(_token.replace(/\//g, ''));
        } else {
          bits.push(_token.name);
        }
      });
      return bits.join('_');
    }
  }
}

module.exports = Route;
