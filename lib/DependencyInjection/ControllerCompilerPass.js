'use strict';

const Controller = require('./Controller');

const { CompilerPass, ServiceReference } = require('../DependencyInjection/ContainerProvider').getAll();

class ControllerCompilerPass extends CompilerPass {
  process(service_container) {
    service_container.findTaggedServiceIds('controller').forEach(id => {
      const definition = service_container.getDefinition(id);
      if (definition.getClass().prototype instanceof Controller) {
        definition.addMethodCall('setContainer', [ new ServiceReference('service_container') ]);
      }
    });
  }
}
module.exports = ControllerCompilerPass;
