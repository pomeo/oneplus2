#========================
#CONFIG
#========================
set :application, "oneinvites.com"
#========================
#CONFIG
#========================
require           "capistrano-offroad"
offroad_modules   "defaults", "supervisord"
set :repository,  "git@github.com:pomeo/oneplus2.git"
set :supervisord_start_group, "oneplus"
set :supervisord_stop_group,  "oneplus"
#========================
#ROLES
#========================
set  :gateway,    "#{application}" # main server
role :app,        "10.3.140.1"     # container

namespace :deploy do
  desc "Symlink shared configs and folders on each release."
  task :symlink_shared do
    run "ln -s #{shared_path}/tmp #{release_path}/tmp"
  end
end

after "deploy:create_symlink",
      "deploy:npm_install",
      "deploy:cleanup",
      "deploy:symlink_shared",
      "deploy:restart"
