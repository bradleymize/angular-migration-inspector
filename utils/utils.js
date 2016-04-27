var _ = require("lodash");

var Utils = function() {
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
            (predicateValue.split(":").length === 1 && element !== predicateValue) ||
            (predicateValue.indexOf("contains") === 0 && element.indexOf(_.tail(predicateValue.split(":")).join(":")) === -1) ||
            (predicateValue.indexOf("matches") === 0 && !element.match(_.tail(predicateValue.split(":")).join(":")))
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
  function getTemplateUrlDeclarations(parsedContent, file) {
    var predicate = {"type": "Property", "key.name": "templateUrl"};
    var paths = find(parsedContent, predicate);
    var results = {};
    for(var i = 0; i < paths.length; i++) {
      var tempPath = [].concat(paths[0]);
      tempPath = tempPath.concat(["value","value"]);
      var value = "web-app/" + _.get(parsedContent,tempPath);

      if(!results[value]) {
        results[value] = [];
      }
      results[value].push(file);
    }
    return results;
  }
  return {
    find: find,
    getTemplateUrlDeclarations: getTemplateUrlDeclarations
  }
};
module.exports = new Utils();