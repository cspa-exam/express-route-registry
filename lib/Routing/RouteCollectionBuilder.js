'use strict';

const RouteCollection = require('./RouteCollection');
const RouteBuilder = require('./RouteBuilder');
const RouteRegistryError = require('./RouteRegistryError');
const { HTTP_METHODS } = require('./constants');

class RouteCollectionBuilder {
  constructor(configuration) {
    this.configuration = configuration;
    this.traits = {};
    this.root_collection = null;
    this.container = null;
  }

  setContainer(service_container) {
    this.container = service_container;
  }

  hasContainer() {
    return !!this.container;
  }

  build() {
    this.root_collection = new RouteCollection();
    this._recursiveRouteBuilder(this.configuration, this.root_collection, '');
    return this.root_collection;
  }

  _recursiveRouteBuilder(current_configuration, parent_route_collection, prefix = '') {
    const this_collection = new RouteCollection();

    // Register all traits and resourceTypes
    this._extractTraits(current_configuration);

    // Add all of the routes to this collection
    this._extractRoutes(current_configuration, this_collection);

    // Next, recursively construct and add all sub-collections
    // This is done BEFORE middleware/parameter converters are set so that the sub-routes can properly
    // inherit middleware.
    this._extractSubRoutes(current_configuration, this_collection);

    // We have all the routes registered by this point. Here we begin to add features that are common to
    // or inherited by all routes in and below this current route collection

    // Route prefix
    this_collection.addPrefix(prefix);

    // Priority can only be configured on the route collection level, not an individual route-method level.
    if ('priority' in current_configuration) {
      this_collection.setPriority(current_configuration.priority);
    }

    // Middleware
    this._extractMiddleware(current_configuration, this_collection);

    // Parameter converters
    this._extractParameterConverters(current_configuration, this_collection);

    // Error handlers
    this._extractErrorHandlers(current_configuration, this_collection);

    // Lastly, apply traits when the 'is' node is used. These have lower precedence than explicitly provided
    // "middleware"
    this._extractInheritedTraits(current_configuration, this_collection);

    // Great, we're done constructing this route collection; append it to the parent
    parent_route_collection.addCollection(this_collection);
  }

  /**
   * The configuration of "traits" is a key value mapping from the name of the trait to an assoc array:
   *
   * traits:
   *   middleware: [ ... ]
   *
   * Currently traits only support middleware
   */
  _extractTraits(configuration) {
    const is_root_configuration = configuration === this.configuration;

    if ('traits' in configuration) {
      // traits is only valid at the root.
      if (!is_root_configuration) {
        throw new RouteRegistryError('invalid_usage_of_trait_node', 'The "traits" node is only valid at the root of the configuration');
      }

      Object.keys(configuration.traits).forEach(trait_name => {
        const trait_configuration = configuration.traits[trait_name];
        this.traits[trait_name] = {
          middleware: trait_configuration.middleware,
          error: trait_configuration.error,
        }
      });
    }
  }

