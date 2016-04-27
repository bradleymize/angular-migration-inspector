var esprima = require("esprima");
var htmlparser2 = require("htmlparser2");
var _ = require("lodash");
var fs = require("fs");
var readline = require("readline");
var utils = require("../../utils/utils.js");

var Angular13to14 = function() {
  var self;

  function inspectMigration(scope, files) {
    self = scope;
    console.log("Inspecting migration from 1.3 to 1.4");
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
        analyze(contents, file);
      }
    });
    readline.clearLine(process.stdout);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write("Progress: 100%\n\n");
    _.forEach(self.results, function(result) {
      if(!self.suppressInfo || (self.suppressInfo && result.indexOf(" INFO: ") === -1)) {
        console.log(result);
      }
    });
  }

  function analyze(contents, file) {
    var parsedContent;
    if(_.endsWith(file,".js")) {
      parsedContent = esprima.parse(contents, {loc: true});
    }
    if(_.endsWith(file,".html")) {
      parsedContent = new htmlparser2.Parser(get13HtmlParserOptions(), {decodeEntities: true});
    }

    if(_.endsWith(file,".js")) {
      _.merge(self.filesReferencingTemplate, utils.getTemplateUrlDeclarations(parsedContent,file));
      animateSearch13(parsedContent,file);
      cookie13(parsedContent,file);
      http13(parsedContent,file);
      compile13(parsedContent,file);
    }
    if(_.endsWith(file,".html")) {
      self.htmlParser.currentFile = file;
      parsedContent.write(contents);
      parsedContent.end();
    }
  }

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
      var paths = utils.find(parsedContents, params[i].key);
      for(var j = 0; j < paths.length; j++) {
        var obj = _.get(parsedContents, paths[j]);
        self.results.push(file+" (Line: "+ obj.loc.start.line +":"+obj.loc.start.column+"): "+ params[i].message);
      }
    }
  }
  function http13(parsedContents, file) {
    var params = [
      {
        key: {"type":"Property", "key.name": "transformRequest", "value.type": "FunctionExpression"},
        message: "WARNING: transformRequest found. Inspect to make sure it does not modify headers"
      }
    ];
    for(var i = 0; i < params.length; i++) {
      var paths = utils.find(parsedContents, params[i].key);
      for(var j = 0; j < paths.length; j++) {
        var obj = _.get(parsedContents, paths[j]);
        self.results.push(file+" (Line: "+ obj.loc.start.line +":"+obj.loc.start.column+"): "+ params[i].message);
      }
    }
  }
  function compile13(parsedContents, file) {
    var params = [
      {
        key: {"type":"Property", "value.raw": "matches:^'&[\\w]+\\?'$"},
        message: "WARNING: possible optional functional expression directive parameter found. Optional expressions parameters no longer create a function on the scope."
      }
    ];
    for(var i = 0; i < params.length; i++) {
      var paths = utils.find(parsedContents, params[i].key);
      for(var j = 0; j < paths.length; j++) {
        var obj = _.get(parsedContents, paths[j]);
        self.results.push(file+" (Line: "+ obj.loc.start.line +":"+obj.loc.start.column+"): "+ params[i].message);
      }
    }
  }
  function cookie13(parsedContents, file) {
    var params = [
      {
        key: {"type":"AssignmentExpression", "left.object.name": "$cookies"},
        message: "WARNING: $cookies now has it's own api. Refactor to use it."
      },
      {
        key: {"type":"VariableDeclarator", "init.object.name": "$cookies"},
        message: "WARNING: $cookies now has it's own api. Refactor to use it."
      },
      {
        key: {"type":"CallExpression", "callee.object.name": "$cookieStore"},
        message: "WARNING: $cookieStore is deprecated. Use $cookies instead."
      }
    ];
    for(var i = 0; i < params.length; i++) {
      var paths = utils.find(parsedContents, params[i].key);
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
        if(attrs["ng-repeat"] || attrs["data-ng-repeat"]) {
          msg = self.htmlParser.currentFile+": INFO: ng-repeat is no longer sorted.";
          if(self.results.indexOf(msg) === -1) {
            self.results.push(msg);
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
        if(name === "form" && (attrs["name"] || attrs["data-name"])) {
          //console.log("\n"+self.htmlParser.currentFile+" - form name: "+(attrs["name"] || attrs["data-name"]));
          var formName = attrs["name"] || attrs["data-name"];
          if(!formName.match(/^[a-zA-Z0-9\+\-\.\[\]]+$/)) {
            msg = self.htmlParser.currentFile+": WARNING: form attribute 'name' can no longer have special characters. See angular docs for rare exceptions.";
            if(self.results.indexOf(msg) === -1) {
              self.results.push(msg);
            }
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

  return {
    inspectMigration: inspectMigration
  };
};

module.exports = new Angular13to14();