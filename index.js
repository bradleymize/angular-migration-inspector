var globby = require("globby");
var semver = require("semver");
var utils = require("./utils/utils.js");

//Migration rules
var angular13to14 = require('./migrationRules/Angular13toAngular14/rules.js');

//Constructor
var AngularMigrationInspector = function(glob, currentVersion) {
  var self = this;
  self.version = "0.0.0";
  self.nextVersion = "0.1.0";
  self.glob = null;
  self.suppressInfo = false;
  self.results = null;
  self.cache = {};
  self.filesReferencingTemplate = {};
  self.htmlParser = {
    currentFile: null,
    ngOptionsFiles: []
  };

  if(glob) {
    setGlob(glob);
  }
  if(currentVersion) {
    setVersion(currentVersion);
  }

  if(self.nextVersion === "1.5.0") {
    throw new Error("Migration from Angular 1.5.x to 2 is out of scope of this plugin");
  }

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
  function suppressInfo(doSuppress) {
    self.suppressInfo = doSuppress;
  }
  function analyze() {
    if(!self.glob) {
      throw new Error("No glob patterns specified");
    }
    var files = globby.sync(self.glob);
    if(self.nextVersion === "1.4.0") {
      angular13to14.inspectMigration(self, files);
    } else {
      console.log("No migration rules present for version: "+self.nextVersion);
    }
  }

  //===============  API  ====================
  var plugin = {
    setVersion: setVersion,
    setGlob: setGlob,
    addGlob: addGlob,
    addGlobPattern: addGlobPattern,
    suppressInfo: suppressInfo,
    analyze: analyze
  };
  return plugin;
};

module.exports = AngularMigrationInspector;