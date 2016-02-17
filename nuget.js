var Promise = require('bluebird'),
    BaseFetcher = require('./BaseFetcher.js'),
    inherits = require('inherits'),
    _ = require('underscore'),
    request = require('request-promise');


var NugetFetcher = function(config) {
  NugetFetcher.super_.apply(this, arguments);
};

inherits(NugetFetcher, BaseFetcher);

NugetFetcher.prototype.resolvePackage = function(locator, force_resolve) {
  var self = this;
  return NugetFetcher.super_.prototype.resolvePackage.apply(this, arguments).then(function doResolve(locator) {
    if(!locator.package.value || (!force_resolve && locator.package.value && locator.package.resolved)) {
      return locator; // if package is null or already resolved, skip resolution
    }
    // TODO: parse urls, registry formats, auth, etc...

    return request('https://www.nuget.org/api/v2/Packages?%24filter=Id%20eq%20%27' + locator.package.value + '%27').then(function (error, response, body) {
      if (!error && response.statusCode === 200) {
        return locator;
      } else {
        if(!locator.package.value || !locator.package.resolved) throw new Error("No package found with spec: " + locator);
        return locator;
      }
    });

  });
};


// NugetFetcher.prototype.resolveRevision = function(locator, force_resolve) {
//   return NugetFetcher.super_.prototype.resolveRevision.apply(this, arguments).then(function(locator) {
//     return nuget_view(locator.package.value + '@' + (locator.revision.value || 'latest'), "version").then(function(data) {
//       var revision = Object.keys(data)[0];
//       if(data) {
//         locator.revision = {
//           value: revision,
//           full: revision,
//           resolved: true,
//           metadata: data
//         };
//       } else {
//         throw new Error("Invalid data returned from NPM.");
//       }
//       return locator;
//     });
//   });
// };