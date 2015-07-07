/* global module */
module.exports = function (grunt) {
    grunt.initConfig({
        pkg:            grunt.file.readJSON('package.json'),
        svn_custom_tag: {
            options: {
                _color:     true,
                //_debug:     true,
                //bump:       'z',
                latest:     true,
                repository: '<%= pkg.svn.repository %>/<%= pkg.svn.project %>'
            },
            test:    {
                files: [
                    {
                        src: [ 'text.txt' ]
                    }
                ]
            }
        }
    });
    grunt.loadNpmTasks('grunt-svn-custom-tag');
    grunt.registerTask('default', 'svn_custom_tag:test')
};
