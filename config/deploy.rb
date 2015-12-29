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
role :app,        "10.3.140.1"      # container

after "deploy:create_symlink",
      "deploy:npm_install",
      "deploy:restart"
