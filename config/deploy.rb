require 'rollbar/capistrano'
set :rollbar_token, ENV['rollbar']
#========================
#CONFIG
#========================
set :application, "oneplus2"
#========================
#CONFIG
#========================
require           "capistrano-offroad"
offroad_modules   "defaults", "supervisord"
set :repository,  "git@github.com:pomeo/#{application}.git"
set :supervisord_start_group, "oneplus"
set :supervisord_stop_group,  "oneplus"
#========================
#ROLES
#========================
role :app,        "ubuntu@oneinvites.com"

namespace :deploy do
  desc "Symlink shared configs and folders on each release."
  task :symlink_shared do
    run "ln -s #{shared_path}/files #{release_path}/files"
  end
end

after "deploy:create_symlink", "deploy:npm_install", "deploy:symlink_shared", "deploy:restart"
