var fs = require('fs');
var path = require('path');
var glob = require('glob');
var semver = require('semver');

// http://registry.npmjs.org/%s/
// {"dist-tags":{"latest":"0.7.5"},"versions":{"0.0.1":...}}
// http://registry.npmjs.org/%s/%s

module.exports = function(opts) {
  opts = opts || {};
  var modules = {};
  var packageFiles = {};

  function loadModule(filename) {
    try {
      var json = JSON.parse(fs.readFileSync(filename));
    }
    catch (ex) {
      console.log('loadModule(filename = %j) error: %j', ex, error);
      return;
    }
    var moduleName = filename.replace(/^.*?([^\/]+)\/bower\.json$/, '$1');
    modules[moduleName] = modules[json.name] = modules[json.name] || {
      name: json.name,
      $$versions: []
    };
    if (modules[json.name][json.version]) {
      return;
    }
    modules[json.name].versions = modules[json.name].versions || {};
    modules[json.name].versions[json.version] = {
      name: json.name + '@' + json.version,
      $$package: json
    };
    modules[json.name].$$versions.push(json.version);
  }

  glob('bower.json', {
    sync: true
  }).forEach(loadModule);

  var rootModule = modules[Object.keys(modules)[0]];
  if (!rootModule) {
    return;
  }

  glob('**/bower.json', {
    sync: true
  }).forEach(function(filename) {
    var moduleName = filename.replace(/^.*?([^\/]+)\/bower\.json$/, '$1');
    packageFiles[moduleName] = packageFiles[moduleName] || [];
    packageFiles[moduleName].push(filename);
  });

  var root = {};

  function parse(node, name, version, level) {
    // console.log('parse(name = %j, version = %j)', name, version);
    if (packageFiles[name]) {
      packageFiles[name].forEach(function(filename) {
        loadModule(filename);
      });
      packageFiles[name] = null;
    }
    var module = modules[name];
    if (!module) {
      console.log('parse(name = %j, version = %j) module not exits.', name, version);
      return;
    }

    var versions = module.$$versions.filter(function(v) {
      return semver.satisfies(v, version, true);
    }).sort(semver.compareLoose);

    var currVersion = module.versions[versions[0] || module.$$versions[0]];
    if (!currVersion) {
      console.log('parse(name = %j, version = %j) version not exits.', name, version);
      return;
    }

    node.data = {
      text: currVersion.$$package.name + '@' + currVersion.$$package.version,
      note: currVersion.$$package.description,
      hyperlink: currVersion.$$package.homepage,
      hyperlinkTitle: currVersion.$$package.homepage ? 'homepage' : undefined,
      expandState: level < 3 ? 'expand' : 'collapse'
    };

    var children = [];
    for (var key in currVersion.$$package.dependencies) {
      var item = {};
      parse(item,
        key,
        currVersion.$$package.dependencies[key],
        level + 1
      );
      if (Object.keys(item).length) {
        children.push(item);
      }
    }
    if (children.length) {
      node.children = children;
    }
  }
  parse(root, rootModule.name, rootModule.$$versions[0], 0);

  return root;
};