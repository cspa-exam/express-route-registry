'use strict';

function userIdConverter(user_id, req, res, next) {
  if (user_id > 0 && user_id < 10) {
    req.user = {
      user_id,
      username: 'woohoo',
    };
  }
  next(new Error('No user found???'));
}

function testIdConverter(test_id, req, res, next) {

}

module.exports = {
  userIdConverter,
  testIdConverter,
};