  /**
   * The configuration of routes has a key of "get", "post", "delete", "put", or "patch"
   *
   * These configuration nodes are designed to setup express route actions. Route actions are functions with 3
   * arguments: (req, res, next). This is expressJS nomenclature.
   *
   * The node can have the following values
   *
   * 1) No keys: just a function
   *
   *    In this case, the registry assumes the provided function _*is*_ the express action. The function is passed
   *    as-is to expressJS.
   *
   * 2) An object with keys "action" (optional: "name" and "middleware")
   *
   *    In this case, it supplies additional information to the registry. The "name" overrides the automatic route
   *    name, and "action" should be the function that is the express action. "middleware" is expressJS middleware
   *    that is applied to specifically this route.
   *
   * 3) An object with keys "controller" and "action" (optional: "name" and "middleware")
   *
   *    "controller" refers to an INSTANCE of a controller. "action" is the name of the method on this instance
   *    that pertains to an express action.
   *
   * 4) An array with 2 elements; an object (1st) and a string (2nd) and an optional string (3rd, optional)
   *
   *    This structure has an instance of a controller object as the first argument. The 2nd argument is the string
   *    method name that pertains to the express action. The third argument is the route name, and is optional
   *    This is a simplified syntax to #3.
   *
   *    In this mode you cannot add additional info such as name or middleware.
   *
   * 5) An array with 2 elements; both strings
   *
   *    This structure uses the service-container.
   *
   *    The first string pertains to the service id of a controller service. The second string is the method name
   *    on the controller service that pertains to the express action. This mode is effectively a simplified syntax
   *    of #6.
   *
   *    In this mode you cannot add additional info such as name or middleware.
   *
   * 6) An object with keys "service_id" and "action" (optional: "name" and "middleware")
   *
   *    This structure uses the service-container.
   *
   *    The "service_id" is the service-container service id of a controller service. The "action" is the method
   *    name on the controller.
   *
   *
   */
  _extractRoutes(current_configuration, this_collection) {
    HTTP_METHODS.forEach(method => {
      if (method in current_configuration) {
        const route_destination = current_configuration[method];
        const route_builder = RouteBuilder[method](''); // FIXME (derek) we probably do not need the RouteBuilder anymore

        const route = (() => {
          // Type 1: Simple. We just specify a controller function with (req, res, next) as args.
          if ('function' === typeof route_destination) {
            return route_builder.toAction(route_destination);
          }

          // Type 2: It's an array with 2 or 3 elements.
          else if (Array.isArray(route_destination)) {
            if (route_destination[2]) {
              route_builder.named(route_destination[2]);
            }
            if ('string' === typeof route_destination[0]) {
              const service_id = this._normalizeServiceId(route_destination[0]);
              const service = this._getService(service_id);
              return route_builder.toServiceAction(service, route_destination[1], service_id);
            } else {
              return route_builder.toControllerAction(route_destination[0], route_destination[1]);
            }
          }

          // Type 3: It's a configuration object with keys
          else if ('object' === typeof route_destination) {
            if ('name' in route_destination) {
              route_builder.named(route_destination.name);
            }
            if ('middleware' in route_destination) {
              route_builder.with(route_destination.middleware);
            }

            if ('service_id' in route_destination) {
              const service_id = this._normalizeServiceId(route_destination.service_id);
              const service = this._getService(service_id);
              return route_builder.toServiceAction(service, route_destination.action, service_id);
            }
            else if ('controller' in route_destination) {
              return route_builder.toControllerAction(route_destination.controller, route_destination.action);
            } else {
              return route_builder.toAction(route_destination.action);
            }
          }

          // Else we don't know what it is
          else {
            throw new RouteRegistryError('route_registry_invalid_action', 'Invalid action specified.');
          }
        })();

        this_collection.add(route.getName(), route);
      }
    });
  }

  _normalizeServiceId(service_id) {
    if (service_id.startsWith('@')) {
      return service_id.substring(1);
    }
    return service_id;
  }

  _getService(service_id) {
    if (!this.hasContainer()) {
      throw new RouteRegistryError('route_registry_container_missing_array', 'Container not yet initialized.');
    }
    return this.container.get(service_id);
  }

  _standardizeMiddleware(middleware) {
    if (typeof middleware === 'string') {
      if (middleware.startsWith('@')) {
        return this._getService(this._normalizeServiceId(middleware));
      }
    }
    return middleware;
  }

  _standardizeErrorHandler(error) {
    if (typeof error === 'string') {
      if (error.startsWith('@')) {
        return this._getService(this._normalizeServiceId(error));
      }
    }
    return error;
  }

