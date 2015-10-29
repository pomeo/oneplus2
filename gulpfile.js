'use strict';
var gulp             = require('gulp'),
    path             = require('path'),
    browserify       = require('browserify'),
    imagemin         = require('gulp-imagemin'),
    babelify         = require('babelify'),
    uglify           = require('gulp-uglify'),
    pngcrush         = require('imagemin-pngcrush'),
    gutil            = require('gulp-util'),
    stylus           = require('gulp-stylus'),
    prefix           = require('gulp-autoprefixer'),
    minifyCSS        = require('gulp-minify-css'),
    mocha            = require('gulp-mocha'),
    plumber          = require('gulp-plumber'),
    notify           = require('gulp-notify'),
    webpack          = require('webpack'),
    WebpackDevServer = require('webpack-dev-server'),
    _config          = require(path.join(__dirname, 'webpack.config.js')),
    nib              = require('nib'),
    sourcemaps       = require('gulp-sourcemaps'),
    source           = require('vinyl-source-stream'),
    buffer           = require('vinyl-buffer'),
    concat           = require('gulp-concat'),
    browserSync      = require('browser-sync'),
    b;

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

gulp.task('webpack-dev-server', function(callback) {
  var compiler = webpack(_config);

  new WebpackDevServer(compiler, {
    publicPath: _config.output.publicPath,
    hot: true,
    historyApiFallback: true,
    stats: { colors: true },
    proxy: {
      '*' : 'http://localhost:9090'
    }
  }).listen(8081, 'localhost', function(err) {
    if(err) throw new gutil.PluginError('webpack-dev-server', err);
    gutil.log('[webpack-dev-server]',
              'http://localhost:8081/webpack-dev-server/');
  });
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
                   'bower_components/uikit/js/components/slideshow.js',
                   'bower_components/uikit/js/components/slideshow-fx.js',
                   'bower_components/uikit/js/components/accordion.js',
                   'bower_components/uikit/js/components/tooltip.js'])
         .pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
         .pipe(sourcemaps.init())
         .pipe(uglify())
         .pipe(concat('libs.js'))
         .pipe(sourcemaps.write('maps', {
           sourceMappingURLPrefix: '/js/'
         }))
         .pipe(gulp.dest('public/js'))
         .pipe(browserSync.stream())
         .pipe(notify({
           onLast: true,
           message: 'Update libs.js'
         }));
});

gulp.task('compress', function() {
  var b = browserify({
    entries: './src/js/main.js',
    debug: true,
    transform: [babelify]
  });

  return b.bundle()
         .pipe(source('app.js'))
         .pipe(buffer())
         .pipe(sourcemaps.init())
         .pipe(uglify())
         .on('error', gutil.log)
         .pipe(sourcemaps.write('maps', {
           sourceMappingURLPrefix: '/js/'
         }))
         .pipe(gulp.dest('public/js/'))
         .pipe(browserSync.stream())
         .pipe(notify({
           onLast: true,
           message: 'Update app.js'
         }));
});

gulp.task('stylus', function () {
  return gulp.src(['bower_components/uikit/css/uikit.css',
                   'bower_components/uikit/css/uikit.almost-flat.css',
                   'bower_components/uikit/css/components/notify.almost-flat.css',
                   'bower_components/uikit/css/components/notify.css',
                   'bower_components/uikit/css/components/sortable.css',
                   'bower_components/uikit/css/components/sortable.almost-flat.css',
                   'bower_components/uikit/css/components/tooltip.css',
                   'bower_components/uikit/css/components/tooltip.almost-flat.css',
                   'bower_components/uikit/css/components/accordion.css',
                   'bower_components/uikit/css/components/accordion.almost-flat.css',
                   'bower_components/uikit/css/components/slideshow.css',
                   'bower_components/uikit/css/components/slideshow.almost-flat.css',
                   'src/css/auction.css',
                   'src/css/styles.styl'])
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(sourcemaps.init())
         .pipe(stylus({compress: false, use: nib()}))
         .pipe(prefix({
           browsers: ['last 2 versions'],
           cascade: false
         }))
         .pipe(minifyCSS())
         .pipe(concat('styles.css'))
         .pipe(sourcemaps.write('maps'), {
           sourceMappingURLPrefix: '/css/'
         })
         .pipe(gulp.dest('public/css'))
         .pipe(browserSync.stream())
         .pipe(notify({
           onLast: true,
           message: 'Update stylus'
         }));
});

gulp.task('build', ['libs', 'compress', 'stylus']);

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

gulp.task('default', ['build', 'images', 'browser-sync'], function () {
  gulp.watch('views/**/*.jade').on('change', browserSync.reload);
  gulp.watch(['src/**/*.styl'], ['stylus']);
  gulp.watch(['src/**/*.js'], ['compress']);
  gulp.watch(['test/**/*.js'], ['mocha']);
  gulp.watch(['src/img/**/*'], ['images']);
});
