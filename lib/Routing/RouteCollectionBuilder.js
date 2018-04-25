'use strict';

const RouteCollection = require('./RouteCollection');
const RouteBuilder = require('./RouteBuilder');
const RouteRegistryError = require('./RouteRegistryError');

class RouteCollectionBuilder {
  constructor(configuration, container) {
    this.configuration = configuration;
    this.traits = [];
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

  _recursiveRouteBuilder(configuration, root_collection, prefix = '') {
    const this_collection = new RouteCollection();

    // First, add all of the routes to this collection
    ['get', 'post', 'delete', 'put', 'patch'].forEach(method => {
      if (method in configuration) {
        const route_destination = configuration[method];
        const route_builder = RouteBuilder[method](''); // FIXME (derek) we probably do not need the RouteBuilder anymore

        const route = (() => {
          // Type 1: Simple. We just specify a controller function with (req, res, next) as args.
          if ('function' === typeof route_destination) {
            return route_builder.toAction(route_destination);
          }

          // Type 2: It's an array with 2 elements.
          else if (Array.isArray(route_destination)) {
            if ('string' === typeof route_destination[0]) {
              if (!this.hasContainer()) {
                throw new RouteRegistryError('route_registry_container_missing_array', 'Container not yet initialized.');
              }
              const service = this.container.get(route_destination[0]);
              return route_builder.toServiceAction(service, route_destination[1], route_destination[0]);
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
              if (!this.hasContainer()) {
                throw new RouteRegistryError('route_registry_container_missing_id', 'Container not yet initialized.');
              }
              const service = this.container.get(route_destination.service_id);
              return route_builder.toServiceAction(service, route_destination.action, route_destination.service_id);
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

    // Next, recursively construct and add all sub-collections
    // This is done BEFORE middleware/parameter converters are set so that the sub-routes can properly
    // inherit middleware.
    Object.keys(configuration).forEach(_key => {
      if (_key.startsWith('/')) {
        const next_configuration = configuration[_key];
        this._recursiveRouteBuilder(next_configuration, this_collection, _key);
      }
    });

    // We have all the routes registered by this point. Here we begin to add features that are common to
    // or inherited by all routes in and below this current route collection.

    // Route prefix
    this_collection.addPrefix(prefix);

    // Middleware
    if ('middleware' in configuration) {
      // Middleware has to be PREPENDED, because middleware that is higher up no the recursion chain is fired FIRST,
      // with middleware that is more specific to each individual route being fired LAST (because such middleware may
      // depend on generalized contexts set up by the upper-level middleware.
      if (Array.isArray(configuration.middleware)) {
        this_collection.prependAllMiddleware(configuration.middleware);
      } else {
        this_collection.prependMiddleware(configuration.middleware);
      }
    }

    // Parameter converters
    if ('param' in configuration) {
      /**
       * Helper function
       */
      const addParameterConverter = (param, collection) => {
        // Case 1; it's [ id, func ]
        if (Array.isArray(param)
          && typeof param[0] === 'string'
          && typeof param[1] === 'function') {
          const id = param[0];
          const parameter_converter = param[1];
          collection.addParameterConverter(id, parameter_converter);
        }
        // Case 2; it's { id, parameter_converter }
        else if ((typeof param === 'object') && ('id' in param) && ('parameter_converter' in param)) {
          collection.addParameterConverter(param.id, param.parameter_converter);
        }
        else {
          throw new RouteRegistryError('route_registry_invalid_configuration', 'Invalid configuration.');
        }
      };

      const param = configuration.param;
      // param can either be a single parameter converter or an array of them
      if (Array.isArray(param) && !(typeof param[0] === 'string' && typeof param[1] === 'function')) {
        param.forEach(_param => addParameterConverter(_param, this_collection));
      } else {
        addParameterConverter(param, this_collection);
      }
    }

    // Error handlers
    if ('error' in configuration) {
      const error = configuration.error;
      // error can either be a single error handler or an array of them
      // Error handlers are fired in the OPPOSITE order of middleware. Bottom-level route-specific error handlers
      // should be fired first as specific routes may opt to override the more general top-level error handling.
      if (Array.isArray(error)) {
        this_collection.addAllErrorHandlers(error);
      } else {
        this_collection.addErrorHandler(error);
      }
    }

    // Great, we're done constructing this route collection; append it to the parent
    root_collection.addCollection(this_collection);
  }
}
module.exports = RouteCollectionBuilder;
