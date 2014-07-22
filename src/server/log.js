
var loggly = require('loggly');

try { 
	var client = loggly.createClient({
	    token: process.env.LOGGLY,
		subdomain: 'reviewninja',
		json: true
	});
} catch(ex) {

}

module.exports = {
	log: function() {
		if(process.env.NODE_ENV === 'production') {
			try {
				client.log.apply(client, arguments);
			} catch(ex) {
				
			}
		}

		if (arguments.length > 0)
			console.log('LOG: ' + arguments[0]);
	}
};