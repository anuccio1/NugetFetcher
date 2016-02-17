var nuget = require('nuget.js');

// https://www.nuget.org/api/v2/Packages?%24filter=Id%20eq%20%27elmah%27

nuget.resolve('nuget+elmah').then(function(locator) {
	// expect latest version (1.2.2) nuget+elmah$1.2.2
	console.log("Resolved nuget+elmah to: " + locator);
});

nuget.resolve('nuget+elmah$1.2.0.1').then(function(locator) {
	console.log("Resolved nuget+elmah to: " + locator);
});

nuget.resolve('nuget+elmah$[1.1,1.2.2)').then(function(locator) {
	// resolves to 1.2.0.1
	console.log("Resolved nuget+elmah to: " + locator);
});