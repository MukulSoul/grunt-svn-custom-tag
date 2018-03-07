/* global module */
module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		svn_tag2: {
			options: {
				_debug: true,
				//bump:       'z',
				repository: '<%= pkg.svn.repository %>',
				useWorkingCopy: true
			},
			test: {
				options: {
					tagDir: 'tags/test',
				},
				files: [{
					dest: '',
					src: [
						'file.txt'
					]
				}]
			},
			testCustomVersion: {
				options: {
					tagDir: 'tags/test',
					customVersion:"<%=pkg.version%>"
				},
				files: [{
					dest: '',
					src: [
						'file.txt'
					]
				}]
			}
		}
	});
	grunt.loadNpmTasks('grunt-svn-tag2');
	grunt.registerTask('default', 'svn_tag2')
};