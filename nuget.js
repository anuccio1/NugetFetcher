var Promise = require('bluebird'),
    BaseFetcher = require('./BaseFetcher.js'),
    inherits = require('inherits'),
    _ = require('underscore'),
    request = require('request-promise'),
    parseString = require('xml2js').parseString;


var NugetFetcher = function(config) {
  NugetFetcher.super_.apply(this, arguments);
};

inherits(NugetFetcher, BaseFetcher);

NugetFetcher.prototype.resolveFetcher = function(locator) {
  return NugetFetcher.super_.prototype.resolveFetcher.apply(this, arguments).then(function(locator) {
    // resolve fetcher
    if(typeof locator.fetcher.value !== "string" || locator.fetcher.value.toLowerCase() != "nuget") throw new Error("Nuget resolution attempted on non-Nuget locator.");
    locator.fetcher = {
      value: 'nuget',
      full: 'nuget',
      resolved: true
    };
    return locator;
  });
};


NugetFetcher.prototype.resolvePackage = function(locator, force_resolve) {
  var self = this;
  return NugetFetcher.super_.prototype.resolvePackage.apply(this, arguments).then(function doResolve(locator) {
    if(!locator.package.value || (!force_resolve && locator.package.value && locator.package.resolved)) {
      return locator; // if package is null or already resolved, skip resolution
    }
    //URL IN THIS FORMAT if Version is explicit: https://www.nuget.org/api/v2/Packages(Id='<packageName>',Version='<version>')
    //For no version: https://www.nuget.org/api/v2/Packages?%24filter=Id%20eq%20%27elmah%27

    var nugetUrl;
    var locatorRevision = locator.revision.full;
    //if revision is listed
    if (locatorRevision) {
      if (locatorRevision.charAt(0) === '[' || locatorRevision.charAt(0) === '(') {
        //TODO: resolve this part
        nugetUrl = 'https://www.nuget.org/api/v2/Packages(Id=\'' + locator.package.value + '\',Version=\'' + locator.revision.full + '\')';
      } else {
        nugetUrl = 'https://www.nuget.org/api/v2/Packages(Id=\'' + locator.package.value + '\',Version=\'' + locator.revision.full + '\')';
      }
    } else {
      var nugetUrl = 'https://www.nuget.org/api/v2/Packages?';
      nugetUrl += '%24filter=Id%20eq%20%27' + locator.package.value + '%27';
    }
    return self.fetchPackage(nugetUrl, locator).then(function(data) {
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

NugetFetcher.prototype.fetchPackage = function(url, locator) {
  return new Promise(function (resolve, reject) {
    try {
      request({uri: url, resolveWithFullResponse: false})
      .then(function (response) {
        parseString(response, function (err, result) {
          if (err) {
            return reject(new Error('Package with that name does not exist'));
          }
          var retJSON = {};
          var allEntries = result.feed.entry;

          for (var i=0; i<allEntries.length; ++i) {
            var allProperties = allEntries[i]['m:properties'][0];
            var title = allProperties['d:Title'][0];
            if (title.toUpperCase() === locator.package.value.toUpperCase()) {  //only if the title matches
              retJSON = allProperties;
              retJSON.title = locator.package.value;
              break;
            }
          }
          if (retJSON.title) {
            return resolve(retJSON);
          } else {
            return reject(new Error('Package with that name does not exist'));
          }
        });
      })
      .catch(function(err) {
        return reject(new Error('Error Requesting URL. Package with that name does not exist'));
      });
    } catch(e) {
      return reject(new Error("Invalid Nuget package url: " + url));
    }
  });
};

module.exports = NugetFetcher;

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