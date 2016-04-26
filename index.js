var esprima = require("esprima");
var globby = require("globby");
var htmlparser2 = require("htmlparser2");
var Lex = require("lex");
var semver = require("semver");
var _ = require("lodash");
var fs = require("fs");

//Constructor
var AngularMigrationInspector = function(glob, currentVersion) {
  var self = this;
  self.version = "0.0.0";
  self.nextVersion = "0.1.0";
  self.glob = null;

  if(currentVersion) {
    setVersion(currentVersion);
  }
  if(glob) {
    setGlob(glob);
  }

  if(self.nextVersion === "1.5.0") {
    throw new Error("Migration from Angular 1.5.x to 2 is out of scope of this plugin");
  }
  //=============  UTILITY  ==================
  function pickDeep(collection, predicate, thisArg) {
    if (_.isFunction(predicate)) {
      predicate = _.iteratee(predicate, thisArg);
    } else {
      var keys = _.flatten(_.tail(arguments));
      predicate = function(val, key) {
        return _.includes(keys, key);
      }
    }

    return _.transform(collection, function(memo, val, key) {
      var include = predicate(val, key);
      if (!include && _.isObject(val)) {
        val = pickDeep(val, predicate);
        include = !_.isEmpty(val);
      }
      if (include) {
        _.isArray(collection) ? memo.push(val) : memo[key] = val;
      }
    });
  }
  function find(collection, predicateObj, path, original) {
    path = _.isUndefined(path) ? [] : path;
    original = _.isUndefined(original) ? collection : original;
    for(var key in collection) {
      if(collection.hasOwnProperty(key)) {
        path.push(key);
        var value = collection[key];
        var found = _.find(value, predicateObj);
        if(found) {
          return path;
        }
        if(_.isObject(value) || _.isArray(value)) {
          path = find(value, predicateObj, path, original);
          value = _.get(original, path);
          if(_.find(value, predicateObj)) {
            return path;
          } else {
            path.pop();
          }
        } else {
          path.pop();
        }
      }
    }
    return path;
  }
  //=============  PRIVATE  ==================
  function setVersion(version) {
    var v = semver.valid(version);
    if(v) {
      var maj = semver.major(version), min = semver.minor(version);
      if(maj === 1 && min !== 5) {
        self.version = v;
        self.nextVersion = semver.inc(self.version,"minor");
      } else {
        throw new Error("Migration from Angular 1.5.x to 2 is out of scope of this plugin");
      }
    } else {
      throw new Error("Invalid version: "+version);
    }
  }
  function setGlob(glob) {
    self.glob = glob;
  }
  function addGlob(glob) {
    if(!self.glob) {
      self.glob = [];
    }

    if(typeof self.glob === "string") {
      self.glob = [self.glob].concat(glob);
    } else {
      self.glob = self.glob.concat(glob);
    }
  }
  function addGlobPattern(pattern) {
    if(!self.glob) {
      self.glob = [];
    }

    if(typeof self.glob === "string") {
      self.glob = [self.glob, pattern];
    } else {
      self.glob.push(pattern);
    }
  }
  function analyze() {
    if(!self.glob) {
      throw new Error("No glob patterns specified");
    }
    console.log("Migrating from "+self.version+" to "+self.nextVersion);
    var files = globby.sync(self.glob);
    //TODO: migrate based on version
    migrate130to140(files);
  }
  function analyze14(contents) {
    //console.log(contents);
    var parsed = esprima.parse(contents);
    console.log(JSON.stringify(parsed, null, 2));
    console.log(_.find(parsed, "value"));
    console.log("=======================================");
    var value = find(parsed,["value", "angle1"]);
    console.log("=======================================");
    console.log("=======================================");
    console.log(value);
  }
  function migrate130to140(files) {
    _.forEach(files, function(file) {
      if(file === "web-app/js/app/vendorModule.js") {
        fs.readFile(file, 'UTF-8', function(err, contents) {
          if(err) throw err;
          analyze14(contents);
        });
      }
    })
  }

  //===============  API  ====================
  var plugin = {
    setVersion: setVersion,
    setGlob: setGlob,
    addGlobPattern: addGlobPattern,
    addGlob: addGlob,
    analyze: analyze
  };
  return plugin;
};

module.exports = AngularMigrationInspector;