  /**
   * Sub routes exist under the existing route. All middleware, parameter converters, error handlers and traits
   * for the parent route are also inherited by the children sub routes.
   *
   * The inheritance order is a little tricky, be careful:
   *
   * 1) middleware inherited from top-level to bottom-level; Parent middleware is fired first
   * 2) parameter converters are "inherited" from bottom-to-top, but generally should not overlap.
   * 3) error handlers are inherited from bottom-level to top-level; Children error handlers are reached first
   *
   * It is also worth noting the firing order:
   *
   * 1) Parameter converters are always fired BEFORE middleware of the same layer. This is enforced by express's
   *    implementation of .param() and the way sub routers are implemented
   * 2) Middleware is fired in the order they are inherited (see above). All middleware should call next() to
   *    properly forward the request to the next in the middleware chain.
   * 2) Error handlers are fired in the opposite order of middleware. Generally, error handlers do not forward the
   *    errors to each other, but if you do, you MUST call next(error).
   */
  _extractSubRoutes(current_configuration, this_collection) {
    Object.keys(current_configuration).forEach(_key => {
      if (_key.startsWith('/')) {
        const next_configuration = current_configuration[_key];

        if (Array.isArray(next_configuration)) {
          next_configuration.forEach(_next_configuration_collection => {
            this._recursiveRouteBuilder(_next_configuration_collection, this_collection, _key);
          });
        } else {
          this._recursiveRouteBuilder(next_configuration, this_collection, _key);
        }
      }
    });
  }

  /**
   * Middleware are functions that accept exactly 3 arguments: (req, res, next).
   *
   * All middleware SHOULD do one of the following:
   *
   * 1) Call next() when finished
   * 2) Throw an exception upon error
   * 3) Alternatively; call next(error) upon error
   *
   * Middleware CAN do any of these:
   *
   * 1) Modify the request (e.g. req.user = ... )
   * 2) Modify the response (e.g. res.context = ... )
   * 3) Add headers (e.g. res.header(...) )
   * 4) Read from the database or other stores
   * 5) Do anything a parameter converter could otherwise do
   *
   * Middleware SHOULD GENERALLY AVOID:
   *
   * 1) Calling res.status()
   * 2) Use res.send() to send a response
   * 3) Anything else a controller action or error handler is SUPPOSED to do
   *
   */
  _extractMiddleware(current_configuration, this_collection) {
    if ('middleware' in current_configuration) {
      // Middleware has to be PREPENDED, because middleware that is higher up no the recursion chain is fired FIRST,
      // with middleware that is more specific to each individual route being fired LAST (because such middleware may
      // depend on generalized contexts set up by the upper-level middleware.
      if (Array.isArray(current_configuration.middleware)) {
        const middlewares = current_configuration.middleware.map(this._standardizeMiddleware.bind(this));
        this_collection.prependAllMiddleware(middlewares);
      } else {
        this_collection.prependMiddleware(
          this._standardizeMiddleware(current_configuration.middleware)
        );
      }
    }
  }

  /**
   * https://expressjs.com/en/api.html#app.param
   *
   * Parameter converters take a request parameter and do stuff with it. They are similar to middleware, but
   * they only fire when a URL observes a particular named parameter. They accept 4 arguments: (id, req, res, next).
   *
   * Parameter converters can have any of the following configurations:
   *
   * 1) Array; [ string , function ]
   *
   * 2) Object with keys: "id" and "parameter_converter". The value at "id" is a string and "parameter_converter" is a function.
   *
   * 3) Array of arrays; [ string, function ]
   *
   * 4) Array of objects with keys: "id" and "parameter_converter"
   *
   *
   * In all of the above cases, the string is the name of the parameter. For example, a configuration with
   * "user_id" as the string would trigger off of a route of "/user/:user_id" but not "/book/:book_id".
   *
   * The function is called when the parameter is encountered. In general, the function should be similar to
   * responsibility to middleware. The recommended behavior of the function is to take the associated id value and
   * deserialize it (and/or query from a database or whatever) and save it into the request (e.g. req.user = ... ).
   */
  _extractParameterConverters(current_configuration, this_collection) {
    if ('param' in current_configuration) {
      /**
       * Helper function
       */
      const addParameterConverter = (param, collection) => {

        // Case 1; it's Array syntax; [ id, func ] or [ id, service_id ]
        if (Array.isArray(param) && (param.length === 2) && (typeof param[0] === 'string')) {
          // 1.1 id,func
          if (typeof param[1] === 'function') {
            const id = param[0];
            const parameter_converter = param[1];
            collection.addParameterConverter(id, parameter_converter);
            return;
          }

          // 1.2 id,service_id
          else if (typeof param[1] === 'string' && param[1].startsWith('@')) {
            const id = param[0];
            const service_id = this._normalizeServiceId(param[1]);
            const parameter_converter = this._getService(service_id);
            collection.addParameterConverter(id, parameter_converter);
            return;
          }

          // Otherwise fall thru and error
        }

        // Case 2; it's { id, parameter_converter
        else if (typeof param === 'object'
          && ('id' in param)
          && ('parameter_converter' in param)
          && typeof param.id === 'string') {
          // 2.1 parameter_converter is a func
          if (typeof param.parameter_converter === 'function') {
            collection.addParameterConverter(param.id, param.parameter_converter);
            return;
          }

          // 2.2 parameter_converter is a service_id
          else if (typeof param.parameter_converter === 'string' && param.parameter_converter.startsWith('@')) {
            const service = this._getService(this._normalizeServiceId(param.parameter_converter));
            collection.addParameterConverter(param.id, service);
            return;
          }

          // Fall thru and error
        }

        // Broken
        throw new RouteRegistryError('route_registry_invalid_configuration', 'Invalid configuration.');
      };


      const param = current_configuration.param;
      // param can either be an array of parameter converters
      if (Array.isArray(param)) {

        // [ id, func ] or [ id, service ]
        if (param.every(item => {
          return Array.isArray(item) && item.length === 2;
          })) {
          param.forEach(_param => addParameterConverter(_param, this_collection));
          return;
        }

        // { id, parameter_converter }
        else if (param.every(item => {
          return typeof item === 'object' && ('id' in item) && ('parameter_converter' in item);
          })) {
          param.forEach(_param => addParameterConverter(_param, this_collection));
          return;
        }

      }
      // Or a single one
      addParameterConverter(param, this_collection);
    }
  }

