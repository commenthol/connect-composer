'use strict'

var compose = require('..')

// stack middlewares
;(function () {
  var req = { test: [] }
  var res = {}
  var middlewares1 = [
    function (req, res, next) { req.test.push('one'); next() },
    function (req, res, next) { req.test.push('two'); next() }
  ]
  var middlewares2 = [
    function (req, res, next) { req.test.push('three'); next() },
    function (req, res, next) { req.test.push('four'); next() }
  ]
  // create a new middleware
  var newMiddlewares = compose(middlewares1, middlewares2)
  // run new composed middleware
  newMiddlewares(req, res, function () {
    console.log(1, req.test) // < [ 'one', 'two', 'three', 'four' ]
  })
})()

// stack composed middlewares
;(function () {
  var req = { test: [] }
  var res = {}
  // pass as Array
  var middlewares1 = compose([
    function (req, res, next) { req.test.push('one'); next() },
    function (req, res, next) { req.test.push('two'); next() }
  ])
  // or by Argument
  var newMiddlewares = compose(
    middlewares1,
    function (req, res, next) { req.test.push('three'); next() },
    function (req, res, next) { req.test.push('four'); next() }
  )
  // run new composed middleware
  newMiddlewares(req, res, function () {
    console.log(2, req.test) // < [ 'one', 'two', 'three', 'four' ]
  })
})()

// trap errors
;(function () {
  var req = { test: [] }
  var res = {}
  var middlewares = compose(
    function (req, res, next) { req.test.push('one'); next() },
    function (req, res, next) {
      next('badly') // middleware calls `next` with error parameter
    },
    function (req, res, next) {
      req.test.push('two') // is never called
      next()
    },
    function (err, req, res, next) { // error is trapped here; function has arity 4
      console.log(3, err + ' trapped') // < badly trapped
      next() // continue with the processing
    },
    function (req, res, next) { req.test.push('three'); next() },
    function (req, res, next) {
      // eslint-disable-next-line
      if (1) throw new Error('another error') // middleware calls `next` with error parameter
      next()
    },
    function (req, res, next) {
      req.test.push('four') // is never called
      next()
    }
  )
  // run new composed middleware
  middlewares(req, res, function (err) {
    console.log(3, err) // < [Error: another error]
    console.log(3, req.test) // < [ 'one', 'three' ]
  })
})()

// use named middlewares to change middleware stack
;(function () {
  var res = {}
  var initial = {
    two: function (req, res, next) { req.test.push('two'); next() },
    four: function (req, res, next) { req.test.push('four'); next() }
  }
  var others = {
    one: function one (req, res, next) { req.test.push('one'); next() },
    three: function three (req, res, next) { req.test.push('three'); next() },
    five: function othersFive (req, res, next) { req.test.push('five'); next() },
    six: function six (req, res, next) { req.test.push('six'); next() },
    seven: { seven: function (req, res, next) { req.test.push('seven'); next() } },
    eight: function (req, res, next) { req.test.push('eight'); next() }
  }
  // create a composed middleware
  var composed = compose(initial)

  // do some manipulation
  composed.unshift(others.one) // prepend
  composed.push(others.five) // append
  composed.before('four', others.three) // insert before
  composed.after('othersFive', others.six) // insert after
  composed.after('six', others.seven)

  // named functions become named middleware functions
  console.log(composed.stack) // [ { one: [Function: one] },
  //   { two: [Function] },
  //   { three: [Function: three] },
  //   { four: [Function] },
  //   { othersFive: [Function: othersFive] },
  //   { six: [Function: six] },
  //   { seven: [Function] } ]

  // lets clone the middlewares
  var composed2 = composed.clone() // clone the middlewares; same as `compose(composed)`
  composed2.remove('six').remove('two').remove('four') // remove middlewares

  // do some more manipulation
  composed.replace('seven', others.eight) // replace middleware seven with eight

  // run new composed middleware
  var req = { test: [] }
  composed(req, res, function () {
    console.log(4, req.test) // < [ 'one', 'two', 'three', 'four', 'five', 'six', 'eight' ]
  })

  // run the other composed middleware (with a different request)
  var req2 = { test: [] }
  composed2(req2, res, function () {
    console.log(5, req2.test) // < [ 'one', 'three', 'five', 'seven' ]
  })
})()
