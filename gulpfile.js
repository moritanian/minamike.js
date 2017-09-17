'use strict';

const fs = require('fs');
const gulp = require('gulp');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');
const gutil = require('gulp-util');
const header = require('gulp-header');
const browserify = require('browserify');
const babelify = require('babelify');
const pkg = require('./package.json');
const babel = require('gulp-babel');
const stripComments = require('gulp-strip-comments');
const del = require('del');
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
/// Build the scripts


gulp.task('browserify',['clean'], function(callback) {
  browserify('./src/index.js', { debug: true })
    .transform(babelify)
    .bundle()
    .on("error", function (err) { console.log("Error : " + err.message); })
    .pipe(source('minamike.js'))

    .pipe(buffer())
    .pipe(stripComments())
			.pipe(header(fs.readFileSync('./header.js', 'utf8'), { pkg : pkg }))
    .pipe(gulp.dest('./dist'))
    .on('end', callback);
});

gulp.task('clean', function(){
	return del(['dist/', 'build/']);
});

/// Minify the build script, after building it
gulp.task('minify', ['browserify'], function() {
	//return gulp.src('./src/minamike.js')
    return	browserify('./dist/minamike.js', { debug: true })
     	.bundle()
		.pipe(source('minamike.min.js'))
    	.pipe(buffer())
		//.pipe(uglify('minamike.min.js'))
		.pipe(
			uglify('minamike.min.js',{preserveComments: 'license'})
			.on('error', gutil.log))
		.pipe(header(fs.readFileSync('./header.js', 'utf8'), { pkg : pkg }))
		.pipe(gulp.dest('./dist/'))
});

/// Auto rebuild and host
gulp.task('default',['minify']);
