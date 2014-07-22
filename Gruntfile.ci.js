var TRAVIS_COMMIT = process.env.TRAVIS_COMMIT;
var MOCHA_TOOL_ID = '53a47fcff5663c4435b9666c';
var KARMA_TOOL_ID = '53a87bdd3df0d5ec4c4a7bd9';
var JSHINT_TOOL_ID = '53a47fb9f5663c4435b9666a';
var COVERAGE_TOOL_ID = '53c5b6a9d8600ebf0b3f962f';

module.exports = function(grunt) {

	var config = {

		// Coverage
		mocha_istanbul: {
			coverage: {
				src: 'src/tests/server', // the folder, not the files,
				options: {
					coverage: true,
					mask: '**/*.js',
					coverageFolder: 'output/coverage'
				}
			}
		},

		coveralls: {
			mocha: {
				src: 'output/coverage/lcov.info'
			}
		},


		// server tests
		mochaTest: {
			server: {
				options: {
					reporter: require('mocha.ninja'),
					captureFile: './output/mochaTest/server.out'
				},
				src: ['src/tests/server/**/*.js']
			}
		},

		// client tests
		karma: {
			unit: {
				configFile: 'src/tests/karma.ninja.js',
				reporters: ['karma-reviewninja-reporter']
			}
		},

		// jshint
		jshint: {
			options: {
				jshintrc: '.jshintrc'
			},
			app: {
				options: {
					reporter: 'node_modules/jshint.ninja/index.js',
					reporterOutput: './output/jshint/jshint.out'
				},
				files: {
					src: ['app.js', 'src/client/**/*.js', 'src/server/**/*.js', 'src/tests/**/*.js']
				}
			}
		}
	};

	// Initialize configuration
	grunt.initConfig(config);

	// Report coverage to review.ninja once instanbul is finished
	grunt.event.on('coverage', function(lcovFileContents, done) {

		var options = {
			outputFile: 'output/coverage/server.out',
			minCoverage: 75
		}; 

		var onSuccess = function () {
			// Something
		};

		require('reviewninja-coverage-reporter')
			.report(options, lcovFileContents, onSuccess);

		done();
	});

	grunt.loadNpmTasks('grunt-karma');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-mocha-istanbul');
	grunt.loadNpmTasks('grunt-coveralls');

	grunt.registerTask('default', ['jshint', 'mochaTest', 'karma']);
	grunt.registerTask('coverage', ['mocha_istanbul:coverage', 'coveralls:mocha']);

};
