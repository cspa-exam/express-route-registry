'use strict';

const Controller = require('../../Routing/Controller');

const { CompilerPass, ServiceReference } = require('service-container');

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
