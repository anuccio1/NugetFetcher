var Promise = require('bluebird'),
    BaseFetcher = require('./BaseFetcher.js'),
    inherits = require('inherits'),
    _ = require('underscore'),


var NugetFetcher = function(config) {
  NugetFetcher.super_.apply(this, arguments);
};

inherits(NugetFetcher, BaseFetcher);

NpmFetcher.prototype.resolvePackage = function(locator, force_resolve) {
  var self = this;
  return Promise.all([NpmFetcher.super_.prototype.resolvePackage.apply(this, arguments), this._npm_ready]).spread(function doResolve(locator) {
    if(!locator.package.value || (!force_resolve && locator.package.value && locator.package.resolved)) {
      return locator; // if package is null or already resolved, skip resolution
    }
    // TODO: parse urls, registry formats, auth, etc...
    var npm_match = (/(?:www\.|)npmjs\.(?:com|org)\/(?:package\/|)([a-z0-9\-]+)/ig).exec(locator.package.value);
    if(npm_match && npm_match.length > 1) {
      locator.package = npm_match[1];
      // todo: match registry URL also
    }
    return self.fetchPackage(locator.package.value).then(function(data) {
      locator.package = {
        value: data.title,
        full: data.title,
        resolved: true,
        metadata: data
      };
      return locator;
    });
   }).then(function(locator) {
    // catch unresolved packages
     if(!locator.package.value || !locator.package.resolved) throw new Error("No package found with spec: " + locator);
     return locator;
  });
};

NpmFetcher.prototype.resolveRevision = function(locator, force_resolve) {
  return NpmFetcher.super_.prototype.resolveRevision.apply(this, arguments).then(function(locator) {
    return npm_view(locator.package.value + '@' + (locator.revision.value || 'latest'), "version").then(function(data) {
      var revision = Object.keys(data)[0];
      if(data) {
        locator.revision = {
          value: revision,
          full: revision,
          resolved: true,
          metadata: data
        };
      } else {
        throw new Error("Invalid data returned from NPM.");
      }
      return locator;
    });
  });
};