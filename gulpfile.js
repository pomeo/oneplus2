var browserify = require('browserify'),
    gulp = require('gulp'),
    imagemin = require('gulp-imagemin'),
    pngcrush = require('imagemin-pngcrush'),
    babel = require('gulp-babel'),
    uglify = require('gulp-uglify'),
    stylus = require('gulp-stylus'),
    prefix = require('gulp-autoprefixer'),
    minifyCSS = require('gulp-minify-css'),
    mocha = require('gulp-mocha'),
    plumber = require('gulp-plumber'),
    notify = require('gulp-notify'),
    nib = require('nib'),
    karma = require('karma').server,
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    concat = require('gulp-concat'),
    browserSync = require('browser-sync'),
    reload = browserSync.reload;

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
         .pipe(reload({stream:true}))
         .pipe(notify('Update images'));
});

gulp.task('libs', function() {
  return gulp.src([])
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(sourcemaps.init())
         .pipe(uglify())
         .pipe(concat('libs.js'))
         .pipe(sourcemaps.write('maps', {
           sourceMappingURLPrefix: '/js/'
         }))
         .pipe(gulp.dest('public/js'))
         .pipe(reload({stream:true}))
         .pipe(notify({
           onLast: true,
           message: 'Update libs.js'
         }));
});

gulp.task('compress', function() {
  return browserify('src/js/main.js')
        .bundle()
         .pipe(plumber({
           errorHandler: notify.onError("Error: <%= error.message %>")
         }))
         .pipe(sourcemaps.init())
         .pipe(babel())
         .pipe(uglify())
         .pipe(source('app.js'))
         .pipe(sourcemaps.write('maps', {
           sourceMappingURLPrefix: '/js/'
         }))
         .pipe(gulp.dest('public/js'))
         .pipe(reload({stream:true}))
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
         .pipe(sourcemaps.write('maps'), {
           sourceMappingURLPrefix: '/css/'
         })
         .pipe(gulp.dest('public/css'))
         .pipe(reload({stream:true}))
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

gulp.task('karma', function (done) {
  karma.start({
    configFile: __dirname + '/test/karma/karma.conf.js',
    singleRun: false
  }, done);
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

gulp.task('default', ['build', 'images', 'browser-sync', 'mocha', 'karma'], function () {
  gulp.watch(['views/**/*.jade'], reload);
  gulp.watch(['src/**/*.styl'], ['stylus']);
  gulp.watch(['src/**/*.js'], ['compress']);
  gulp.watch(['src/img/*'], ['images']);
});
