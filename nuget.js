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

//Resolve package should only resolve the package spec, not revision (see npm fetcher)
NugetFetcher.prototype.resolvePackage = function(locator, force_resolve) {
  var self = this;
  return NugetFetcher.super_.prototype.resolvePackage.apply(this, arguments).then(function doResolve(locator) {
    if(!locator.package.value || (!force_resolve && locator.package.value && locator.package.resolved)) {
      return locator; // if package is null or already resolved, skip resolution
    }
    
    //URL in this format: https://www.nuget.org/api/v2/Packages?%24filter=Id%20eq%20%27<PACKAGE_NAME>%27
    var nugetUrl = 'https://www.nuget.org/api/v2/Packages?';
    nugetUrl += '%24filter=Id%20eq%20%27' + locator.package.value + '%27';

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

//goes out to nuget and fetches package
NugetFetcher.prototype.fetchPackage = function(url, locator) {
  return new Promise(function (resolve, reject) {
    try {
      request({uri: url, resolveWithFullResponse: false})
      .then(function (response) {
        parseString(response, function (err, result) {
          if (err) {
            return reject(new Error('Package with that name does not exist'));
          }
          var formatted_data = {};
          var allEntries = result.feed.entry;

          for (var i=0; i<allEntries.length; ++i) {
            var allProperties = allEntries[i]['m:properties'][0];
            var title = allProperties['d:Title'][0];
            if (title.toUpperCase() === locator.package.value.toUpperCase()) {  //only if the title matches
              //store all of the revisions available for this package in array
              if (formatted_data.revisions && formatted_data.revisions.length > 0) {
                formatted_data.revisions.push(allProperties['d:Version'][0]);
              } else {
                formatted_data.title = locator.package.value;
                formatted_data.url = allProperties['d:ProjectUrl'][0];
                formatted_data.authors = allProperties['d:Authors'];
                formatted_data.description = allProperties['d:Description'][0];
                formatted_data.revisions = [allProperties['d:Version'][0]]; //initialize revisions array
              }
              if (allProperties['d:IsLatestVersion'][0]._ === 'true') {
                formatted_data.latestVersion = allProperties['d:Version'][0];
              }
            }
          }
          if (formatted_data.title) {
            return resolve(formatted_data);
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

function addTrailingZeros (version) {
  while (version.length < 3) {
    version.push(0);
  }
  return version;
}
//this compares two versions to each other and returns -1, 1, or 0
function versionComparator (version1, version2) {
  var versionParts1 = version1.split('.');
  var versionParts2 = version2.split('.');

  //add trailing 0's to versions ex. 1.2 -> 1.2.0
  versionParts1 = addTrailingZeros(versionParts1);
  versionParts2 = addTrailingZeros(versionParts2);

  var indexCt = 0;
  while (indexCt < 3) {
    if (versionParts1[indexCt] !== versionParts2[indexCt]) {
      return Number(versionParts1[indexCt]) - Number(versionParts2[indexCt]);
    }
    indexCt++;
  }

  return 0; //this will only be reached if the versions are equal, which should return 0
}

//this takes in a range of versions, and the list of all revisions found. Returns a single resolved version, or null if it isn't found
function resolveNugetVersionInterval(revisionInterval, allRevisions) {
  var lessThanExpression, greaterThanExpression;
  var openBracket = revisionInterval.charAt(0);
  var closeBracket = revisionInterval.charAt(revisionInterval.length-1);

  var revisionStr = revisionInterval.slice(1,-1); //get string without brackets
  var versionParts = revisionStr.split(',');
  var compareFunc;

  //throw error on invalid edge cases (might have matched the regex)
  if (revisionStr.charAt(0) === ',' && revisionStr.charAt(revisionStr.length-1) === ',') {
    throw new Error('Invalid version interval: ' + revisionInterval);
  }
  //case: (1.0) - this is invalid
  if (openBracket === '(' && closeBracket === ')' && versionParts.length === 1) {
    throw new Error('Invalid version interval: ' + revisionInterval);
  }

  //if [1.0], return 1.0 as the version (if it is a valid package version)
  if (openBracket === '[' && closeBracket === ']' && versionParts.length === 1) {
    if (allRevisions.indexOf(versionParts[0]) > -1) {
      return versionParts[0];
    } else {
      throw new Error('Invalid version interval: ' + revisionInterval + '. Revision does not exist');
    }
  }

  if (revisionStr.charAt(0) === ',') {                                              //case (,1.0] and (,1.0)

    if (openBracket === '[') {                            //this is illegal, can't have [,1.0)
      throw new Error('Invalid version interval: ' + revisionInterval);
    }
    //set comparing function
    compareFunc = function (version) {
      var compareVal = versionComparator(version,versionParts[1]);
      var expression = (closeBracket === ']') ? compareVal <= 0 : compareVal < 0;
      return expression;
    }
  } else if (revisionStr.charAt(revisionStr.length-1) === ',') {                    //case (1.0,) and [1.0,)

      if (closeBracket === ']') {                            //this is illegal, can't have (1.0,]
        throw new Error('Invalid version interval: ' + revisionInterval);
      }
      //set comparing function
      compareFunc = function (version) {
        var compareVal = versionComparator(version,versionParts[0]);
        var expression = (closeBracket === '[') ? compareVal >= 0 : compareVal > 0;
        return expression;
      }
  } else {                                                                          // case (1.0,2.0)
    var val1 = versionParts[0];
    var val2 = versionParts[1];

    compareFunc = function (version) {
      var compareVal1 = versionComparator(version,val1);
      var compareVal2 = versionComparator(version,val2);
      var expression1 = (openBracket === '[') ? compareVal1 >= 0 : compareVal1 > 0;
      var expression2 = (closeBracket === ']') ? compareVal2 <= 0 : compareVal2 < 0;

      return expression1 && expression2;
    }
  }

  var finalRevision;
  //check the list of revisions, and find a revision that is true in the compareFunc, then set that version and return
  for (var i=0; i<allRevisions.length; ++i) {
    var currRevision = allRevisions[i];
    if (compareFunc(currRevision)) {
      finalRevision = currRevision;
      break;
    }
  }

  return finalRevision;
}

NugetFetcher.prototype.resolveRevision = function(locator, force_resolve) {
  return NugetFetcher.super_.prototype.resolveRevision.apply(this, arguments).then(function(locator) {
    var locatorRevision = locator.revision.full;
    var currentVersion;
    var allRevisions = locator.package.metadata.revisions;
    if (locatorRevision && locatorRevision.toLowerCase() !== 'latest') {  //if version was specified, and not 'latest'

      //based off of this spec: https://docs.nuget.org/create/versioning
      var versionRangeRegex = /^(\(|\[)(\,)?(\d+\.)?(\d+\.)?(\d+)(\,)?((\d+\.)?(\d+\.)?(\d+))?(\)|\])$/;
      if (versionRangeRegex.test(locatorRevision)) {  //if this is a range, grab the first version that fits in this range
        currentVersion = resolveNugetVersionInterval(locatorRevision, allRevisions);
      } else {
        currentVersion = locatorRevision;
      }
    } else {
      //if latestVersion was specified, grab that, otherwise, just grab the first revision in the revisions list
      currentVersion = locator.package.metadata.latestVersion || allRevisions[0];
    }

    //if still no version, throw an error
    if (!currentVersion) {
      throw new Error("Revision was unable to be resolved.");
    }

    locator.revision = {
      value: currentVersion,
      full: currentVersion,
      resolved: true,
      metadata: null
    };
    return locator;
    
  });
};

module.exports = NugetFetcher;
