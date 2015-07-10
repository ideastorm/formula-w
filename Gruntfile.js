module.exports = function (grunt) {
// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		copy: {
			build: {
				cwd: 'src',
				src: ['**'],
				dest: 'build',
				expand: true
			}
		},
		clean: {
			build: {
				src: 'build'
			},
			stylesheets: {
				src: ['build/**/*.css', '!build/application.css']
			},
			scripts: {
				src: ['build/**/*.js', '!build/application.js']
			}},
		postcss: {
			options: {
				map: true,
				processors: [
					require('autoprefixer-core')({browsers: 'last 2 versions'}),
					require('cssnano')()
				]
			},
			dist: {
				src: 'client/css/*.css'
			}
		},
		uglify: {
			build: {
				options: {
					mangle: true //set to false to keep existing names
				},
				files: {
					'build/application.js': ['build/**/*.js']
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-postcss');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('scripts', 'Compiles the scripts', ['uglify', 'clean:scripts']);

	grunt.registerTask('build', 'Copies the files to the build directory', ['copy', 'postcss', 'uglify']);
};