  /**
   * https://expressjs.com/en/guide/error-handling.html
   *
   * Error handlers are similar in structure to middleware, but they accept 4 arguments: (err, req, res, next).
   * Error handlers also do not automatically "bubble" with next(). You must call next(error) or re-throw the error
   * to bubble.
   *
   * This is generally where you can configure functionality to do logging or render a default error page.
   */
  _extractErrorHandlers(current_configuration, this_collection) {
    if ('error' in current_configuration) {
      const error = current_configuration.error;
      // error can either be a single error handler or an array of them
      // Error handlers are fired in the OPPOSITE order of middleware. Bottom-level route-specific error handlers
      // should be fired first as specific routes may opt to override the more general top-level error handling.
      if (Array.isArray(error)) {
        const errors = error.map(this._standardizeErrorHandler.bind(this));
        this_collection.addAllErrorHandlers(errors);
      } else {
        this_collection.addErrorHandler(
          this._standardizeErrorHandler(error)
        );
      }
    }
  }

  /**
   * The traits that were registered globally can be inherited using the "is" node.
   *
   * This node is simply an array of strings that match the trait names. All middleware defined in the traits
   * will be inherited for this configuration.
   *
   * Notably, explicitly defined middleware/errors at the same configuration level are evaluated first, before
   * traits.
   */
  _extractInheritedTraits(current_configuration, this_collection) {
    if ('is' in current_configuration) {
      const trait_names = current_configuration.is;
      trait_names.forEach(trait_name => {
        if (!(trait_name in this.traits)) {
          throw new RouteRegistryError('invalid_trait_requested', `There is no such trait registered: ${trait_name}.`);
        }
        const trait = this.traits[trait_name];

        // Register middleware
        const trait_middleware = trait.middleware;
        if (trait_middleware) {
          if (Array.isArray(trait_middleware)) {
            const middlewares = trait_middleware.map(this._standardizeMiddleware.bind(this));
            this_collection.prependAllMiddleware(middlewares);
          } else {
            this_collection.prependMiddleware(
              this._standardizeMiddleware(trait_middleware)
            );
          }
        }

        const trait_error_handlers = trait.error;
        if (trait_error_handlers) {
          if (Array.isArray(trait_error_handlers)) {
            const errors = trait_error_handlers.map(this._standardizeErrorHandler.bind(this));
            this_collection.addAllErrorHandlers(errors)
          } else {
            this_collection.addErrorHandler(
              this._standardizeErrorHandler(trait_error_handlers)
            );
          }
        }
      });
    }
  }
}
module.exports = RouteCollectionBuilder;
