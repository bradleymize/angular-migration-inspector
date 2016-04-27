var esprima = require("esprima");
var globby = require("globby");
var htmlparser2 = require("htmlparser2");
var semver = require("semver");
var _ = require("lodash");
var fs = require("fs");
var readline = require("readline");

//Constructor
var AngularMigrationInspector = function(glob, currentVersion) {
  var self = this;
  self.version = "0.0.0";
  self.nextVersion = "0.1.0";
  self.glob = null;
  self.results = null;
  self.cache = {};
  self.filesReferencingTemplate = {};
  self.htmlParser = {
    currentFile: null,
    ngOptionsFiles: []
  };

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
  function hasTemplateUrlDeclaration(parsedContent, file) {
    var predicate = {"type": "Property", "key.name": "templateUrl"};
    var paths = find(parsedContent, predicate);
    for(var i = 0; i < paths.length; i++) {
      var tempPath = [].concat(paths[0]);
      tempPath = tempPath.concat(["value","value"]);
      var value = "web-app/" + _.get(parsedContent,tempPath);

      if(!self.filesReferencingTemplate[value]) {
        self.filesReferencingTemplate[value] = [];
      }
      self.filesReferencingTemplate[value].push(file);
    }
  }
  function find(collection, predicateObj, results, path, original) {
    results = _.isUndefined(results) ? [] : results;
    path = _.isUndefined(path) ? [] : path;
    original = _.isUndefined(original) ? collection : original;
    for(var key in collection) {
      if(collection.hasOwnProperty(key)) {
        path.push(key);
        var value = collection[key];
        var predicateKeys = _.keys(predicateObj);
        var found = true;
        for(var i = 0; i < predicateKeys.length; i++) {
          var element = _.get(value,predicateKeys[i]);
          var predicateValue = predicateObj[predicateKeys[i]];
          if(_.isUndefined(element) ||
            (predicateValue.indexOf("contains") !== 0 && element !== predicateValue) ||
            (predicateValue.indexOf("contains") === 0 && element.indexOf(_.tail(predicateValue.split(":")).join(":")) === -1)
          ) {
            found = false;
            break;
          }
        }
        if(found) {
          results.push([].concat(path));
        }
        if(_.isObject(value) || _.isArray(value)) {
          find(value, predicateObj, results, path, original);
        }
        path.pop();
      }
    }
    return results;
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
    console.log("Inspection migrating from "+self.version+" to "+self.nextVersion);
    var files = globby.sync(self.glob);
    //TODO: migrate based on version
    migrate130to140(files);
  }
  function migrate130to140(files) {
    self.results = [];
    self.htmlParser.ngOptionsFiles = [];
    self.cache = {};
    self.filesReferencingTemplate = {};
    _.forEach(files, function(file, index) {
      var contents = fs.readFileSync(file, 'UTF-8');
      self.cache[file] = contents;
      if(typeof contents === "string") {
        readline.clearLine(process.stdout);
        readline.cursorTo(process.stdout, 0);
        var progress = _.round((index/files.length)*100,1) + "";
        if(progress.split(".").length === 1) {
          progress = progress + ".0";
        }
        process.stdout.write("Progress: "+progress+"% ("+ _.last(file.split("/")) +")");
        analyze13to14(contents, file);
      }
    });
    readline.clearLine(process.stdout);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write("Progress: 100%\n\n");
    _.forEach(self.results, function(result) {
      console.log(result);
    });
  }
  function analyze13to14(contents, file) {
    var parsedContent;
    if(_.endsWith(file,".js")) {
      parsedContent = esprima.parse(contents, {loc: true});
    }
    if(_.endsWith(file,".html")) {
      parsedContent = new htmlparser2.Parser(get13HtmlParserOptions(), {decodeEntities: true});
    }
    //if(file === "web-app/js/app/configure/addressType/list/addressType.list.js") {
    //  console.log(JSON.stringify(parsedContent, null, 2));
    //}

    if(_.endsWith(file,".js")) {
      hasTemplateUrlDeclaration(parsedContent,file);
      animateSearch13(parsedContent,file);
    }
    if(_.endsWith(file,".html")) {
      self.htmlParser.currentFile = file;
      parsedContent.write(contents);
      parsedContent.end();
    }
  }

  //=============== 1.3.x ====================
  function animateSearch13(parsedContents, file) {
    var params = [
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "animate"},
        message: "INFO: Javascript animation found: $animate.animate. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "enter"},
        message: "INFO: Javascript animation found: $animate.enter. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "leave"},
        message: "INFO: Javascript animation found: $animate.leave. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "move"},
        message: "INFO: Javascript animation found: $animate.move. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "addClass"},
        message: "INFO: Javascript animation found: $animate.addClass. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "removeClass"},
        message: "INFO: Javascript animation found: $animate.removeClass. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "setClass"},
        message: "INFO: Javascript animation found: $animate.setClass. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "cancel"},
        message: "INFO: Javascript animation found: $animate.cancel. Remove $scope.$apply / $scope.$digest from callback (if present)."
      },
      {
        key: {"type": "CallExpression", "callee.object.name": "$animate", "callee.property.name": "enable"},
        message: "INFO: Javascript animation found: $animate.enable. Arguments have switched. Verify behavior."
      },
      {
        key: {"type": "CallExpression", "callee.property.name": "animation"},
        message: "WARNING: Javascript animation found: animation() invocation. Refactor to use $animateCss (if necessary)."
      },
      {
        key: {"type": "CallExpression", "callee.property.name": "on", "arguments.0.value" : "contains:$animate:"},
        message: "WARNING: Javascript animation callback found: elem.on('$animate:...'). Refactor to $animate.on()."
      }
    ];
    for(var i = 0; i < params.length; i++) {
      var paths = find(parsedContents, params[i].key);
      for(var j = 0; j < paths.length; j++) {
        var obj = _.get(parsedContents, paths[j]);
        self.results.push(file+" (Line: "+ obj.loc.start.line +":"+obj.loc.start.column+"): "+ params[i].message);
      }
    }
  }
  function get13HtmlParserOptions() {
    var options = {
      onopentag: function(name, attrs) {
        var msg;
        if(attrs["ng-options"] || attrs["data-ng-options"]) {
          msg = self.htmlParser.currentFile+": INFO: ng-options is no longer sorted.";
          if(self.results.indexOf(msg) === -1) {
            self.results.push(msg);
          }
          var referencingFiles = self.filesReferencingTemplate[self.htmlParser.currentFile] || [];
          for(var i = 0; i < referencingFiles.length; i++) {
            msg = self.htmlParser.currentFile+": WARNING: Inspect the following controller for references to ngOptions value: "+referencingFiles[i];
            if(self.results.indexOf(msg) === -1) {
              self.results.push(msg);
            }
          }
        }
        if((attrs["ng-messages"] || attrs["data-ng-messages"]) && attrs["ng-messages-include"] || attrs["data-ng-messages-include"]) {
          msg = self.htmlParser.currentFile+": WARNING: 'ng-messages' and 'ng-messages-include' on the same element. Separate them.";
          if(self.results.indexOf(msg) === -1) {
            self.results.push(msg);
          }
        }
        if(name === "select") {
          msg = self.htmlParser.currentFile+": WARNING: 'select' now uses strict comparison. If the value is a non-string: initialize the model to a string, or use $formatters/$parsers on ngModel";
          if(self.results.indexOf(msg) === -1) {
            self.results.push(msg);
          }
        }
      },
      onattribute: function(attrName, value) {
        if(_.indexOf(["ng-messages","data-ng-messages"],attrName) > -1) {
          if(value.indexOf("{{") > -1 && value.indexOf("}}") > -1) {
            self.results.push(self.htmlParser.currentFile+": WARNING: ng-messages no longer supports interpolation. Convert to function invocation.");
          }
        }
      }
    };
    return options;
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