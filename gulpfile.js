'use strict';
var browserify  = require('browserify'),
    gulp        = require('gulp'),
    imagemin    = require('gulp-imagemin'),
    pngcrush    = require('imagemin-pngcrush'),
    babel       = require('gulp-babel'),
    uglify      = require('gulp-uglify'),
    stylus      = require('gulp-stylus'),
    prefix      = require('gulp-autoprefixer'),
    minifyCSS   = require('gulp-minify-css'),
    mocha       = require('gulp-mocha'),
    plumber     = require('gulp-plumber'),
    notify      = require('gulp-notify'),
    nib         = require('nib'),
    sourcemaps  = require('gulp-sourcemaps'),
    source      = require('vinyl-source-stream'),
    buffer      = require('vinyl-buffer'),
    concat      = require('gulp-concat'),
    rev         = require('gulp-rev'),
    browserSync = require('browser-sync');

gulp.task('images', function () {
  return gulp.src('src/img/**/*')
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(imagemin({
           progressive: true,
           svgoPlugins: [{removeViewBox: false}],
           use: [pngcrush()]
         }))
         .pipe(gulp.dest('public/img'))
         .pipe(browserSync.stream())
         .pipe(notify('Update images'));
});

gulp.task('libs', function() {
  return gulp.src(['bower_components/jquery/dist/jquery.js',
                   'bower_components/jquery-validation/dist/jquery.validate.js',
                   'bower_components/jquery-validation/dist/additional-methods.js',
                   'bower_components/jquery-form/jquery.form.js',
                   'bower_components/lodash/lodash.js',
                   'bower_components/uikit/js/uikit.js',
                   'bower_components/uikit/js/components/notify.js',
                   'bower_components/uikit/js/components/sortable.js',
                   'bower_components/uikit/js/components/tooltip.js'])
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(sourcemaps.init())
         .pipe(uglify())
         .pipe(concat('libs.js'))
         .pipe(rev())
         .pipe(sourcemaps.write('maps', {
           sourceMappingURLPrefix: '/js/'
         }))
         .pipe(gulp.dest('public/js'))
         .pipe(browserSync.stream())
         .pipe(rev.manifest('libs.json'))
         .pipe(gulp.dest('routes'))
         .pipe(notify({
           onLast: true,
           message: 'Update libs.js'
         }));
});

gulp.task('compress', function() {
  return browserify('src/js/main.js')
         .bundle()
         .pipe(source('app.js'))
         .pipe(buffer())
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(sourcemaps.init())
         .pipe(babel())
         .pipe(uglify())
         .pipe(rev())
         .pipe(sourcemaps.write('maps', {
           sourceMappingURLPrefix: '/js/'
         }))
         .pipe(gulp.dest('public/js'))
         .pipe(browserSync.stream())
         .pipe(rev.manifest('app.json'))
         .pipe(gulp.dest('routes'))
         .pipe(notify({
           onLast: true,
           message: 'Update app.js'
         }));
});

gulp.task('stylus', function () {
  return gulp.src(['src/css/styles.styl'])
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(sourcemaps.init())
         .pipe(stylus({compress: false, use: nib()}))
         .pipe(prefix())
         .pipe(minifyCSS())
         .pipe(concat('styles.css'))
         .pipe(rev())
         .pipe(sourcemaps.write('maps'), {
           sourceMappingURLPrefix: '/css/'
         })
         .pipe(gulp.dest('public/css'))
         .pipe(browserSync.stream())
         .pipe(rev.manifest('styles.json'))
         .pipe(gulp.dest('routes'))
         .pipe(notify({
           onLast: true,
           message: 'Update stylus'
         }));
});

gulp.task('mocha', function() {
  return gulp.src('test/*.js', {read: false})
         .pipe(mocha({ reporter: 'spec' }))
         .on('error', function(err) {
           if (!/tests? failed/.test(err.stack)) {
             console.log(err.stack);
           }
         });
});

gulp.task('browser-sync', function() {
  browserSync.init(null, {
    proxy: 'localhost:3000',
    open: false,
    port: 8081,
    notify: false
  });
});

gulp.task('build', ['libs', 'compress', 'stylus']);

gulp.task('default', ['build', 'images', 'browser-sync', 'mocha'], function () {
  gulp.watch('views/**/*.jade').on('change', browserSync.reload);
  gulp.watch(['src/**/*.styl'], ['stylus']);
  gulp.watch(['src/**/*.js'], ['compress']);
  gulp.watch(['test/**/*.js'], ['mocha']);
  gulp.watch(['src/img/*'], ['images']);
});
