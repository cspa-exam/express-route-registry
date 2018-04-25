'use strict';

//
// Runs on port 8282.
//

const container = require('./container');

container.get('express.server').start();
